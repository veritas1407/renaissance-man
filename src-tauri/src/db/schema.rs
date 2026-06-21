use anyhow::Result;
use rusqlite::Connection;

pub const CURRENT_VERSION: u32 = 1;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let version: u32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(0);

    if version < 1 {
        conn.execute_batch(MIGRATION_1)?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_VERSION}"))?;
    }

    Ok(())
}

const MIGRATION_1: &str = "
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS readings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path   TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    author       TEXT,
    status       TEXT NOT NULL DEFAULT 'reading',
    attachment   TEXT,
    last_position REAL DEFAULT 0.0,
    last_opened  TEXT,
    why          TEXT,
    temp         TEXT DEFAULT 'warm',
    last_touched TEXT,
    modified_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS highlights (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id   INTEGER NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
    text         TEXT NOT NULL,
    why          TEXT,
    page         INTEGER,
    char_start   INTEGER,
    char_end     INTEGER,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path   TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    domain       TEXT,
    temp         TEXT DEFAULT 'warm',
    last_touched TEXT,
    atlas_ra     REAL,
    atlas_dec    REAL,
    modified_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rungs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    consume_desc TEXT,
    produce_desc TEXT,
    done_when    TEXT,
    state        TEXT NOT NULL DEFAULT 'future',
    sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bucket (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path   TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    category     TEXT,
    cost         TEXT,
    effort       TEXT,
    season       TEXT,
    attained     INTEGER NOT NULL DEFAULT 0,
    attained_at  TEXT,
    modified_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captures (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_path   TEXT UNIQUE NOT NULL,
    kind         TEXT NOT NULL,
    content      TEXT NOT NULL,
    tags         TEXT,
    processed    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id   INTEGER REFERENCES readings(id),
    event_type   TEXT NOT NULL,
    scroll_pos   REAL,
    recorded_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reentry_weekly (
    week_start       TEXT PRIMARY KEY,
    sessions_total   INTEGER DEFAULT 0,
    sessions_resume  INTEGER DEFAULT 0
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    vault_path UNINDEXED,
    title,
    body,
    content=''
);

CREATE INDEX IF NOT EXISTS idx_readings_temp ON readings(temp);
CREATE INDEX IF NOT EXISTS idx_readings_last_touched ON readings(last_touched);
CREATE INDEX IF NOT EXISTS idx_goals_temp ON goals(temp);
CREATE INDEX IF NOT EXISTS idx_goals_domain ON goals(domain);
CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed);
CREATE INDEX IF NOT EXISTS idx_sessions_reading ON sessions(reading_id);
";
