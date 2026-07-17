# ROADMAP.md — Renaissance Man

> Rebuilt from first principles against VISION.md. Sequenced by primitive → loops → mentor → decades.
> Supersedes the phase lists in BLUEPRINT-V2.md (which remains the design-history record).

---

## 0. The audit — every existing feature judged against the canon

**Verdict key:** ✦ keep (canonical) · ⟳ merge/refit · ✕ remove/retire

| Feature (as shipped, v0.1.17) | Verdict | Ruling |
|---|---|---|
| Capture inbox + triage | ✦ | Zero-friction capture is law. Triage gains "claim by a thread/pursuit." |
| Resume card / pick-one-thing | ✦ | Right mechanism; climbs altitude — prefers threads/pursuits over raw objects. |
| Threshold fold ("one thing first") | ✦ | The First Law made visible. |
| Threads (seal/rekindle, one-ask budget) | ✦ | The inquiry altitude. Gains `pursuit:` parentage. |
| Goals (mastery/numeric/habit) + forge | ⟳ | Stay as the practical ladder, but each goal states its **becoming** and may claim a pursuit. |
| Reading room (shelf, PDF, zoom, light) | ✦ | Core. Next: text layer → effortless highlight→why. |
| Highlights + Mnemosyne veil | ✦ | Retrieval-first is the testing effect; untouchable. |
| Bridges / find-similar | ✦ | The elaboration engine; stays within the one-ask budget. |
| The Study (room VII) | ⟳ | Kept — production is sacred (generation effect) — but it is the *scriptorium*, not a second task board. Duplication watched. |
| Tasks (add/edit/reorder/carry) | ✦ | One canonical home (Journal/tasks); mirrors are views. |
| Cabinet wishbook + wish→star | ✦ | Correct as-is; the Mirror-of-Erised law (resurface one wish in season, never dwell) holds. |
| Training table + feats | ✦ | The body is a pursuit like any other. |
| Feats vs Works vs attained wishes | ⟳ | One accomplishment model (the Exhibition ledger) with three lenses; implement as one loader, one schema view. |
| Observatory mirrors (weekly/season/letter) | ✦ | The temporal mirror; the product's soul at year-scale. |
| Depth ledger | ✦ | The honest shape of the mind; feeds the pursuit view. |
| Atlas (constellations, threads-in-sky, concept layer) | ✦ | Becomes the autobiography; organizes by pursuit next. |
| Command palette (⌘P) | ✦ | Becomes the *single* seek surface. |
| Global search bar + per-room searches | ⟳ | Fold into the palette progressively; room searches remain as scoped filters only. |
| Canon quotes (daily per room) | ⟳ | Commonplace inversion: owner's kept lines lead; canon only at thresholds (seasons, letters). Daily canon rotation retires. |
| Day/night theme | ✦ | Kept, with parity discipline. |
| 3D vestibule (dormant) | ✕ | Delete from the tree; the palace is plates, not a game level. Kept only in git history. |
| Demo/seed data paths in rooms | ✕ | Real vault always wins; demo code retires as each room is touched. |
| Android pocket codex + ferry | ✦ | The same vault in the hand; parity follows desktop. |
| MSI bundle | ✕ | NSIS is canonical; stop building/shipping MSI. |

## 1. Now — the Becoming layer (the missing altitude)

*The single change that turns a beautiful vault into an operating system for becoming.*

- `Pursuits/` kind: *"Become an AI product leader," "Understand physics," "Master the body."* Fields: title-as-identity, why, state (burning/steady/fallow/fulfilled), opened.
- Threads, goals, works, readings gain an optional `pursuit:` claim; triage and forges offer it in one gesture (never mandatory — orphan material is legitimate).
- **The Threshold speaks identity:** the scribe frames the one thing by its pursuit ("*Toward the product craft* — you left Cagan mid-way").
- **The Atlas gains the pursuit lens:** constellations grouped by pursuit; the sky readable as "the five things I am becoming."
- The forge asks the identity question first: *who does this make you?*

## 2. Next — frictionless keeping

- **PDF text layer**: select → "why did this matter?" at the selection; the highlight loop at zero marginal cost. (The largest single unlock in the backlog.)
- Highlight anchors robust across zoom/re-layout (page + quote).
- Keyboard map (`?`) and the gold focus ring pass.

## 3. Then — the Mentor (Phase H, behind the gate)

Build the gate first, then the intelligence — in this order, permanently:

1. `Proposals/` schema + quarantine enforcement in the Rust layer (no agent write path to human folders).
2. Orphan-thread detection ("these five captures look like one unnamed thread — name it?").
3. **Gap detection** per pursuit (all secondary sources; no production in domain X; a question with no next probe).
4. **Curriculum proposals**: ordered paths (read → make → test) for a pursuit; adopted only by the owner writing rungs in their own words.
5. Pattern-naming-as-questions; cross-domain structural echoes (shared structure stated, per Gentner).
6. The Observatory gains one mentor question per week, ranked into the existing one-ask budget.

## 4. Later — the mirror at full depth

- The sky-as-autobiography: seasons/years as strata; named constellations permanent; ghosts (dissolved threads) faint near the horizon.
- The Exhibition unified (works/feats/attained as one ledger, three lenses).
- Seasonal atmosphere at full subtlety; the annual letter ritual polished.
- Position-history view per thread: the dated record of a changing mind, readable as a page.

## 5. The long craft (years, unhurried)

- Voice capture → inbox (mobile-first).
- Handwriting/photo capture of notebooks.
- Import bridges (Kindle highlights, browser read-later) — material flows in, laws unchanged.
- Performance and layering for ten-thousand-file vaults; yearly Atlas strata.
- The thirty-year archive discipline: yearly vault format review, zero breaking schema changes, the export ferry as eternal format.

## 6. Explicitly rejected (so they stay rejected)

- Chat interface / conversational OS · walkable 3D palace · streaks, points, XP, leaderboards · social/sharing/feeds · cloud accounts as a requirement · AI-written notes, summaries, or positions (Quick-Quotes Quill law) · push notifications of any kind (Howler law) · an eighth room without retiring one.

## The measure of every release

1. Did re-entry get cheaper?
2. Did keeping get closer to free?
3. Did the mirror get more honest?
4. Did the owner produce more in their own words?
5. Would it still matter in thirty years?

If a change advances none of these, it does not ship.
