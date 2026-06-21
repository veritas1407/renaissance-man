use tauri::State;

use crate::AppState;

#[tauri::command]
pub async fn log_session_event(
    state: State<'_, AppState>,
    event_type: String,
    reading_path: String,
    scroll_position: f64,
) -> Result<(), String> {
    let db_lock = state.db.lock().unwrap();
    let conn = db_lock.as_ref().ok_or("DB not open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Look up reading_id
    let reading_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM readings WHERE vault_path = ?1",
            [&reading_path],
            |r| r.get(0),
        )
        .ok();

    conn.execute(
        "INSERT INTO sessions (reading_id, event_type, scroll_pos, recorded_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![reading_id, event_type, scroll_position, now],
    )
    .map_err(|e| e.to_string())?;

    // Update reentry_weekly if this is a resume
    if event_type == "resume" || event_type == "start" {
        let week_start = {
            use chrono::{Datelike, Utc};
            let today = Utc::now().naive_utc().date();
            let days_since_monday = today.weekday().num_days_from_monday() as i64;
            (today - chrono::Duration::days(days_since_monday))
                .format("%Y-%m-%d")
                .to_string()
        };

        conn.execute(
            "INSERT INTO reentry_weekly (week_start, sessions_total, sessions_resume)
             VALUES (?1, 1, ?2)
             ON CONFLICT(week_start) DO UPDATE SET
               sessions_total  = sessions_total + 1,
               sessions_resume = sessions_resume + ?2",
            rusqlite::params![
                week_start,
                if event_type == "resume" { 1i64 } else { 0i64 }
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_reentry_rate(
    state: State<'_, AppState>,
    days: Option<u32>,
) -> Result<f64, String> {
    let db_lock = state.db.lock().unwrap();
    let conn = db_lock.as_ref().ok_or("DB not open")?;

    let window_days = days.unwrap_or(30) as i64;
    let since = (chrono::Utc::now() - chrono::Duration::days(window_days)).to_rfc3339();

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sessions WHERE event_type IN ('start','resume') AND recorded_at >= ?1",
            [&since],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if total == 0 {
        return Ok(0.0);
    }

    let resumes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sessions WHERE event_type = 'resume' AND recorded_at >= ?1",
            [&since],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok((resumes as f64 / total as f64) * 100.0)
}
