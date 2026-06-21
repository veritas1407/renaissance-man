use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultFileEntry {
    pub path: String,
    pub name: String,
    pub mtime: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ParsedNote {
    pub frontmatter: serde_json::Value,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResumeCard {
    pub path: String,
    pub title: String,
    pub why: String,
    pub next_action: String,
    pub kind: String,
    pub warmth: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptureItem {
    pub path: String,
    pub kind: String,
    pub content: String,
    pub tags: Vec<String>,
    pub processed: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportedPdf {
    pub filename: String,
    pub title: String,
    pub reading_path: String,
    pub attachment_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndexStats {
    pub notes_indexed: u32,
    pub duration_ms: u64,
}
