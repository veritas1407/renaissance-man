use tauri::State;

use crate::models::CaptureItem;
use crate::vault::frontmatter;
use crate::AppState;

#[tauri::command]
pub async fn save_capture(
    state: State<'_, AppState>,
    kind: String,
    tags: Vec<String>,
    content: String,
) -> Result<String, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let now = chrono::Utc::now();
    let timestamp = now.format("%Y-%m-%dT%H-%M-%S").to_string();
    let filename = format!("{timestamp}.md");
    let inbox_dir = vault.join("Journal").join("inbox");
    std::fs::create_dir_all(&inbox_dir).map_err(|e| e.to_string())?;

    let abs_path = inbox_dir.join(&filename);
    let rel_path = format!("Journal/inbox/{filename}");

    let tags_json: serde_json::Value = tags.iter().map(|t| t.as_str()).collect();
    let fm = serde_json::json!({
        "type": "capture",
        "kind": kind,
        "created": now.to_rfc3339(),
        "status": "inbox",
        "tags": tags_json,
        "text": content
    });

    let note = crate::models::ParsedNote {
        frontmatter: fm,
        body: String::new(),
    };

    frontmatter::write_note_atomic(&abs_path, &note).map_err(|e| e.to_string())?;
    Ok(rel_path)
}

#[tauri::command]
pub async fn list_captures(
    state: State<'_, AppState>,
    processed: Option<bool>,
) -> Result<Vec<CaptureItem>, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let inbox_dir = vault.join("Journal").join("inbox");
    if !inbox_dir.exists() {
        return Ok(vec![]);
    }

    let mut items: Vec<CaptureItem> = Vec::new();

    for entry in std::fs::read_dir(&inbox_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            let note = match frontmatter::parse_note(&content) {
                Ok(n) => n,
                Err(_) => continue,
            };
            let fm = &note.frontmatter;

            let is_processed = fm
                .get("status")
                .and_then(|v| v.as_str())
                .map(|s| s == "sorted")
                .unwrap_or(false);

            if let Some(want_processed) = processed {
                if is_processed != want_processed {
                    continue;
                }
            }

            let kind = fm
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("note")
                .to_string();
            let text = fm
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let created_at = fm
                .get("created")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let tags: Vec<String> = fm
                .get("tags")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default();

            let rel = path
                .strip_prefix(&vault)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            items.push(CaptureItem {
                path: rel,
                kind,
                content: text,
                tags,
                processed: is_processed,
                created_at,
            });
        }
    }

    // Newest first
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(items)
}

#[tauri::command]
pub async fn mark_capture_processed(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<(), String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let path = vault.join(&relative_path);
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut note = frontmatter::parse_note(&content).map_err(|e| e.to_string())?;

    if let Some(obj) = note.frontmatter.as_object_mut() {
        obj.insert(
            "status".to_string(),
            serde_json::Value::String("sorted".to_string()),
        );
    }

    frontmatter::write_note_atomic(&path, &note).map_err(|e| e.to_string())
}
