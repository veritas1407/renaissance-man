# ARCHITECTURE.md — Renaissance Man

> How it is built, and why. Derives from VISION.md. Architecture serves the experience; where it cannot, the architecture changes, not the vision.

---

## 1. Technical philosophy

1. **Files are truth; everything else is cache.** The vault is plain Markdown + YAML frontmatter in folders the owner controls. Obsidian and Renaissance Man are two windows onto the same folder. Every database, vector, and queue is derived and rebuildable; no feature may depend on the cache existing.
2. **Thirty-year durability beats five-year convenience.** No proprietary formats, no lock-in, no cloud dependency for core function. The vault must remain fully legible in a plain text editor after every app — including this one — is dead.
3. **Local-first, sovereignty always.** All content and all inference-over-content stays on the owner's machines by default. Anything that leaves the machine does so explicitly, visibly, and revocably.
4. **Simplicity is a feature of decades.** Dependency-light frontend (vanilla JS modules, no build step), a boring Rust core, SQLite. Every dependency is a bet that must survive ten years; take few.
5. **The gate is structural.** AI autonomy ends at the vault boundary by *architecture* (write paths that only reach `Proposals/`), never by prompt or policy.

## 2. System shape

```
┌────────────────────────── Tauri shell ─────────────────────────┐
│  WebView (no-build frontend)                                   │
│   index.html (HTML+CSS) · js/app/codex.js (rooms, classic)     │
│   js/app/vault.js (Bridge + loaders, module) · js/lib/*        │
│                    │  invoke (camelCase args)                  │
│  Rust core (src-tauri)                                         │
│   commands/  vault I/O · capture · pdf · search · stats ·      │
│              transfer                                          │
│   vault/     frontmatter parse/write (atomic), structure       │
│   db/        SQLite cache · FTS5 · embeddings (MiniLM/ONNX,    │
│              desktop) · ingest · schema migrations             │
│   rm-asset://  streams vault files (percent-decoded, guarded)  │
└────────────────────────────────────────────────────────────────┘
         ▼ reads/writes                    ▼ derived only
   RenaissanceVault/ (Markdown)      .renaissance/index.sqlite
```

- **Frontend:** the codex is HTML+CSS (`index.html`, ~2.4k lines) plus two real script files (v0.1.17 split). Further splitting happens opportunistically: when a room is reworked, its logic moves to `js/rooms/<room>.js`. No framework, no bundler — portability into any webview for decades.
- **Rust core:** thin, synchronous-feeling commands over the vault; atomic writes (`write_note_atomic`); background ingest + embed passes that never block the UI; house-elf work (watching, indexing, pruning) silent and unannounced.
- **Mobile:** the same vault, same frontend, `fastembed` desktop-only (mobile degrades to FTS); the ferry (zip import/export) moves the vault whole between desk and hand.

## 3. The data model

Folders = kinds; frontmatter = fields; wikilinks + typed fields = edges. Canonical kinds:

| Folder | type | Key fields |
|---|---|---|
| `Pursuits/` | pursuit | title (the becoming), why, state (burning/steady/fallow/fulfilled), opened, season notes |
| `Threads/` | thread | question, gripped, status, dated `position[]`, `sealed[]` capsules, `trail[]`, next_probe, `pursuit:` |
| `Readings/` | reading | title, source/attachment, position, status, why, highlights[], review, `thread:` |
| `Notes/` | note | kind (note/plan/idea/log/daily/synthesis), core claim, review, wikilinks |
| `Goals/` | goal | kind (mastery/numeric/habit), rungs (consume/produce/done/by), metric, temp, `pursuit:` |
| `Works/` | work | kind (essay/experiment/project/taught/code/art), what, domain, sources, `pursuit:` |
| `Bucket/` | bucket | cost/effort/season/status, charted |
| `Body/` | workout/split/library/vitals | lifts, metrics, birthdate |
| `Journal/` | capture/task/weekly/season/letter | inbox, tasks (order), mirrors with review dates |
| `Proposals/` | proposal | kind (thread-naming/gap/curriculum/echo), evidence paths, question, status |

**Schema discipline:** frontmatter stays Obsidian-clean; spaced-repetition state lives in each note's own `review:` block (no scheduling DB); app-only state never corrupts the owner's files; every schema change must be backward-readable (old files never break).

## 4. The knowledge graph

The graph is **derived, materialized, disposable**:

- **Nodes:** every vault file. **Edges:** typed frontmatter references (`pursuit:`, `thread:`, `trail:`, `sources:`), wikilinks, and highlight anchors.
- Ingest walks the vault → SQLite tables (`files`, `edges`, `fts`, `embeddings`). Rebuild-from-zero is always possible and routinely exercised.
- **Semantic layer:** MiniLM (384-d, local, ONNX) embeddings keyed on the *why/question* text first — retrieval feels like a friend remembering reasons, not grepping words. Cosine top-k, dedup by path, hot-set bias (recent + warm first).
- Query surfaces: FTS + semantic merged in one seek; similarity for bridges/orphans; edges for the Atlas and backlinks.

## 5. The AI layer

Three tiers, one gate:

1. **Instruments (shipped):** embeddings, similarity, resurfacing schedules, honest mirrors. Pure functions over the vault; no writes.
2. **The lantern-bearer (next):** background analyses producing **Proposals** — orphan clusters, gaps, curriculum drafts, structural echoes, pattern-naming questions. Local models preferred; a remote model may be used *only* for proposal generation over owner-approved excerpts, never as a dependency.
3. **The gate (permanent):** agents hold write access to `Proposals/` and `.renaissance/` only — enforced in the Rust command layer (there is no code path from agent context into human folders). Adoption is generative: the owner restates a proposal in their own words into their own files; "accept" buttons that copy machine text into human ground are architecturally absent.

## 6. Storage, sync, and durability

- **Vault:** the owner's folder (currently `D:\renaissance`), portable by copy, Git-friendly, Obsidian-shared. `.trash/` inside the vault makes every deletion recoverable; nothing is ever hard-deleted by the app.
- **Sync strategy:** deliberately unbundled. The vault syncs by whatever the owner trusts (Syncthing, Git, drive folder, the ferry zip). The app must stay correct under external edits: mtime-based re-ingest, atomic writes, last-writer-wins at file granularity, no locks.
- **Backups:** the export ferry produces a whole-vault archive; the format *is* the backup format.

## 7. Performance budgets

- Cold start to interactive Threshold: < 1.5s on the owner's hardware; vault ingest never blocks first paint.
- Reading: lazy page render (IntersectionObserver, ±900px), DPR-capped, zoom re-renders preserve scroll; 60fps scroll on a 58MB book.
- Atlas: SVG only, bounded object counts, no per-frame gradient allocation (sprite-cache law stands).
- Search-as-you-type: FTS < 30ms; semantic < 300ms warm.
- Embedding/ingest passes: background, incremental (hash-skip unchanged), quiet.

## 8. Scalability (in time, not users)

The scaling axis is *decades of one life*: tens of thousands of files, one sky. Plans: yearly Atlas layering (constellations group by year/season), archive tiers for cold files (still plain files), FTS + vectors partitioned hot/cold, and UI virtualization only when real vaults demand it. Never sharding, never servers: one mind fits on one disk, forever.
