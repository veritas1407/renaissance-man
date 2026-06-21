use tauri::{AppHandle, Manager, State};

use crate::models::ImportedPdf;
use crate::vault::frontmatter;
use crate::AppState;

#[tauri::command]
pub async fn import_pdf(app: AppHandle) -> Result<ImportedPdf, String> {
    use tauri_plugin_dialog::DialogExt;

    let fp = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .blocking_pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    let source_path = match fp {
        tauri_plugin_dialog::FilePath::Path(p) => p,
        _ => return Err("Expected a filesystem path".to_string()),
    };
    let filename: String = source_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Invalid filename")?;

    let state: State<AppState> = app.state();
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    // Copy PDF to Attachments/
    let dest = vault.join("Attachments").join(&filename);
    std::fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;

    // Derive title from filename (strip extension, replace dashes/underscores)
    let title = filename
        .trim_end_matches(".pdf")
        .replace(['-', '_'], " ");
    let title_cap: String = title
        .split_whitespace()
        .map(|w: &str| -> String {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ");

    // Create slug for the reading .md
    let slug = filename
        .trim_end_matches(".pdf")
        .to_lowercase()
        .replace([' ', '_'], "-");
    let reading_rel = format!("Readings/{slug}.md");
    let reading_path = vault.join("Readings").join(format!("{slug}.md"));

    let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let fm = serde_json::json!({
        "type": "reading",
        "title": title_cap,
        "source": format!("Attachments/{filename}"),
        "attachment": filename,
        "added": now,
        "status": "reading",
        "position": { "page": 1, "percent": 0 },
        "temp": "warm",
        "last_touched": now,
        "why": "",
        "review": null
    });

    let note = crate::models::ParsedNote {
        frontmatter: fm,
        body: String::new(),
    };

    if !reading_path.exists() {
        frontmatter::write_note_atomic(&reading_path, &note).map_err(|e| e.to_string())?;
    }

    Ok(ImportedPdf {
        filename: filename.clone(),
        title: title_cap,
        reading_path: reading_rel,
        attachment_path: format!("Attachments/{filename}"),
    })
}

#[tauri::command]
pub async fn save_highlight(
    state: State<'_, AppState>,
    reading_path: String,
    highlight: serde_json::Value,
) -> Result<(), String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let path = vault.join(&reading_path);
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut note = frontmatter::parse_note(&content).map_err(|e| e.to_string())?;

    let highlights = note
        .frontmatter
        .as_object_mut()
        .ok_or("frontmatter is not an object")?
        .entry("highlights")
        .or_insert_with(|| serde_json::Value::Array(vec![]));

    if let Some(arr) = highlights.as_array_mut() {
        arr.push(highlight);
    }

    frontmatter::write_note_atomic(&path, &note).map_err(|e| e.to_string())
}
