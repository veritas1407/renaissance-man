//! Vault transfer — the whole vault as one zip archive, so the same notes can
//! travel desktop ↔ phone without any cloud. The `.renaissance` cache never
//! travels; it rebuilds from the Markdown on arrival (files are truth).

use std::io::{Cursor, Read, Write};
use std::path::{Component, Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FsExt, OpenOptions};

use crate::AppState;

/// True for zip entry paths we refuse to extract (escapes, caches, absolutes).
fn safe_rel_path(name: &str) -> Option<PathBuf> {
    let p = Path::new(name);
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Normal(seg) => out.push(seg),
            Component::CurDir => {}
            _ => return None, // ParentDir / RootDir / Prefix — refuse
        }
    }
    if out.as_os_str().is_empty()
        || out.components().any(|c| c.as_os_str() == ".renaissance")
    {
        return None;
    }
    Some(out)
}

/// Pick a `.zip` (works with Android content:// URIs via the fs plugin) and
/// unpack it into the open vault. Existing files with the same path are
/// overwritten — the archive is the newer truth. Returns files written.
#[tauri::command]
pub async fn import_vault_zip(app: AppHandle) -> Result<usize, String> {
    let vault = {
        let state: State<AppState> = app.state();
        let v = state.vault_path.lock().unwrap().clone();
        v.ok_or("No vault open")?
    };

    let fp = app
        .dialog()
        .file()
        .add_filter("Vault archive", &["zip"])
        .blocking_pick_file()
        .ok_or_else(|| "No archive selected".to_string())?;

    let mut opts = OpenOptions::new();
    opts.read(true);
    let mut file = app
        .fs()
        .open(fp, opts)
        .map_err(|e| format!("open archive: {e}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("read archive: {e}"))?;

    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("not a zip archive: {e}"))?;

    let mut written = 0usize;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name().and_then(|p| {
            safe_rel_path(&p.to_string_lossy().replace('\\', "/"))
        }) else {
            continue;
        };
        let dest = vault.join(&rel);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut content = Vec::new();
        entry.read_to_end(&mut content).map_err(|e| e.to_string())?;
        std::fs::write(&dest, content).map_err(|e| e.to_string())?;
        written += 1;
    }

    // The cache rebuilds from the new files; the UI reloads on vault-ready.
    let state: State<AppState> = app.state();
    if let Some(conn) = state.db.lock().unwrap().as_ref() {
        let _ = crate::db::ingest::full_ingest(conn, &vault);
    }
    let _ = app.emit("vault-ready", ());

    Ok(written)
}

/// Zip the open vault (minus the rebuildable `.renaissance` cache) to a
/// location the user picks — on Android that lands in Downloads/Drive/etc.
/// Returns files packed.
#[tauri::command]
pub async fn export_vault_zip(app: AppHandle) -> Result<usize, String> {
    let vault = {
        let state: State<AppState> = app.state();
        let v = state.vault_path.lock().unwrap().clone();
        v.ok_or("No vault open")?
    };

    let stamp = chrono::Local::now().format("%Y-%m-%d");
    let fp = app
        .dialog()
        .file()
        .set_file_name(format!("renaissance-vault-{stamp}.zip"))
        .add_filter("Vault archive", &["zip"])
        .blocking_save_file()
        .ok_or_else(|| "No destination chosen".to_string())?;

    // Build the archive in memory (a personal vault of Markdown stays small),
    // then write once — content:// destinations may not be seekable.
    let mut cursor = Cursor::new(Vec::<u8>::new());
    let mut packed = 0usize;
    {
        let mut zw = zip::ZipWriter::new(&mut cursor);
        let opts: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for entry in walkdir::WalkDir::new(&vault)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_type().is_file()
                    && !e
                        .path()
                        .components()
                        .any(|c| c.as_os_str() == ".renaissance")
            })
        {
            let rel = entry
                .path()
                .strip_prefix(&vault)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .replace('\\', "/");
            let content = match std::fs::read(entry.path()) {
                Ok(c) => c,
                Err(_) => continue,
            };
            zw.start_file(rel, opts).map_err(|e| e.to_string())?;
            zw.write_all(&content).map_err(|e| e.to_string())?;
            packed += 1;
        }
        zw.finish().map_err(|e| e.to_string())?;
    }

    let mut opts = OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    let mut out = app
        .fs()
        .open(fp, opts)
        .map_err(|e| format!("open destination: {e}"))?;
    out.write_all(cursor.get_ref())
        .map_err(|e| format!("write archive: {e}"))?;

    Ok(packed)
}
