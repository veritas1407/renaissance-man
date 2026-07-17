use tauri::{AppHandle, Manager, State};

use crate::models::ImportedPdf;
use crate::vault::frontmatter;
use crate::AppState;

/// Best-effort display name from a content:// URI. Android SAF URIs end in a
/// percent-encoded document id like `primary%3ADownload%2Fbook.pdf` — decode
/// it and keep the final path-ish segment. Falls back to a timestamped name.
fn content_uri_filename(uri: &str) -> String {
    let tail = uri.rsplit('/').next().unwrap_or("");
    // minimal percent-decode
    let mut out = String::with_capacity(tail.len());
    let b = tail.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            if let (Some(h), Some(l)) = (
                b.get(i + 1).and_then(|c| (*c as char).to_digit(16)),
                b.get(i + 2).and_then(|c| (*c as char).to_digit(16)),
            ) {
                out.push(((h * 16 + l) as u8) as char);
                i += 3;
                continue;
            }
        }
        out.push(b[i] as char);
        i += 1;
    }
    let name = out
        .rsplit(['/', ':', '\\'])
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if name.to_lowercase().ends_with(".pdf") && name.len() > 4 {
        name
    } else {
        format!(
            "imported-{}.pdf",
            chrono::Utc::now().format("%Y%m%d-%H%M%S")
        )
    }
}

#[tauri::command]
pub async fn import_pdf(app: AppHandle) -> Result<ImportedPdf, String> {
    use tauri_plugin_dialog::DialogExt;

    let fp = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .blocking_pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    // Desktop pickers hand back real paths; Android hands back content://
    // URIs, which the fs plugin resolves to a readable file descriptor.
    let (bytes, filename) = match &fp {
        tauri_plugin_dialog::FilePath::Path(p) => {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .ok_or("Invalid filename")?;
            (std::fs::read(p).map_err(|e| e.to_string())?, name)
        }
        tauri_plugin_dialog::FilePath::Url(u) => {
            use std::io::Read;
            use tauri_plugin_fs::FsExt;
            let name = content_uri_filename(u.as_str());
            let mut opts = tauri_plugin_fs::OpenOptions::new();
            opts.read(true);
            let mut f = app
                .fs()
                .open(fp.clone(), opts)
                .map_err(|e| format!("open picked file: {e}"))?;
            let mut b = Vec::new();
            f.read_to_end(&mut b).map_err(|e| e.to_string())?;
            (b, name)
        }
    };

    let state: State<AppState> = app.state();
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    // Copy PDF to Attachments/
    let dest = vault.join("Attachments").join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

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

/// Remove a reading from the shelf. Nothing is hard-deleted: the reading note and
/// its attachment PDF are *moved* into the vault's `.trash/` folder, so a fat-fingered
/// removal is always recoverable and the vault stays the source of truth.
#[tauri::command]
pub async fn remove_reading(
    state: State<'_, AppState>,
    reading_path: String,
) -> Result<(), String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let note_path = vault.join(&reading_path);
    if !note_path.exists() {
        return Err("Reading not found".to_string());
    }

    let trash = vault.join(".trash");
    std::fs::create_dir_all(&trash).map_err(|e| e.to_string())?;

    // Move the attachment PDF too, if the frontmatter names one.
    if let Ok(content) = std::fs::read_to_string(&note_path) {
        if let Ok(note) = frontmatter::parse_note(&content) {
            if let Some(att) = note
                .frontmatter
                .get("attachment")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                // `attachment` is a bare filename; ignore anything with path separators.
                if !att.contains('/') && !att.contains('\\') {
                    let att_path = vault.join("Attachments").join(att);
                    if att_path.exists() {
                        move_to_trash(&att_path, &trash)?;
                    }
                }
            }
        }
    }

    move_to_trash(&note_path, &trash)?;
    Ok(())
}

/// Move a file into `trash`, prefixing with a timestamp on name collision so a prior
/// removal of the same name is never clobbered.
fn move_to_trash(src: &std::path::Path, trash: &std::path::Path) -> Result<(), String> {
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Invalid filename")?;
    let mut dest = trash.join(&name);
    if dest.exists() {
        let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
        dest = trash.join(format!("{stamp}-{name}"));
    }
    std::fs::rename(src, &dest).map_err(|e| e.to_string())
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
