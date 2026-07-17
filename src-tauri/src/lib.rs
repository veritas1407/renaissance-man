// frontend embed refresh: v0.1.24
pub mod commands;
pub mod db;
pub mod models;
pub mod vault;

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Emitter, Manager};

/// The embedding model only exists on desktop; on mobile the slot stays empty
/// and semantic search degrades to FTS (see commands/search.rs).
#[cfg(desktop)]
pub type Embedder = fastembed::TextEmbedding;
#[cfg(mobile)]
pub type Embedder = ();

pub struct AppState {
    pub vault_path: Mutex<Option<PathBuf>>,
    pub db: Mutex<Option<Connection>>,
    // Lazily-loaded MiniLM embedder for semantic search (None until first use).
    pub embedder: Mutex<Option<Embedder>>,
}

/// Percent-decode a URI path, byte-wise so multi-byte UTF-8 sequences survive.
/// The rm-asset URLs are built with encodeURIComponent on the JS side, so any
/// attachment named with spaces, `&`, `#`, or non-ASCII arrives encoded here.
fn percent_decode(s: &str) -> String {
    fn hex(b: u8) -> Option<u8> {
        (b as char).to_digit(16).map(|d| d as u8)
    }
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Open a vault: remember it in state, open the SQLite cache, ingest in the
/// background, then emit `vault-ready`. Shared by desktop restore, the desktop
/// folder picker, and the Android fixed-location vault.
pub fn open_vault(app: &tauri::AppHandle, vault: PathBuf) -> anyhow::Result<()> {
    vault::ensure_structure(&vault)?;
    let db_path = vault.join(".renaissance").join("index.sqlite");
    let conn = db::open(&db_path)?;

    let state = app.state::<AppState>();
    *state.vault_path.lock().unwrap() = Some(vault);
    *state.db.lock().unwrap() = Some(conn);

    let app_h = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = app_h.state::<AppState>();
        let vp_opt = state.vault_path.lock().unwrap().clone();
        if let Some(vp) = vp_opt.clone() {
            if let Some(conn) = state.db.lock().unwrap().as_ref() {
                let _ = db::ingest::full_ingest(conn, &vp);
            }
        }
        // Unblock the UI immediately; embedding follows.
        let _ = app_h.emit("vault-ready", ());

        // Build the semantic index in the background (desktop only). The first
        // run downloads the MiniLM model once; only changed notes are
        // (re)embedded thereafter.
        #[cfg(desktop)]
        if let Some(vp) = vp_opt {
            let mut emb = state.embedder.lock().unwrap();
            if db::embed::ensure_loaded(&mut emb, &vp) {
                if let Some(model) = emb.as_ref() {
                    if let Some(conn) = state.db.lock().unwrap().as_ref() {
                        match db::embed::embed_pass(conn, &vp, model) {
                            Ok(n) => eprintln!("[semantic] embedded {n} item(s)"),
                            Err(e) => eprintln!("[semantic] embed pass failed: {e:#}"),
                        }
                    }
                }
            }
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            vault_path: Mutex::new(None),
            db: Mutex::new(None),
            embedder: Mutex::new(None),
        })
        // rm-asset:// streams vault files (PDFs) directly to WebView — no base64 IPC.
        .register_uri_scheme_protocol("rm-asset", |ctx, request| {
            let app = ctx.app_handle();
            let vault_path = app
                .state::<AppState>()
                .vault_path
                .lock()
                .unwrap()
                .clone();

            let Some(vault) = vault_path else {
                return tauri::http::Response::builder()
                    .status(503)
                    .body(b"vault not open".to_vec())
                    .unwrap();
            };

            // rm-asset://attachments/book.pdf → vault/Attachments/book.pdf
            // The filename arrives percent-encoded (spaces & co.) — decode it,
            // refuse path escapes, and fix the folder's case for case-sensitive
            // filesystems (Android).
            let raw_path = request.uri().path().trim_start_matches('/').to_string();
            let decoded = percent_decode(&raw_path);
            if decoded.split(['/', '\\']).any(|seg| seg == "..") {
                return tauri::http::Response::builder()
                    .status(403)
                    .body(b"forbidden".to_vec())
                    .unwrap();
            }
            let rel = if decoded.len() > 12 && decoded[..12].eq_ignore_ascii_case("attachments/") {
                format!("Attachments/{}", &decoded[12..])
            } else {
                decoded.clone()
            };
            let file_path: PathBuf = vault.join(&rel);

            match std::fs::read(&file_path) {
                Ok(bytes) => {
                    let mime = if rel.to_ascii_lowercase().ends_with(".pdf") {
                        "application/pdf"
                    } else {
                        "application/octet-stream"
                    };
                    tauri::http::Response::builder()
                        .status(200)
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap()
                }
                Err(_) => tauri::http::Response::builder()
                    .status(404)
                    .body(b"not found".to_vec())
                    .unwrap(),
            }
        })
        .setup(|app| {
            // Mobile: the vault lives at a fixed place inside app storage — no
            // folder picker exists there. Created empty on first launch; real
            // notes arrive via "bring vault from desktop" (import_vault_zip).
            #[cfg(mobile)]
            {
                let vault = app
                    .path()
                    .app_data_dir()
                    .expect("app data dir")
                    .join("vault");
                if let Err(e) = open_vault(app.handle(), vault) {
                    eprintln!("[vault] mobile vault open failed: {e:#}");
                }
                Ok(())
            }

            // Desktop: restore previously chosen vault from config
            #[cfg(desktop)]
            {
                if let Ok(config_dir) = app.path().app_config_dir() {
                    let config_path = config_dir.join("vault.json");
                    if let Ok(json) = std::fs::read_to_string(&config_path) {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) {
                            if let Some(path_str) = v.get("path").and_then(|p| p.as_str()) {
                                let vault = PathBuf::from(path_str);
                                if vault.exists()
                                    && open_vault(app.handle(), vault).is_ok()
                                {
                                    return Ok(());
                                }
                            }
                        }
                    }
                }

                // No vault remembered — tell frontend to show the picker
                let app_h = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_h.emit("show-vault-picker", ());
                });

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault::pick_vault_folder,
            commands::vault::get_vault_path,
            commands::vault::list_vault_files,
            commands::vault::pick_one_thing,
            commands::notes::read_note_parsed,
            commands::notes::write_frontmatter,
            commands::notes::create_note,
            commands::notes::append_to_note,
            commands::notes::trash_note,
            commands::capture::save_capture,
            commands::capture::list_captures,
            commands::capture::mark_capture_processed,
            commands::pdf::import_pdf,
            commands::pdf::save_highlight,
            commands::pdf::remove_reading,
            commands::search::search_fts,
            commands::search::search_semantic,
            commands::search::find_similar,
            commands::search::get_concept_edges,
            commands::search::rebuild_index,
            commands::vault::list_notes_for_atlas,
            commands::stats::log_session_event,
            commands::stats::get_reentry_rate,
            commands::transfer::import_vault_zip,
            commands::transfer::export_vault_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
