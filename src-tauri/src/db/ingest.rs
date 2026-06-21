use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use walkdir::WalkDir;

use crate::vault::frontmatter;

/// Full vault re-index. Upserts every .md file into appropriate tables.
/// Safe to re-run — uses UPSERT (INSERT OR REPLACE).
pub fn full_ingest(conn: &Connection, vault: &Path) -> Result<u32> {
    let mut count = 0u32;

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
        let content = std::fs::read_to_string(entry.path())?;
        let note = match frontmatter::parse_note(&content) {
            Ok(n) => n,
            Err(_) => continue,
        };

        let rel_path = entry
            .path()
            .strip_prefix(vault)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();

        let kind = note
            .frontmatter
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("note")
            .to_string();

        let now = chrono::Utc::now().to_rfc3339();
        let modified_at = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| {
                chrono::DateTime::<chrono::Utc>::from(t)
                    .to_rfc3339()
                    .into()
            })
            .unwrap_or_else(|| now.clone());

        match kind.as_str() {
            "reading" => ingest_reading(conn, &rel_path, &note.frontmatter, &modified_at)?,
            "goal" => ingest_goal(conn, &rel_path, &note.frontmatter, &modified_at)?,
            "bucket" => ingest_bucket(conn, &rel_path, &note.frontmatter, &modified_at)?,
            "capture" => ingest_capture(conn, &rel_path, &note.frontmatter, &modified_at)?,
            _ => {}
        }

        // FTS index every file regardless of type
        upsert_fts(conn, &rel_path, &note.frontmatter, &note.body)?;

        count += 1;
    }

    Ok(count)
}

fn ingest_reading(
    conn: &Connection,
    path: &str,
    fm: &serde_json::Value,
    modified_at: &str,
) -> Result<()> {
    let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or(path);
    let author = fm.get("author").and_then(|v| v.as_str());
    let status = fm.get("status").and_then(|v| v.as_str()).unwrap_or("reading");
    let attachment = fm.get("attachment").and_then(|v| v.as_str());
    let last_pos = fm
        .get("position")
        .and_then(|p| p.get("percent"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let why = fm.get("why").and_then(|v| v.as_str());
    let temp = fm.get("temp").and_then(|v| v.as_str()).unwrap_or("warm");
    let last_touched = fm
        .get("last_touched")
        .and_then(|v| v.as_str())
        .or_else(|| fm.get("added").and_then(|v| v.as_str()));

    conn.execute(
        "INSERT OR REPLACE INTO readings
         (vault_path, title, author, status, attachment, last_position, why, temp, last_touched, modified_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        rusqlite::params![
            path, title, author, status, attachment, last_pos, why, temp, last_touched, modified_at
        ],
    )?;
    Ok(())
}

fn ingest_goal(
    conn: &Connection,
    path: &str,
    fm: &serde_json::Value,
    modified_at: &str,
) -> Result<()> {
    let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or(path);
    let domain = fm.get("domain").and_then(|v| v.as_str());
    let temp = fm.get("temp").and_then(|v| v.as_str()).unwrap_or("warm");
    let last_touched = fm.get("last_touched").and_then(|v| v.as_str());
    let ra = fm
        .get("atlas_position")
        .and_then(|p| p.get("ra"))
        .and_then(|v| v.as_f64());
    let dec = fm
        .get("atlas_position")
        .and_then(|p| p.get("dec"))
        .and_then(|v| v.as_f64());

    conn.execute(
        "INSERT OR REPLACE INTO goals
         (vault_path, title, domain, temp, last_touched, atlas_ra, atlas_dec, modified_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        rusqlite::params![path, title, domain, temp, last_touched, ra, dec, modified_at],
    )?;

    // Sync rungs
    if let Some(rungs) = fm.get("rungs").and_then(|v| v.as_array()) {
        let goal_id: i64 = conn.query_row(
            "SELECT id FROM goals WHERE vault_path = ?1",
            [path],
            |r| r.get(0),
        )?;

        conn.execute("DELETE FROM rungs WHERE goal_id = ?1", [goal_id])?;

        for (i, rung) in rungs.iter().enumerate() {
            let label = rung.get("t").and_then(|v| v.as_str()).unwrap_or("");
            let consume = rung.get("consume").and_then(|v| v.as_str());
            let produce = rung.get("produce").and_then(|v| v.as_str());
            let done_when = rung.get("done").and_then(|v| v.as_str());
            let complete = rung
                .get("complete")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let state = if complete { "done" } else { "future" };

            conn.execute(
                "INSERT INTO rungs (goal_id, label, consume_desc, produce_desc, done_when, state, sort_order)
                 VALUES (?1,?2,?3,?4,?5,?6,?7)",
                rusqlite::params![goal_id, label, consume, produce, done_when, state, i as i64],
            )?;
        }
    }

    Ok(())
}

fn ingest_bucket(
    conn: &Connection,
    path: &str,
    fm: &serde_json::Value,
    modified_at: &str,
) -> Result<()> {
    let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or(path);
    let category = fm.get("domain").and_then(|v| v.as_str());
    let cost = fm.get("cost").and_then(|v| v.as_str());
    let effort = fm.get("effort").and_then(|v| v.as_str());
    let season = fm.get("season").and_then(|v| v.as_str());
    let attained = fm
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| if s == "attained" { 1i64 } else { 0i64 })
        .unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO bucket
         (vault_path, title, category, cost, effort, season, attained, modified_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        rusqlite::params![path, title, category, cost, effort, season, attained, modified_at],
    )?;
    Ok(())
}

fn ingest_capture(
    conn: &Connection,
    path: &str,
    fm: &serde_json::Value,
    modified_at: &str,
) -> Result<()> {
    let kind = fm.get("kind").and_then(|v| v.as_str()).unwrap_or("note");
    let content = fm.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let processed = fm
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| if s == "sorted" { 1i64 } else { 0i64 })
        .unwrap_or(0);
    let created_at = fm
        .get("created")
        .and_then(|v| v.as_str())
        .unwrap_or(modified_at);

    conn.execute(
        "INSERT OR REPLACE INTO captures (vault_path, kind, content, processed, created_at)
         VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![path, kind, content, processed, created_at],
    )?;
    Ok(())
}

fn upsert_fts(
    conn: &Connection,
    path: &str,
    fm: &serde_json::Value,
    body: &str,
) -> Result<()> {
    let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or("");
    conn.execute(
        "INSERT OR REPLACE INTO notes_fts (vault_path, title, body) VALUES (?1,?2,?3)",
        rusqlite::params![path, title, body],
    )?;
    Ok(())
}
