//! Semantic-memory layer — MiniLM embeddings over the vault.
//!
//! Vectors live ONLY in the `.renaissance` SQLite cache (the `embeddings` table),
//! never in the Markdown, so Obsidian stays clean and the whole index rebuilds from
//! the files. Per CLAUDE.md §5 the retrieval key is the `why` sentence, so embedded
//! text leads with `why`; and we embed **once** — a `source_hash` lets every later
//! pass skip unchanged notes.

use anyhow::Result;
#[cfg(desktop)]
use anyhow::Context;
#[cfg(desktop)]
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use rusqlite::Connection;
#[cfg(desktop)]
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
#[cfg(desktop)]
use std::collections::HashSet;
#[cfg(desktop)]
use std::hash::{Hash, Hasher};
#[cfg(desktop)]
use std::path::Path;
#[cfg(desktop)]
use walkdir::WalkDir;

use crate::models::SearchResult;
#[cfg(desktop)]
use crate::vault::frontmatter;

/// Identifier stored alongside each vector so a model change can invalidate the cache.
pub const MODEL_ID: &str = "all-MiniLM-L6-v2";

/// Load MiniLM, caching weights under `vault/.renaissance/models`. The first call
/// needs the network once; afterwards it loads from disk and runs fully offline.
#[cfg(desktop)]
pub fn load_model(vault: &Path) -> Result<TextEmbedding> {
    let cache_dir = vault.join(".renaissance").join("models");
    std::fs::create_dir_all(&cache_dir).ok();
    let opts = InitOptions::new(EmbeddingModel::AllMiniLML6V2)
        .with_cache_dir(cache_dir)
        .with_show_download_progress(true);
    TextEmbedding::try_new(opts).context("load embedding model")
}

/// Lazily fill the shared model slot. Returns false (and logs) if loading failed, so
/// callers can degrade to FTS instead of erroring.
#[cfg(desktop)]
pub fn ensure_loaded(slot: &mut Option<TextEmbedding>, vault: &Path) -> bool {
    if slot.is_some() {
        return true;
    }
    match load_model(vault) {
        Ok(m) => {
            *slot = Some(m);
            true
        }
        Err(e) => {
            eprintln!("[embed] model load failed (search falls back to FTS): {e:#}");
            false
        }
    }
}

#[cfg(desktop)]
pub fn embed_query(model: &TextEmbedding, text: &str) -> Result<Vec<f32>> {
    let mut v = model.embed(vec![text], None)?;
    Ok(v.pop().unwrap_or_default())
}

#[cfg(desktop)]
struct Item {
    ref_id: String,
    vault_path: String,
    kind: String,
    title: String,
    snippet: String,
    text: String,
}

#[cfg(desktop)]
fn hash_text(s: &str) -> String {
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    format!("{:016x}", h.finish())
}

#[cfg(desktop)]
fn vec_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for f in v {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}

pub fn bytes_to_vec(b: &[u8]) -> Vec<f32> {
    b.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

#[cfg(desktop)]
fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        s.chars().take(n).collect()
    }
}

#[cfg(desktop)]
fn join_parts(parts: &[&str]) -> String {
    parts
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join(" — ")
}

