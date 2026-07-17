# PRODUCT.md — Renaissance Man

> What gets built, for whom, and in what order. Derives from VISION.md.

---

## 1. The owner (target audience)

One archetype, held precisely:

- **Ambitious and multidisciplinary** — running several serious pursuits at once (a career craft, one or more intellectual obsessions, the body, creative work).
- **Rotation-minded** — attention moves in obsession cycles (often ADHD-shaped). Deep dives, sudden pivots, expensive returns. This is the engine to harness, not the bug to fix.
- **Allergic to productivity culture** — wants wonder and rigor, not dashboards and streaks.
- **Sovereignty-minded** — their intellectual record must outlive any app, in files they own.

The product is built as if for exactly one such person, forever. That constraint *is* the moat: no engagement economics, no growth mechanics, no reason to ever manipulate the owner.

## 2. Jobs to be done

1. **"Hold my place in every pursuit while my attention is elsewhere — and hand it back free."** (Re-entry: the resume card, sealed threads, saved positions, warm context.)
2. **"Turn what I read into what I keep."** (Highlight → why, Feynman gates, retrieval-first resurfacing.)
3. **"Make my scattered interests compound instead of fragment."** (Threads, bridges, the Atlas, structural cross-domain echoes.)
4. **"Show me honestly who I am becoming."** (The temporal mirror: weekly shape, named seasons, the annual letter, the depth ledger, the sky-as-autobiography.)
5. **"Guide the next step without ever nagging."** (One thing at the Threshold; one ask per session; a mentor that asks questions.)

## 3. The information model

Plain Markdown + YAML frontmatter, Obsidian-compatible, one folder per kind. The graph is derived, never stored as truth.

```
BECOMING   Pursuits/    who the owner is turning into (identity, why, season, state)
INQUIRY    Threads/     living questions (position history, seals, trail, next probe)
MATERIAL   Readings/    books & papers (position, why, highlights, synthesis gate)
           Notes/       the commonplace book (notes, plans, ideas, logs, syntheses)
           Goals/       practical ladders (mastery rungs / numeric / habit)
           Bucket/      the wishbook (wishes; may graduate to stars)
           Body/        training (split, workouts, vitals)
           Works/       the exhibition — things actually made
           Journal/     captures inbox, daily tasks, weekly/seasonal/annual mirrors
MACHINE    .renaissance/  index, vectors, queues — disposable, rebuildable
GATE       Proposals/     the only door through which AI suggestions enter
```

**Relations (the living graph):** pursuits ← threads (`pursuit:`), threads ← material (`thread:` / `trail:`), notes ↔ notes (`[[wikilinks]]`), works ← sources, goals ↔ pursuits. Edges are frontmatter fields and wikilinks in the owner's files, materialized into SQLite for query. Books connect to ideas, ideas to questions, questions to pursuits, pursuits to works, works back to identity.

**Consolidations (from the audit):** feats, attained wishes, and works are one ledger (the Exhibition) viewed three ways — a single accomplishment model. Tasks have one home (Journal/tasks) with mirrored views. Capture kinds and note kinds share one vocabulary.

## 4. The core loops

**Daily (≤ 1 minute overhead):**
capture (one keystroke, zero filing) → arrive at Threshold → *one* thing waits (a thread's next probe, a resume, or one ask) → work happens in a room → highlights/whys accrue as side effects of reading, never as chores.

**Per pivot (90 seconds, the system's signature move):**
attention moves on → the Sealing: three lines (*where did you stop · what did you believe · what would you try next*) → thread sleeps near the horizon → months later the Rekindling returns it *with its capsule*. Rotation made lossless.

**Weekly (~7 minutes):** the Observatory assembles the honest shape of the week; the owner writes four lines in their own voice; one commit, resurfaced 90 days later ("has it held?").

**Seasonal / annual:** the season is named; the annual letter is sealed and delivered when the year turns. Landmarks for a time-blind mind.

**The learning loop (all features must trace to it):** encounter → keep with a *why* → retrieval-first resurfacing (question before passage) → bridge in own words → produce a work. Generation effect, testing effect, elaborative interrogation, interleaving, desirable difficulty — the cognitive model of BLUEPRINT-V2 Part III remains binding.

## 5. AI behaviour — the mentor covenant

The AI is a **lantern-bearer and mentor, never a ghostwriter**. Its posture: *asks more than it answers.*

**It does (in increasing order of ambition):**
- similarity search, resurfacing schedules, orphan detection (today — shipped);
- **gap detection**: "your pursuit of X has gathered opinions but no primary sources"; "you produce in every domain but this one";
- **curriculum proposals**: an ordered reading/practice path for a pursuit, deposited as a *proposal*, adopted only by the owner writing it into their own rungs;
- **pattern naming as questions**: "your last month circles compression and memory — is there a thread you haven't named?";
- **structural echoes**: "this note and that 2023 position share a shape: error-correction under noise. Related?"

**It never does:** summarize a book, write a synthesis, answer an open thread, update a position, draw a constellation line. `Notes/`, `Works/`, `Threads/`, `Pursuits/` are human-only ground — **structurally**, not by policy: agents can only write into `Proposals/`, and adoption requires the owner to restate in their own words. The gate never moves, no matter how capable the models get.

**Voice:** one or two scribe's lines in the room's language. Never a chat pane, never a bubble, never an avatar.

## 6. User journeys (canonical)

**The Tuesday morning.** Open the app: your own kept line above the hearth; one card — *"The compression thread is rekindled. You stood in Shannon ch. 2. You believed memory might be lossy compression. You meant to check Bartlett."* One door. Reading Room opens Bartlett at your page, the thread's question faint in the margin. A highlight collides with a March note; the lantern-bearer asks for one sentence; a line draws itself in the Atlas. Total system overhead: seconds.

**The pivot (October).** The obsession moves. Ninety seconds of sealing. Nothing mourned, nothing lost. The new fire gets a fresh thread, and the old one waits near the horizon with its capsule.

**The return (any month).** After weeks away, the Threshold says *welcome back, here is where we stood* — never how long it's been.

**The reckoning (December 31).** Last January's letter arrives. One canon line, earned. The next letter is written. The sky shows a year of named constellations.

## 7. Prioritized product direction

*(Full sequencing in ROADMAP.md. Priority principle: primitive before features; loops before rooms; asking before showing.)*

1. **The Becoming layer** — Pursuits as first-class; every thread, goal, and work can claim one; the Threshold and Atlas organized by pursuit.
2. **Frictionless keeping** — PDF text layer; select → why; the highlight loop at zero cost.
3. **The Mentor (Phase H, gated)** — Proposals/ inbox; gap detection; curriculum proposals; pattern naming. All question-shaped, all quarantined.
4. **The mirror deepened** — seasons and letters already live; the sky-as-autobiography view; the depth ledger honest and beautiful.
5. **The long craft** — voice capture, mobile parity, decades-grade polish and performance.
