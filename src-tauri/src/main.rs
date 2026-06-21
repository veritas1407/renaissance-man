#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod vault;

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Emitter, Manager};

pub struct AppState {
    pub vault_path: Mutex<Option<PathBuf>>,
    pub db: Mutex<Option<Connection>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            vault_path: Mutex::new(None),
            db: Mutex::new(None),
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
            let raw_path = request.uri().path().trim_start_matches('/').to_string();
            let file_path: PathBuf = vault.join(&raw_path);

            match std::fs::read(&file_path) {
                Ok(bytes) => {
                    let mime = if raw_path.ends_with(".pdf") {
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
            // Restore previously chosen vault from config
            if let Ok(config_dir) = app.path().app_config_dir() {
                let config_path = config_dir.join("vault.json");
                if let Ok(json) = std::fs::read_to_string(&config_path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) {
                        if let Some(path_str) = v.get("path").and_then(|p| p.as_str()) {
                            let vault = PathBuf::from(path_str);
                            if vault.exists() {
                                let db_path = vault.join(".renaissance").join("index.sqlite");
                                if let Ok(conn) = db::open(&db_path) {
                                    let state = app.state::<AppState>();
                                    *state.vault_path.lock().unwrap() = Some(vault.clone());
                                    *state.db.lock().unwrap() = Some(conn);

                                    let app_h = app.handle().clone();
                                    tauri::async_runtime::spawn(async move {
                                        let state = app_h.state::<AppState>();
                                        if let Some(vp) =
                                            state.vault_path.lock().unwrap().clone()
                                        {
                                            if let Some(conn) = state.db.lock().unwrap().as_ref()
                                            {
                                                let _ = db::ingest::full_ingest(conn, &vp);
                                            }
                                        }
                                        let _ = app_h.emit("vault-ready", ());
                                    });
                                    return Ok(());
                                }
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
            commands::capture::save_capture,
            commands::capture::list_captures,
            commands::capture::mark_capture_processed,
            commands::pdf::import_pdf,
            commands::pdf::save_highlight,
            commands::search::search_fts,
            commands::search::search_semantic,
            commands::search::rebuild_index,
            commands::stats::log_session_event,
            commands::stats::get_reentry_rate,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