/// Build a note-level embedding item, leading with `why` (the retrieval key).
#[cfg(desktop)]
fn note_item(rel: &str, kind: &str, fm: &serde_json::Value, body: &str) -> Option<Item> {
    let get = |k: &str| fm.get(k).and_then(|v| v.as_str()).unwrap_or("");
    let title = {
        let t = get("title");
        if t.is_empty() {
            rel.rsplit('/').next().unwrap_or(rel).trim_end_matches(".md").to_string()
        } else {
            t.to_string()
        }
    };
    let why = get("why");
    let body_excerpt = truncate(body.trim(), 400);

    let (text, snippet) = match kind {
        "reading" => (
            join_parts(&[why, &title, &body_excerpt]),
            if why.is_empty() { title.clone() } else { why.to_string() },
        ),
        "goal" => {
            let rungs = fm
                .get("rungs")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|r| r.get("t").and_then(|v| v.as_str()))
                        .collect::<Vec<_>>()
                        .join("; ")
                })
                .unwrap_or_default();
            (
                join_parts(&[why, &title, &rungs]),
                if why.is_empty() { title.clone() } else { why.to_string() },
            )
        }
        "synthesis" => {
            let connection = get("connection");
            let why_text = get("why");
            let key = if !connection.is_empty() { connection } else { why_text };
            (
                join_parts(&[key, &body_excerpt]),
                if key.is_empty() { title.clone() } else { truncate(key, 120) },
            )
        }
        "thread" => {
            let question = get("question");
            let gripped = get("gripped");
            let probe = get("next_probe");
            (
                join_parts(&[question, gripped, probe]),
                if question.is_empty() { title.clone() } else { truncate(question, 120) },
            )
        }
        "bucket" => (join_parts(&[&title, get("domain")]), title.clone()),
        "capture" => {
            let txt = get("text");
            (txt.to_string(), truncate(txt, 120))
        }
        _ => (
            join_parts(&[&title, &body_excerpt]),
            if body_excerpt.is_empty() { title.clone() } else { truncate(&body_excerpt, 120) },
        ),
    };

    let text = text.trim().to_string();
    if text.is_empty() {
        return None;
    }
    Some(Item {
        ref_id: rel.to_string(),
        vault_path: rel.to_string(),
        kind: kind.to_string(),
        title,
        snippet,
        text,
    })
}

/// Build an embedding item for a single highlight (quote + its `why`).
#[cfg(desktop)]
fn highlight_item(rel: &str, fm: &serde_json::Value, h: &serde_json::Value, i: usize) -> Option<Item> {
    let why = h.get("why").and_then(|v| v.as_str()).unwrap_or("");
    let quote = h
        .get("anchor")
        .and_then(|a| a.get("quote"))
        .and_then(|v| v.as_str())
        .or_else(|| h.get("quote").and_then(|v| v.as_str()))
        .unwrap_or("");
    let text = join_parts(&[why, quote]);
    if text.is_empty() {
        return None;
    }
    let owner = fm.get("title").and_then(|v| v.as_str()).unwrap_or(rel);
    Some(Item {
        ref_id: format!("{rel}#h{i}"),
        vault_path: rel.to_string(),
        kind: "highlight".to_string(),
        title: format!("“{}” — {}", truncate(quote, 60), owner),
        snippet: if why.is_empty() { truncate(quote, 120) } else { why.to_string() },
        text,
    })
}

