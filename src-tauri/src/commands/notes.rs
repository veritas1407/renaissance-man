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

    if let Some(parent) = abs_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let note = ParsedNote {
        frontmatter: frontmatter_val,
        body,
    };
    frontmatter::write_note_atomic(&abs_path, &note).map_err(|e| e.to_string())?;
    Ok(rel_path)
}

#[tauri::command]
pub async fn trash_note(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap().clone().ok_or("No vault open")?;
    let src = vault.join(&relative_path);
    if !src.exists() { return Ok(()); }
    let trash_dir = vault.join(".trash");
    std::fs::create_dir_all(&trash_dir).map_err(|e| e.to_string())?;
    let fname = src.file_name().ok_or("invalid path")?.to_string_lossy().into_owned();
    let dest = trash_dir.join(&fname);
    let dest = if dest.exists() {
        let stem = src.file_stem().unwrap_or_default().to_string_lossy().into_owned();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        trash_dir.join(format!("{stem}-{ts}.md"))
    } else { dest };
    std::fs::rename(&src, &dest).map_err(|e| e.to_string())
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
