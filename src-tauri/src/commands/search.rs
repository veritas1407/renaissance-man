use tauri::State;

use crate::models::{ConceptEdge, IndexStats, SearchResult};
use crate::AppState;

#[tauri::command]
pub async fn search_fts(
    state: State<'_, AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let _vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let db_lock = state.db.lock().unwrap();
    let conn = db_lock.as_ref().ok_or("DB not open")?;

    let n = limit.unwrap_or(8) as i64;
    let fts_query = format!("{query}*"); // prefix search

    let mut stmt = conn
        .prepare(
            "SELECT vault_path, title, snippet(notes_fts, 2, '<b>', '</b>', '…', 32) as excerpt
             FROM notes_fts
             WHERE notes_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![fts_query, n], |r| {
            Ok(SearchResult {
                path: r.get(0)?,
                title: r.get(1)?,
                excerpt: r.get(2)?,
                score: 1.0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub async fn search_semantic(
    state: State<'_, AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;
    let n = limit.unwrap_or(8) as usize;
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    // No embedder on mobile — empty result makes the frontend fall back to FTS.
    #[cfg(mobile)]
    {
        let _ = (vault, n);
        Ok(vec![])
    }

    #[cfg(desktop)]
    {
        // Embed the query (lock the model only for this), then release it before the DB.
        let qvec = {
            let mut emb = state.embedder.lock().unwrap();
            if !crate::db::embed::ensure_loaded(&mut emb, &vault) {
                return Ok(vec![]); // model unavailable → frontend falls back to FTS
            }
            match crate::db::embed::embed_query(emb.as_ref().unwrap(), &query) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("[semantic] query embed failed: {e:#}");
                    return Ok(vec![]);
                }
            }
        };

        let db_lock = state.db.lock().unwrap();
        let conn = db_lock.as_ref().ok_or("DB not open")?;
        crate::db::embed::cosine_topk(conn, &qvec, None, n).map_err(|e| e.to_string())
    }
}

/// Nearest captures/notes to a piece of text — powers dedup at capture time
/// ("you've already noted something like this").
#[tauri::command]
pub async fn find_similar(
    state: State<'_, AppState>,
    text: String,
    limit: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;
    let n = limit.unwrap_or(3) as usize;
    if text.trim().is_empty() {
        return Ok(vec![]);
    }

    // No embedder on mobile — dedup-at-capture quietly does nothing.
    #[cfg(mobile)]
    {
        let _ = (vault, n);
        Ok(vec![])
    }

    #[cfg(desktop)]
    {
        let qvec = {
            let mut emb = state.embedder.lock().unwrap();
            if !crate::db::embed::ensure_loaded(&mut emb, &vault) {
                return Ok(vec![]);
            }
            match crate::db::embed::embed_query(emb.as_ref().unwrap(), &text) {
                Ok(v) => v,
                Err(_) => return Ok(vec![]),
            }
        };

        let db_lock = state.db.lock().unwrap();
        let conn = db_lock.as_ref().ok_or("DB not open")?;
        let kinds: &[&str] = &["capture", "note"];
        crate::db::embed::cosine_topk(conn, &qvec, Some(kinds), n).map_err(|e| e.to_string())
    }
}

/// Return note pairs whose embeddings are semantically close (cosine >= threshold).
/// Powers the concept-edge lines in the Atlas concept layer.
#[tauri::command]
pub async fn get_concept_edges(
    state: State<'_, AppState>,
    threshold: Option<f32>,
) -> Result<Vec<ConceptEdge>, String> {
    let t = threshold.unwrap_or(0.65);
    let db_lock = state.db.lock().unwrap();
    let conn = db_lock.as_ref().ok_or("DB not open")?;
    let pairs =
        crate::db::embed::concept_edges(conn, t, 150).map_err(|e| e.to_string())?;
    Ok(pairs
        .into_iter()
        .map(|(a, b, s)| ConceptEdge {
            path_a: a,
            path_b: b,
            score: s,
            bridged: false,
        })
        .collect())
}

#[tauri::command]
pub async fn rebuild_index(state: State<'_, AppState>) -> Result<IndexStats, String> {
    let vault = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault open")?;

    let start = std::time::Instant::now();

    let count = {
        let db_lock = state.db.lock().unwrap();
        let conn = db_lock.as_ref().ok_or("DB not open")?;
        crate::db::ingest::full_ingest(conn, &vault).map_err(|e| e.to_string())?
    };

    // Best-effort embedding refresh (only changed notes re-embed). Acquire the model
    // lock before the DB lock — the same order the startup embed pass uses.
    #[cfg(desktop)]
    {
        let mut emb = state.embedder.lock().unwrap();
        if crate::db::embed::ensure_loaded(&mut emb, &vault) {
            if let Some(model) = emb.as_ref() {
                let db_lock = state.db.lock().unwrap();
                if let Some(conn) = db_lock.as_ref() {
                    if let Err(e) = crate::db::embed::embed_pass(conn, &vault, model) {
                        eprintln!("[semantic] embed pass failed: {e:#}");
                    }
                }
            }
        }
    }

    Ok(IndexStats {
        notes_indexed: count,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}
