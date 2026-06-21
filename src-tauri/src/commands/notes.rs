use tauri::State;

use crate::models::ParsedNote;
use crate::vault::{frontmatter, vault_absolute};
use crate::AppState;

#[tauri::command]
pub async fn read_note_parsed(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<ParsedNote, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let path = vault_absolute(&vault, &relative_path);
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    frontmatter::parse_note(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_frontmatter(
    state: State<'_, AppState>,
    relative_path: String,
    frontmatter_val: serde_json::Value,
    body: String,
) -> Result<(), String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let path = vault_absolute(&vault, &relative_path);
    let note = ParsedNote {
        frontmatter: frontmatter_val,
        body,
    };
    frontmatter::write_note_atomic(&path, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    subfolder: String,
    slug: String,
    frontmatter_val: serde_json::Value,
    body: String,
) -> Result<String, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let filename = format!("{slug}.md");
    let rel_path = format!("{subfolder}/{filename}");
    let abs_path = vault.join(&subfolder).join(&filename);

    if abs_path.exists() {
        return Err(format!("Note already exists: {rel_path}"));
    }

    let note = ParsedNote {
        frontmatter: frontmatter_val,
        body,
    };
    frontmatter::write_note_atomic(&abs_path, &note).map_err(|e| e.to_string())?;
    Ok(rel_path)
}

#[tauri::command]
pub async fn append_to_note(
    state: State<'_, AppState>,
    relative_path: String,
    text: String,
) -> Result<(), String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let path = vault_absolute(&vault, &relative_path);
    let existing = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let appended = format!("{existing}\n{text}");

    // Atomic write of the appended content
    let tmp = path.with_extension("md.tmp");
    std::fs::write(&tmp, &appended).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}
