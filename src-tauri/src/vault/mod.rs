pub mod frontmatter;

use anyhow::Result;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

use crate::models::VaultFileEntry;

/// The canonical subdirectories under the vault root (see ARCHITECTURE.md §3).
/// Pursuits = the becoming altitude; Works = the exhibition; Proposals = the
/// one gate through which AI suggestions may enter (never the human folders).
pub const VAULT_SUBDIRS: &[&str] = &[
    "Pursuits",
    "Threads",
    "Readings",
    "Notes",
    "Goals",
    "Works",
    "Bucket",
    "Body",
    "Journal",
    "Attachments",
    "Proposals",
];

pub fn ensure_structure(vault: &Path) -> Result<()> {
    for dir in VAULT_SUBDIRS {
        std::fs::create_dir_all(vault.join(dir))?;
    }
    // Create inbox subfolder under Journal
    std::fs::create_dir_all(vault.join("Journal").join("inbox"))?;
    // Create hidden cache dir (gitignored)
    std::fs::create_dir_all(vault.join(".renaissance"))?;
    Ok(())
}

pub fn list_markdown_files(dir: &Path) -> Result<Vec<VaultFileEntry>> {
    let mut entries = Vec::new();
    for entry in WalkDir::new(dir)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if ext == "md" {
                    let mtime = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    let path = entry.path().to_string_lossy().to_string();
                    let name = entry
                        .file_name()
                        .to_string_lossy()
                        .trim_end_matches(".md")
                        .to_string();

                    entries.push(VaultFileEntry { path, name, mtime });
                }
            }
        }
    }
    entries.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    Ok(entries)
}

pub fn vault_relative(vault: &Path, absolute: &Path) -> String {
    absolute
        .strip_prefix(vault)
        .unwrap_or(absolute)
        .to_string_lossy()
        .to_string()
}

pub fn vault_absolute(vault: &Path, relative: &str) -> PathBuf {
    vault.join(relative)
}
