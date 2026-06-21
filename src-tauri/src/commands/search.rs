use tauri::State;

use crate::models::{IndexStats, SearchResult};
use crate::AppState;

#[tauri::command]
pub async fn search_fts(
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
    _state: State<'_, AppState>,
    query: String,
    _limit: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    // Phase 1 stub — MiniLM/ONNX integration ships in Phase 5.
    // Returns empty so the frontend degrades gracefully to FTS only.
    let _ = query;
    Ok(vec![])
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

    let db_lock = state.db.lock().unwrap();
    let conn = db_lock.as_ref().ok_or("DB not open")?;

    let count = crate::db::ingest::full_ingest(conn, &vault).map_err(|e| e.to_string())?;

    Ok(IndexStats {
        notes_indexed: count,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}
