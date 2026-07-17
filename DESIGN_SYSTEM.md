# DESIGN_SYSTEM.md — Renaissance Man

> How the product looks, moves, and feels. Derives from VISION.md.
> The standing test for every screen: **would this object be at home in Leonardo's studiolo, if he had modern technology?**

---

## 1. Design philosophy

**A living intellectual home, not software.** The emotional register: a vast castle library at midnight — quiet, reverent, slightly gloomy, candlelit, warm amidst darkness. Oxford stacks, the Long Room, Renaissance studioli, ancient observatories. The building itself is a character: it remembers, it waits, it rearranges itself around what the owner carries.

**Maximalist materials, minimalist layout.** The craft budget goes into texture, type, and light — never into more elements. Lots of dark, empty space so the light has somewhere to fall. One historiated initial per room. Gold like a jeweler uses it. The moment everything is gilded, it is kitsch.

**The living castle** *(owner's amendment, 2026-07-13 — supersedes the old "never props" law)*: the palace may now wear the castle openly — floating candles, an enchanted ceiling that carries the real night, stone and torchlight, castle vocabulary in generic terms (the great hall, the tower, the stacks). Two boundaries remain: (1) protected marks and expression from any franchise are never copied — the castle is *ours*, built from the same sources; (2) if it looks like software (toasts, hamburgers, SaaS gradients) it is still wrong — instrument, manuscript, chart, or altar, always.

## 2. Material & color (the Seven Pigments)

Real pigments, not "themes." Night is the default state; day mode is aged vellum.

| Pigment | Night value | Role |
|---|---|---|
| Ink (ground) | `#0f0c08` → panels `#1a1410` | the dark of the room |
| Vellum (text) | `#f4ecd8` / `#e6d7b4` / `#d2ba8c` | the written word, three tones |
| **Vermilion** | `#a8341f` | **rubrication: only what matters now** — the thing to resume, the current rung, a burning thread, a closing tide, destructive acts. Never metadata, never decoration. (Audited and enforced, v0.1.16.) |
| **Gold** | `#caa64c` / hi `#ecd089` / deep `#7c5e1c` | the earned and the guiding: rules, initials, lit stars, attained things, labels' quiet brass |
| Lapis | `#070a16` → `#0c1226` | the night of the Atlas |
| Verdigris | `#2e5347` | rare accents of living things |
| Leather | 8-hue spine palette | the shelf |

No pure white, no pure black, nothing digitally perfect. Paper grain, candle vignette, dust motes — texture at the threshold of perception.

## 3. Typography

- **Display:** Cormorant Garamond — large, high-contrast, with restraint.
- **Reading:** EB Garamond / IM Fell English — the ink-spread that reads *old*, not retro.
- **Small caps & labels:** the mono/SC hand — uppercase, tracked, ≥11px, quiet brass. Used sparingly: three tracked labels stacked is noise (audited rule).
- **Blackletter:** one place only (the wordmark).
- Drop cap / historiated initial opens each room — full-size on first entry of a session, compact on revisits (*the ceremony is for arrival, not for every pass*).

## 4. Light

Darkness is default; light is intentional and *is* the hierarchy. Candle pools on the one thing that matters; everything else falls into shadow. The screen must be comfortable at midnight. The living sky: daypart and season shift the room's atmosphere at the threshold of deniability — the palace simply knows it is a December midnight. The reader carries its own lamp (page / candle / night ink) so even a white PDF obeys the room.

## 5. Motion — the artifact rule

Nothing fades or slides like an app. Transitions are *operated*: pages turn, ink appears, constellations self-draw, seals press, strikes are drawn. Duration is material (Tarkovsky): nothing meaningful under ~400ms; the interface is comfortable doing nothing.

**Ceremony, not confetti.** Motion celebrates *real* completion only — a lit rung blooms once; an attained wish takes a pressed seal; a finished task is struck through by a drawn line. Motion never *asks* for engagement. Always honor `prefers-reduced-motion` with a static equivalent (not absence).

## 6. Interaction principles

1. **One thing, never a menu.** The home surfaces exactly one next thing; everything else waits behind a quiet ruled line ("three other things stir").
2. **One ask per session.** Sealing, bridge, resurfacing, proposal — the highest-ranked wins; the rest stay silent. Quiet is the default.
3. **Ask before showing** (desirable difficulty): resurfacing shows the question first, the passage on reveal.
4. **Every gesture reversible.** Lit stars unlight; trashed leaves go to `.trash`; no confirmation dialogs where undo suffices; no destructive act without one.
5. **Zero-friction capture.** One keystroke, no mandatory filing, ever.
6. **No shame surfaces.** "Carried forward," never "overdue." Fallow, never failed. The system greets returns, never counts absences.
7. **One escape hatch.** Esc closes the topmost sheet; backdrop always dismisses; the same exit works everywhere.
8. **Words are design.** The resident's voice: warm, brief, scribe-like ("a star is lit," "no harm done," "the rest can keep"). Errors explain and offer a way back — never apologize, never jargon.

## 7. Components (the canonical set)

- **The panel** — cornered parchment card; `lit` variant carries the candle pool for the one thing that matters.
- **The tag/rubric** — small-caps vermilion caption introducing an ask or the resume object.
- **The why block** — vermilion-edged, italic: the owner's own reason, always visible with its object.
- **Buttons** — primary (vermilion, the one action), gold (earned/ceremonial), ghost (quiet). 44px touch targets on mobile.
- **The scrim/slip** — modal sheets as manuscript slips; bottom sheets on mobile; drag-to-dismiss.
- **The shelf & spines** — books as leather spines with gold tooling, warmth pips, progress slivers.
- **The chart** — SVG constellations: figures fit to slots, beads at arc-length, self-drawing lines, engraved labels. Ink on parchment, never a dashboard.
- **Instruments** — hover-revealed quiet controls (↑ ↓ × ✎) on list rows; visible on touch.
- **The flash** — ink-confirm line, bottom corner, fades; the only "toast" allowed.
- **The stir line** — the fold: a ruled italic line holding everything below the one thing.

## 8. Layout & structure

Seven plates (rooms) on a codex spine; roman numerals; number keys 1–7; the palette (⌘P) is the single omnibox for everything. Long rooms carry a quiet jump rail. The margins hold marginalia; the ribbon holds intentions; the reading column stays ≤ 72ch. Mobile is the pocket codex: bottom plate-bar, quill FAB, sheets, swipe between plates — same vault, same laws.

## 9. Accessibility

- Keyboard-first: every core loop drivable without a mouse; visible `:focus-visible` (hairline gold ring) everywhere.
- Contrast: text tones ≥ 4.5:1 on their grounds; the mono hand never below 11px.
- Reduced motion: static equivalents, never missing states.
- Touch: 44px targets; instruments visible (not hover-gated) on touch devices.
- The dark room must remain readable in daylight (day mode is a first-class citizen, not an override pile).

## 10. Emotional design

The product's feelings, by room: arrival and relief (Threshold), absorption (Reading Room), perspective and awe (Atlas), vitality (Studio), longing without pressure (Cabinet), honest reflection (Observatory), craft (Study). The system's overall posture toward the owner is that of a devoted, discreet librarian: it remembers everything, expects nothing, and is always glad you came back.
