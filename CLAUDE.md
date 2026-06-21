# CLAUDE.md — Renaissance Man

> The steering document for this project. Read this fully before writing code.
> When in doubt, return to **The Feeling Test** (§3) and **The First Law** (§2).

---

## 1. What this is

**Renaissance Man** is a local-first desktop application: a single, unified "intellectual home" for one person (not a product to ship). It is a second brain, distraction-free reader, goal-and-mastery tracker, and life dashboard — fused into one place that feels less like software and more like the private studiolo of a Renaissance polymath.

It is **not** a productivity tool. The target feeling is *wonder, curiosity, reverence for knowledge* — a great library at night, not a SaaS dashboard.

The owner has ADHD. This is not a footnote; it is the central design constraint that shapes every decision below.

---

## 2. The First Law (the core primitive)

Everything in the system reduces to **the resume card**:

> *A thing you are moving toward that you will lose the moment it leaves your sight.*

A half-read PDF, a half-finished goal, a strength target, a bucket-list wish — all the same object. Each carries three fields:

1. **Where you are** (position / progress)
2. **Why it mattered to you** (one sentence, written in the owner's own words when motivation was high)
3. **The single next action**

The entire product exists to make **re-entry free**. ADHD is an object-permanence and re-entry problem: out of sight is gone, and the cost of reloading context is so high that dropped things stay dropped. Solve re-entry and you solve most of what the system is for. The headline metric is **re-entry rate** — how often the owner returned to something they'd dropped.

---

## 3. The Feeling Test

For every design or implementation decision, ask:

> **"Would this object be at home inside the personal study of Leonardo da Vinci, if he had modern technology?"**

If it looks like software (toasts, hamburger menus, SaaS gradients, productivity-app chrome), it is wrong. If it looks like an instrument, a manuscript, a chart, or an altar, it is right.

---

## 4. ADHD design law (non-negotiable)

These are hard constraints. Violating them breaks the product for its only user.

- **The system must survive neglect.** No feature may punish a gap. Come back after two weeks and the system says *"welcome back, here's where we were,"* never *"you've been gone 14 days."*
- **Push one thing, never a menu.** A list is a decision, and decisions are where ADHD stalls. The home screen surfaces exactly ONE next thing.
- **Pull, not push.** No notifications, no nags, no badges demanding attention. The owner goes to it; it never summons them. The one exception is gentle in-app resurfacing.
- **Momentum, not streaks.** Threads/goals run *warm → cooling → cold* (a soft temperature), never a brittle streak counter. A cold thread is an invitation, not a failure.
- **Zero-friction capture.** One keystroke to capture anything into a single inbox, sorted later, never lost in the moment. No mandatory tagging or filing, ever.
- **Empty is a feature.** "Nothing else needs you today" is a valid, desirable state. Do not fill space to look busy.
- **No shame mechanics.** Stats encourage or give perspective; none of them guilt. No red "you failed" states.
- **Consume → produce → done-when.** Every learning/goal rung requires the owner to *make* something with an unambiguous completion test. Reading alone never clears a rung — that's the one "easy path" to engineer out.

**Also:** the system must not become a maintenance hobby that replaces the actual reading/training. Favor assembling existing tools over rebuilding solved problems. Build the smallest thing usable over the *real* vault, then make it beautiful — beauty is the reward for the loop working, not the starting point.

---

## 5. Architecture — files first, app second

**The vault is the source of truth.** It is a folder of plain Markdown files with YAML frontmatter, plus a PDF attachments folder. Obsidian and Renaissance Man are two windows onto the *same* folder — nothing is ever locked in. The database and embeddings are a **derived, rebuildable cache** — never the source of truth.

### Vault layout
```
RenaissanceVault/
├── Readings/      one .md per reading  (source, position, why, thread, review)
├── Notes/         commonplace notes (the running scholarly volume)
├── Goals/         one .md per goal     (rungs OR numeric metric, momentum)
├── Bucket/        one .md per wish     (cost, effort, season, status)
├── Body/          workouts + metrics   (or synced from a gym app)
├── Journal/       daily logs + the capture inbox
├── Attachments/   the PDFs themselves
└── .renaissance/  index.sqlite + vector cache  (GITIGNORED, rebuildable)
```

### Frontmatter schemas

**Reading** (`Readings/*.md`)
```yaml
type: reading
title: The Beginning of Infinity
author: David Deutsch
source: Attachments/beginning-of-infinity.pdf   # or a URL
added: 2026-06-20
position: { page: 84, percent: 62 }
status: reading            # queued | reading | bound
thread: explanation-knowledge
review: { due: 2026-07-01, interval: 9, ease: 2.4 }   # spaced resurfacing lives HERE, not in a DB
why: "Explanations, not predictions, are the unit of knowledge."
```

**Highlight** (own note, for resurfacing) — `anchor` is page + quoted text so it survives re-layout:
```yaml
type: highlight
reading: rd-deutsch-boi
anchor: { page: 84, quote: "Knowledge refuses to stay where you put it" }
why: "The idea of reach — knowledge transfers."
created: 2026-06-21
review: { due: 2026-06-22, interval: 1 }
```

**Goal** (`Goals/*.md`) — numeric and mastery goals share one schema:
```yaml
type: goal
title: Squat twice my bodyweight
domain: body                  # mathematics | physics | mind | letters | body | ...
kind: numeric                 # numeric | mastery
metric: { name: squat, current: 100, target: 156, unit: kg }   # null for mastery goals
temp: warm                    # warm | cooling | cold  (DERIVED from last_touched)
last_touched: 2026-06-21
rungs:
  - { t: "...", consume: "...", produce: "...", done: "...", complete: false }
```

**Bucket item** (`Bucket/*.md`)
```yaml
type: bucket
title: See the aurora borealis
domain: travel
cost: high          # free | low | mid | high
effort: high
season: winter      # any | spring | summer | autumn | winter
status: open        # open | attained
```

**Workout** (`Body/*.md`)
```yaml
type: workout
date: 2026-06-21
session: push
lifts:
  - { name: bench, sets: [ {kg: 80, reps: 5} ] }
bodyweight: 78.4
```

**Capture** (`Journal/inbox/*.md`) — the universal inbox:
```yaml
type: capture
created: 2026-06-21T22:14
status: inbox        # inbox | sorted
kind: idea           # idea | wish | link | note
text: "..."
```

### Memory layer (efficient, tiered, file-native)
- Embed once **at capture**; cache the vector in `.renaissance/`. Never re-embed on a loop.
- **Hot working set** (recent + warm threads) searched fast; **cold archive** touched only on deep search.
- Retrieval **key is the `why` sentence**, not raw text — that's what makes resurfacing feel like a friend remembering.
- **Dedup by embedding similarity** so nothing is ever re-suggested.
- Spaced-resurfacing schedule lives in each note's frontmatter `review:` block → **no separate scheduling DB**.
- Compaction runs quietly at idle/night (append as you go, compact later, forget noise).

### Tech stack (all free, local, open)
- **Tauri** (Rust shell) — chosen over Electron: lighter, native file access, maturing mobile target (mobile is a later phase, so don't fork the data model for it now).
- **Frontend:** the existing HTML/CSS/vanilla-JS codex *is* the app's UI — it drops into Tauri's webview nearly verbatim. Keep it dependency-light.
- **PDF rendering:** PDF.js, rendered *inside* the Reading Room column. Highlights anchor by page + quote.
- **Embeddings:** a small local model (MiniLM family) — free, private, offline.
- **Index:** SQLite for fast search, in `.renaissance/`, fully rebuildable from the Markdown.
- **Gym logs:** read in from Hevy/FitNotes/Strong (don't rebuild a workout logger) or log lightly as Markdown.
- **Schedule:** sync out via `.ics`; never replace the system calendar. Time-block *intentions* (rungs/readings/workouts), today-focused, missed blocks resurface (never cascade-fail).

---

## 6. Visual philosophy — the illuminated palace

Distill these influences into ONE coherent artifact (do not pastiche): da Vinci notebooks & Codex Atlanticus, Vitruvian Man, Renaissance anatomical & celestial engravings, Cellarius star atlases, Tycho Brahe's observatories, illuminated manuscripts & Books of Hours, armillary/celestial globes, cabinets of curiosities, antique scientific instruments, alchemical engravings, antique libraries, classical & temple architecture, museum exhibition design, and Greek/Roman/Hindu mythology.

### Materials & light (real pigments, not "themes")
- **Iron-gall ink** — primary text (warm near-black brown `#33271a`).
- **Aged vellum** — the page (`#e7d9b8`, lit `#f0e4c7`, deep `#d9c79f`) with subtle paper grain + a candlelit vignette burning the margins.
- **Lapis / indigo** — the night of the Atlas (`#070a16` → `#0c1226`).
- **Vermilion** = *rubrication*. Red was the scribe's mark of importance, so **red always means "this matters"** — never decoration (`#9e3320`).
- **Gold leaf** — used like a jeweler uses it, rarely, on the one thing that earns it: a historiated initial, a guiding star, a chart's frame (`#caa64c`, hi `#ecd089`, deep `#7c5e1c`).
- **Light is candlelight:** it pools on what matters; everything else falls into shadow. *Light is the hierarchy.*

### Typography
- **Display / headings:** Cormorant Garamond (high-contrast, used large, with restraint).
- **Body / reading:** IM Fell English (digitized 17th-c. press type, authentic ink-spread — this is what makes it read *old*, not retro).
- **Labels / small caps:** IM Fell English SC (rubricated, letter-spaced).
- **Wordmark accent:** Pirata One (blackletter) — used in exactly ONE place.
- Drop cap / historiated initial opens each room.

### Motion = artifact, not software
Nothing fades/slides like an app. Transitions are *operated*, mechanical, historical:
page **turning** · constellation **self-drawing** · telescope **focus-lock** · armillary **rotation** · ink **appearing** on parchment · engraving **reveals** · maps **unfolding** · cabinets **opening**. Respect `prefers-reduced-motion`.

### Discipline (critical)
"Very very insane" must stay **museum-grade, not theme-park**. The rule: **maximalist materials & craft, minimalist layout.** One historiated initial per room; gold used sparingly; ruled margins keeping everything calm; lots of dark/empty space so the light has somewhere to fall. The moment everything is gilded, it becomes kitsch.

---

## 7. The pantheon as architecture

Mythology is the *logic* of each room, not statuary. Each room has a tutelary spirit who **is** its function:

| Room / function | Spirit | Why |
|---|---|---|
| **Threshold** (home/hearth) | **Hestia** | arrival at the lit hearth; one thing waits |
| **Capture** (the inbox, everywhere) | **Hermes** | the swift messenger; catch a thought before it's lost |
| **Reading Room** (learning, the word) | **Saraswati** | goddess of knowledge & the written word (book + instrument) |
| **Atlas** (synthesis + the chart) | **Athena** + **Urania** | wisdom/synthesis; muse of the stars |
| **Guiding stars** (long-term vision) | **Apollo** | clarity, the far sight; goals as fixed stars to steer by |
| **Memory / resurfacing** | **Mnemosyne** | surfaces the forgotten at the right moment |
| **Life-maxxing** (body, mastery) | **Herakles** | mastery earned through labors; each rung a feat |
| **Observatory** (weekly review) | **Janus** | two faces — looks back on the week, forward into the next |

---

## 8. The rooms (plates) and their art

1. **Threshold (I)** — temple gates / allegory of beginnings. Home: epigraph (one of the owner's own kept passages), the resident's one line, the resume card, on-the-ladder, one bounded rabbit hole, today's intentions ribbon, "the feed is closed."
2. **Reading Room (II)** — monastery scriptorium: ruled column, drop cap, illuminated capitals. Drop a PDF/URL → reads in-column; highlight → "why did this matter?" → marginalia (the commonplace book). Ribbon bookmark = position. Deep-dive dims the world + timer. Research Threads: the resident answers across only the pinned sources.
3. **Atlas (III)** — the star atlas. See §9.
4. **Life-maxxing (IV)** — Codex Atlanticus / Vitruvian: anatomical & proportional studies, mechanical drawings. Body & strength charts (engraving-style), stat plates (re-entry rate is the crowned one), "your one life in days" perspective, the illuminated **table of feats** (PRs + attained wishes). Numeric goals here mirror their guiding stars in the Atlas.
5. **Cabinet of Curiosities (V)** — wunderkammer of natural-history plates & specimens. The bucket list as a *wishbook, not a backlog*: filterable (doable-now / free / domain), low-pressure, celebrates the attained, never nags the open. Resurfaces one wish when its season opens.
6. **Observatory (VI)** — Cellarius celestial mechanics: armillary spheres, planetary diagrams. Gentle weekly reflection in the resident's voice; a colophon. Pull, never push.

---

## 9. The Atlas — a living cosmos (NOT a graph view)

A navigable night sky the owner flies through. The cosmology:

| Cosmic object | Means |
|---|---|
| **Star** | a concept |
| **Constellation** (self-drawing gold lines) | a topic |
| **Nebula** (colored cloud, field pigment) | a field of knowledge |
| **Guiding star** (flaring, vermilion progress arc) | a long-term goal |
| **Planet** (in orbit) | a research project |
| **Gravitational pathway** (dashed arc) | a relation between ideas |

Navigation: drag to pan, scroll/buttons to zoom (zoom-toward-cursor), click a star → telescope focus-lock (camera eases in + gold focus-ring) → parchment cartouche of detail with links you can jump along. Ambient: parallax starfield (depth), slowly rotating armillary graticule, twinkling. It reads its stars from `Goals/` and `Notes/` in the real app.

### ⚠️ Atlas performance rules (learned the hard way)
- **Never** call `createRadialGradient` (or any gradient) inside the animation loop. Pre-bake glows (star glow, guiding halo, nebulae) into **offscreen sprite canvases once** and `drawImage` them each frame. This was the cause of lag.
- Cache the background gradient; rebuild only on resize.
- Cap DPR at ~1.5.
- Keep object counts bounded; only draw concept-star labels when zoomed in or hovered.

---

## 10. Prototype inventory (what already exists)

These are HTML prototypes (in-memory, no persistence yet). They define the visual + interaction target.

- **`atlas-coeli.html`** — the living-cosmos Atlas (§9). The current visual high-water mark. Performance-optimized (sprite-cached). The frontend reference for the palace direction.
- **`renaissance-man-codex.html`** — the full six-room illuminated codex (Threshold, Reading Room, Atlas-as-starchart, Life-maxxing w/ Vitruvian, Cabinet, Observatory) + universal capture + intentions ribbon. Has working: room nav, highlight→marginalia, deep-dive, rung mechanics, cabinet filtering, capture inbox. **This is the room layout + interaction spec.** (Its Atlas is the older flat star-chart; supersede it with `atlas-coeli.html`'s approach.)
- *(superseded: an earlier candlelit-dark prototype `renaissance-man.html` — ignore; the codex replaces it.)*

What is **wired** in the prototypes is in-memory only. What needs the real app: vault file I/O, PDF.js embedding, embeddings/search over real notes, persistence.

---

## 11. Roadmap (build in this order)

1. **Tauri scaffold** — shell that opens the codex frontend; "pick your vault folder"; Rust commands to read/write the Markdown+frontmatter files in §5.
2. **Capture + Threshold over real files** — universal capture writes to `Journal/inbox/`; Threshold reads one resume card from real `Readings/`/`Goals/`. Smallest usable loop.
3. **Reading Room real** — PDF.js in-column, highlight→`why`→Markdown highlight note, position saved to frontmatter.
4. **Atlas wired** — `atlas-coeli.html` reads stars from `Goals/` + `Notes/`; mark-rung-done writes back to frontmatter.
5. **Memory/search** — local embeddings + SQLite cache; resurfacing from `review:` blocks; `why`-keyed retrieval; dedup.
6. **Life-maxxing + Cabinet + Observatory** over real files; gym sync; `.ics` schedule out.
7. **Re-skin all rooms** to the `atlas-coeli.html` Cellarius-grade standard.
8. **Mobile** (later) — a second face on the same vault.

---

## 12. Agent guardrails (for Claude Code)

- **Files are truth. The DB/vectors are a disposable cache.** Never make a feature depend on the cache being present; it must rebuild from the Markdown.
- **Obsidian compatibility is sacred.** Keep frontmatter clean and standard; don't write app-only state that would corrupt the owner's notes in Obsidian.
- **Honor the ADHD law (§4) in every UI choice.** If a feature would nag, shame, or demand filing — redesign it.
- **Assemble before you build.** Don't reinvent read-later, gym logging, or calendars. Wire good existing parts.
- **Beauty is earned, not bolted on.** Get the loop working over real files first; apply the full visual treatment after it functions.
- **Apply The Feeling Test (§3) before shipping any screen.**
- **Keep the frontend dependency-light** so it stays portable into Tauri (and later mobile).
- Respect `prefers-reduced-motion`, keyboard focus, and graceful empty states ("an empty screen is an invitation to act").
```