/// Embed every note (and highlight) whose text changed since last time, then drop
/// vectors for files that no longer exist. Returns the number (re)embedded.
#[cfg(desktop)]
pub fn embed_pass(conn: &Connection, vault: &Path, model: &TextEmbedding) -> Result<usize> {
    // 1 · gather candidate items from the live vault
    let mut items: Vec<Item> = Vec::new();
    let mut live: HashSet<String> = HashSet::new();

    for entry in WalkDir::new(vault)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path().extension().map(|x| x == "md").unwrap_or(false)
                && !e.path().components().any(|c| c.as_os_str() == ".renaissance")
        })
    {
        let content = match std::fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let note = match frontmatter::parse_note(&content) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let rel = entry
            .path()
            .strip_prefix(vault)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let fm = &note.frontmatter;
        let kind = fm.get("type").and_then(|v| v.as_str()).unwrap_or("note").to_string();

        // config / log files are not "memory" — skip them
        if matches!(kind.as_str(), "exercise-library" | "split" | "workout") {
            continue;
        }

        if let Some(it) = note_item(&rel, &kind, fm, &note.body) {
            live.insert(it.ref_id.clone());
            items.push(it);
        }
        if let Some(hls) = fm.get("highlights").and_then(|v| v.as_array()) {
            for (i, h) in hls.iter().enumerate() {
                if let Some(it) = highlight_item(&rel, fm, h, i) {
                    live.insert(it.ref_id.clone());
                    items.push(it);
                }
            }
        }
    }

    // 2 · keep only items whose content changed (embed once, never on a loop)
    let mut todo: Vec<usize> = Vec::new();
    for (idx, it) in items.iter().enumerate() {
        let h = hash_text(&it.text);
        let existing: Option<String> = conn
            .query_row(
                "SELECT source_hash FROM embeddings WHERE ref_id = ?1",
                [&it.ref_id],
                |r| r.get(0),
            )
            .ok();
        if existing.as_deref() != Some(h.as_str()) {
            todo.push(idx);
        }
    }

    // 3 · batch-embed the changed ones and upsert
    let mut embedded = 0usize;
    if !todo.is_empty() {
        let texts: Vec<&str> = todo.iter().map(|&i| items[i].text.as_str()).collect();
        let vecs = model.embed(texts, None)?;
        let now = chrono::Utc::now().to_rfc3339();
        for (k, &i) in todo.iter().enumerate() {
            let it = &items[i];
            let v = &vecs[k];
            conn.execute(
                "INSERT OR REPLACE INTO embeddings
                 (ref_id, vault_path, kind, title, snippet, source_hash, dim, vec, model, embedded_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                rusqlite::params![
                    it.ref_id,
                    it.vault_path,
                    it.kind,
                    it.title,
                    it.snippet,
                    hash_text(&it.text),
                    v.len() as i64,
                    vec_to_bytes(v),
                    MODEL_ID,
                    now
                ],
            )?;
            embedded += 1;
        }
    }

    // 4 · prune vectors whose source file/highlight is gone
    let stored: Vec<String> = {
        let mut stmt = conn.prepare("SELECT ref_id FROM embeddings")?;
        let rows: Vec<String> = stmt
            .query_map([], |r| r.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };
    for ref_id in stored {
        if !live.contains(&ref_id) {
            conn.execute("DELETE FROM embeddings WHERE ref_id = ?1", [&ref_id])?;
        }
    }

    Ok(embedded)
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

/// Brute-force cosine nearest-neighbours (vectors are L2-normalized, so dot = cosine).
/// Dedups by `vault_path`, keeping the best-scoring vector per note.
pub fn cosine_topk(
    conn: &Connection,
    query: &[f32],
    kinds: Option<&[&str]>,
    n: usize,
) -> Result<Vec<SearchResult>> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt = conn.prepare("SELECT vault_path, title, snippet, kind, vec FROM embeddings")?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, Option<String>>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, Vec<u8>>(4)?,
        ))
    })?;

    // path -> (score, title, snippet)
    let mut best: HashMap<String, (f64, String, String)> = HashMap::new();
    for row in rows {
        let (path, title, snippet, kind, blob) = match row {
            Ok(x) => x,
            Err(_) => continue,
        };
        if let Some(ks) = kinds {
            if !ks.contains(&kind.as_str()) {
                continue;
            }
        }
        let v = bytes_to_vec(&blob);
        if v.len() != query.len() {
            continue;
        }
        let score = dot(query, &v) as f64;
        let entry = best.entry(path).or_insert((f64::MIN, String::new(), String::new()));
        if score > entry.0 {
            *entry = (score, title.unwrap_or_default(), snippet.unwrap_or_default());
        }
    }

    let mut results: Vec<SearchResult> = best
        .into_iter()
        .map(|(path, (score, title, snippet))| SearchResult {
            path,
            title,
            excerpt: snippet,
            score,
        })
        .collect();
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(n);
    Ok(results)
}

/// Return all note-level embedding pairs with cosine similarity >= threshold.
/// Vectors are L2-normalised so dot product = cosine. Max `max_pairs` returned.
pub fn concept_edges(
    conn: &Connection,
    threshold: f32,
    max_pairs: usize,
) -> Result<Vec<(String, String, f32)>> {
    let rows: Vec<(String, Vec<u8>)> = {
        let mut stmt = conn.prepare(
            "SELECT ref_id, vec FROM embeddings \
             WHERE kind IN ('note','synthesis') AND ref_id NOT LIKE '%#h%' \
             ORDER BY embedded_at",
        )?;
        let collected: Vec<(String, Vec<u8>)> = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?)))?
            .filter_map(|r| r.ok())
            .collect();
        collected
    };

    let vecs: Vec<Vec<f32>> = rows.iter().map(|(_, b)| bytes_to_vec(b)).collect();
    let n = rows.len();
    let mut pairs: Vec<(String, String, f32)> = Vec::new();
    'outer: for i in 0..n {
        for j in (i + 1)..n {
            if vecs[i].len() != vecs[j].len() {
                continue;
            }
            let s = dot(&vecs[i], &vecs[j]);
            if s >= threshold {
                pairs.push((rows[i].0.clone(), rows[j].0.clone(), s));
                if pairs.len() >= max_pairs {
                    break 'outer;
                }
            }
        }
    }
    Ok(pairs)
}
