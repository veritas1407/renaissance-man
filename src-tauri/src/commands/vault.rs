use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::models::{ResumeCard, VaultFileEntry};
use crate::vault;
use crate::AppState;

#[tauri::command]
pub async fn pick_vault_folder(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let fp = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or_else(|| "No folder selected".to_string())?;

    // Tauri 2 FilePath is an enum — extract PathBuf
    let path_buf = match fp {
        tauri_plugin_dialog::FilePath::Path(p) => p,
        _ => return Err("Expected a filesystem path".to_string()),
    };
    let path_str = path_buf.to_string_lossy().to_string();

    // Persist to app config
    let config_path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("vault.json");

    std::fs::create_dir_all(config_path.parent().unwrap()).map_err(|e| e.to_string())?;
    let config = serde_json::json!({ "path": path_str });
    std::fs::write(&config_path, config.to_string()).map_err(|e| e.to_string())?;

    // Update app state
    let state: State<AppState> = app.state();
    *state.vault_path.lock().unwrap() = Some(PathBuf::from(&path_str));

    // Ensure vault structure exists
    vault::ensure_structure(&PathBuf::from(&path_str)).map_err(|e| e.to_string())?;

    // Open/init DB
    let db_path = PathBuf::from(&path_str)
        .join(".renaissance")
        .join("index.sqlite");
    let conn = crate::db::open(&db_path).map_err(|e| e.to_string())?;
    *state.db.lock().unwrap() = Some(conn);

    // Trigger background index
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let s = app_clone.state::<AppState>();
        if let Some(vault) = s.vault_path.lock().unwrap().clone() {
            if let Some(conn) = s.db.lock().unwrap().as_ref() {
                let _ = crate::db::ingest::full_ingest(conn, &vault);
            }
        }
        let _ = app_clone.emit("vault-ready", ());
    });

    Ok(path_str)
}

#[tauri::command]
pub async fn get_vault_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state
        .vault_path
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn list_vault_files(
    state: State<'_, AppState>,
    subfolder: String,
) -> Result<Vec<VaultFileEntry>, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let dir = vault.join(&subfolder);
    vault::list_markdown_files(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_one_thing(state: State<'_, AppState>) -> Result<Option<ResumeCard>, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let mut candidates: Vec<ResumeCard> = Vec::new();

    // Score readings
    let reading_files =
        vault::list_markdown_files(&vault.join("Readings")).map_err(|e| e.to_string())?;
    for f in reading_files {
        let content = std::fs::read_to_string(&f.path).unwrap_or_default();
        let note = crate::vault::frontmatter::parse_note(&content).unwrap_or_default();
        let fm = &note.frontmatter;

        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&f.name)
            .to_string();
        let why = fm
            .get("why")
            .and_then(|v| v.as_str())
            .unwrap_or("(no why set)")
            .to_string();
        let temp = fm
            .get("temp")
            .and_then(|v| v.as_str())
            .unwrap_or("warm")
            .to_string();
        let last_touched = fm
            .get("last_touched")
            .and_then(|v| v.as_str())
            .or_else(|| fm.get("added").and_then(|v| v.as_str()))
            .unwrap_or("");

        // Status must be 'reading' or 'queued' (not 'bound'/'done')
        let status = fm
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("reading");
        if status == "bound" || status == "done" {
            continue;
        }

        let score = compute_score(&temp, last_touched);
        let next_action = format!("Continue reading {title}");

        candidates.push(ResumeCard {
            path: f.path.clone(),
            title,
            why,
            next_action,
            kind: "reading".to_string(),
            warmth: temp,
            score,
        });
    }

    // Score goals
    let goal_files =
        vault::list_markdown_files(&vault.join("Goals")).map_err(|e| e.to_string())?;
    for f in goal_files {
        let content = std::fs::read_to_string(&f.path).unwrap_or_default();
        let note = crate::vault::frontmatter::parse_note(&content).unwrap_or_default();
        let fm = &note.frontmatter;

        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&f.name)
            .to_string();
        let temp = fm
            .get("temp")
            .and_then(|v| v.as_str())
            .unwrap_or("warm")
            .to_string();
        let last_touched = fm
            .get("last_touched")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Find the current (first incomplete) rung
        let next_action = fm
            .get("rungs")
            .and_then(|v| v.as_array())
            .and_then(|rungs| {
                rungs.iter().find(|r| {
                    !r.get("complete")
                        .and_then(|c| c.as_bool())
                        .unwrap_or(false)
                })
            })
            .and_then(|r| r.get("t"))
            .and_then(|v| v.as_str())
            .map(|s| format!("Next: {s}"))
            .unwrap_or_else(|| "Continue working on this goal".to_string());

        let why = fm
            .get("why")
            .and_then(|v| v.as_str())
            .unwrap_or("(no why set)")
            .to_string();

        let score = compute_score(&temp, last_touched);

        candidates.push(ResumeCard {
            path: f.path.clone(),
            title,
            why,
            next_action,
            kind: "goal".to_string(),
            warmth: temp,
            score,
        });
    }

    // Sort by score descending, pick the highest
    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    Ok(candidates.into_iter().next())
}

/// score = warmth_weight × recency_weight
fn compute_score(temp: &str, last_touched: &str) -> f64 {
    let warmth_weight = match temp {
        "warm" => 1.0,
        "cooling" => 0.7,
        "cold" => 0.4,
        _ => 0.5,
    };

    let recency_weight = if last_touched.is_empty() {
        0.5
    } else {
        let now = chrono::Utc::now();
        let touched = chrono::DateTime::parse_from_rfc3339(last_touched)
            .map(|d| d.with_timezone(&chrono::Utc))
            .or_else(|_| {
                chrono::NaiveDate::parse_from_str(last_touched, "%Y-%m-%d")
                    .map(|d| {
                        d.and_hms_opt(0, 0, 0)
                            .unwrap()
                            .and_utc()
                    })
            })
            .unwrap_or(now);

        let days_ago = (now - touched).num_days().max(0) as f64;
        // Log decay over 14 days
        (1.0 / (1.0 + days_ago.ln_1p() / 14f64.ln_1p())).max(0.1)
    };

    warmth_weight * recency_weight
}
