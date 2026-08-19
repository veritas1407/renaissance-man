#!/usr/bin/env bash
#
# ship-android.sh — build the APK, prove it is safe to install, put it on the phone.
#
# Why this exists as a script rather than a list of commands in someone's head:
#
#  1. The build genuinely takes two steps on Windows. `cargo tauri android build`
#     compiles the Rust fine and then fails at a symlink step, because creating
#     symlinks needs Developer Mode. Gradle's own packaging path copies instead
#     of linking, so it finishes the job. The failure in step one is expected and
#     is not a reason to stop.
#
#  2. The signing certificate is load-bearing. Android will only install over an
#     existing app if the new package carries the *same* certificate. If it ever
#     changes, the only way to install is to uninstall first — and the phone's
#     vault lives in the app's own storage (see lib.rs, app_data_dir()/vault), so
#     an uninstall takes the notes with it. This script therefore refuses to ship
#     an APK whose certificate does not match scripts/apk-cert.sha256.
#
# Usage:  npm run ship:android          (build, verify, install or serve)
#         npm run ship:android -- --serve   (skip adb, always serve over wifi)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORCE_SERVE=0
NO_BUILD=0
for arg in "$@"; do
  [ "$arg" = "--serve" ] && FORCE_SERVE=1
  [ "$arg" = "--no-build" ] && NO_BUILD=1
done

APK="src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk"

# Sources newer than $1 — the same question the freshness guard asks after a
# build, asked here beforehand to decide whether a build is needed at all.
sources_newer_than() {
  find frontend src-tauri/src src-tauri/Cargo.toml -type f \
    \( -name '*.rs' -o -name '*.js' -o -name '*.html' -o -name '*.css' -o -name '*.toml' \) \
    -newer "$1" -print -quit 2>/dev/null || true
}

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
die()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([0-9][^"]*\)"/\1/')
[ -n "$VERSION" ] || die "could not read version from src-tauri/tauri.conf.json"
say "Renaissance Man $VERSION → Android"

# A full build is four minutes; handing over an APK that is already current
# should be instant. Rebuild only when there is a reason to.
if [ "$NO_BUILD" -eq 1 ]; then
  [ -f "$APK" ] || die "--no-build was asked for, but no APK exists yet at $APK"
  say "· skipping the build (--no-build)"
elif [ -f "$APK" ] && [ -z "$(sources_newer_than "$APK")" ]; then
  say "· the existing APK is already newer than every source file — not rebuilding"
  echo "  (pass --no-build to insist, or touch a file to force a rebuild)"
else
  # The frontend is embedded into the .so, and Cargo only notices a changed
  # crate. Touching lib.rs guarantees the webview assets that ship are the ones
  # on disk.
  say "· refreshing the embedded frontend"
  sed -i "s|// frontend embed refresh: v.*|// frontend embed refresh: v$VERSION|" src-tauri/src/lib.rs

  say "· compiling (the symlink error at the end is expected)"
  cargo tauri android build --apk --target aarch64 2>&1 | tail -3 || true

  say "· packaging"
  ( cd src-tauri/gen/android && ./gradlew --quiet assembleArm64Release )
fi

[ -f "$APK" ] || die "no APK at $APK — the build produced nothing"

# Step one can fail in more ways than the expected symlink error, and Gradle will
# cheerfully package whatever .so is already sitting in jniLibs. That would ship
# yesterday's code wearing today's version number — the worst kind of green build.
# So: the native library must be newer than the newest thing it was built from.
say "· checking the build is actually fresh"
SO="src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/librenaissance_man_lib.so"
[ -f "$SO" ] || die "no native library at $SO — the compile step never produced one"
NEWEST_SRC=$(sources_newer_than "$SO")
if [ -n "$NEWEST_SRC" ]; then
  warn "  $NEWEST_SRC is newer than the compiled library."
  die  "  The compile step did not pick up your latest changes, so this APK would
  carry version $VERSION with older code inside. Fix the error printed above and
  run again — do not ship this."
fi
echo "  native library is newer than every source file it was built from"

# ---- the guard that protects the vault -------------------------------------
say "· checking the signature"
APKSIGNER=$(find "${ANDROID_HOME:-/c/Android/sdk}" "${LOCALAPPDATA:-}/Android/Sdk" \
  -name 'apksigner.bat' 2>/dev/null | sort -r | head -1 || true)
if [ -z "$APKSIGNER" ]; then
  warn "  apksigner not found — cannot verify the certificate."
  warn "  Installing anyway risks a signature mismatch, which can only be resolved"
  warn "  by uninstalling, and uninstalling erases the phone's vault. Stopping."
  die  "  Install Android build-tools, or pass --serve and verify by hand."
fi
GOT=$("$APKSIGNER" verify --print-certs "$APK" 2>/dev/null \
  | grep -i 'SHA-256 digest' | head -1 | sed 's/.*: *//' | tr -d '[:space:]')
WANT=$(tr -d '[:space:]' < scripts/apk-cert.sha256)
[ -n "$GOT" ] || die "the APK is not signed at all — check gen/android/keystore.properties"
if [ "$GOT" != "$WANT" ]; then
  warn "  expected certificate: $WANT"
  warn "  this APK's:           $GOT"
  die  "  SIGNATURE MISMATCH — do not install. Installing would force an uninstall,
  and the phone's vault lives in app storage. Restore android-keys/renaissance.keystore
  (and gen/android/keystore.properties) before shipping, or export the vault first."
fi
echo "  certificate matches — this installs over the existing app and keeps the vault"

DEST="$HOME/Desktop/Renaissance Man_${VERSION}_arm64.apk"
cp "$APK" "$DEST"
find "$HOME/Desktop" -maxdepth 1 -name 'Renaissance Man_*_arm64.apk' ! -name "*_${VERSION}_*" -delete 2>/dev/null || true
echo "  $(du -h "$DEST" | cut -f1) → $DEST"

# ---- onto the phone ---------------------------------------------------------
ADB=$(command -v adb 2>/dev/null || find "${ANDROID_HOME:-/c/Android/sdk}/platform-tools" -name 'adb.exe' 2>/dev/null | head -1 || true)
DEVICE=""
if [ -n "$ADB" ] && [ "$FORCE_SERVE" -eq 0 ]; then
  DEVICE=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1; exit}')
fi

if [ -n "$DEVICE" ]; then
  say "· installing on $DEVICE over the cable"
  # -r reinstalls and keeps app data: the vault survives the update
  if "$ADB" -s "$DEVICE" install -r "$APK"; then
    INSTALLED=$("$ADB" -s "$DEVICE" shell dumpsys package com.renaissanceman.app 2>/dev/null \
      | grep -m1 versionName | sed 's/.*versionName=//' | tr -d '\r')
    say "installed — the phone now runs ${INSTALLED:-$VERSION}"
  else
    die "adb install failed. If it says INSTALL_FAILED_UPDATE_INCOMPATIBLE the phone
holds a build signed with a different key: export the vault from the phone first,
then uninstall and install fresh."
  fi
else
  [ -n "$ADB" ] && [ "$FORCE_SERVE" -eq 0 ] && echo "  no phone on the cable — handing it over the wifi instead"
  say "· serving over the wifi"
  node scripts/apk-serve.js "$DEST" "$VERSION"
fi
