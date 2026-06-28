# TANGOCHI — Game Development Plan

A phased roadmap. Phases 0–4 are **done** in this build; Phases 5+ are the forward
backlog. Each phase lists goals, work, and acceptance criteria.

---

## Phase 0 — Modularize (done)

**Goal:** make the codebase extensible without a build step.

- Split the v1 single `index.html` into `src/*.js` classic-script modules under a shared
  `TG` namespace + `styles/main.css`.
- Preserve v1 sprite data verbatim (`species.js`).
- Keep `index.legacy.html` as a reference snapshot.

**Acceptance:** opens from `file://`, no console errors, original pet renders. ✅

---

## Phase 1 — Deeper simulation loop (done)

**Goal:** turn a stat toy into a care sim with real stakes.

- Four real-time **needs**: hunger, energy, happiness, hygiene (decay per real minute).
- **Offline progression** applied once on load, capped at 12h.
- Derived **mood** from needs + stats + time of day.
- **Day/night** ambient tint from the real clock.
- **Sickness** from sustained neglect; **care score** rolling average.
- **Evolution** stages (baby → juvenile → adult) gated by level + care.

**Acceptance:** needs visibly drift; neglect causes sad/sick; good care evolves the pet;
leaving and returning advances state sensibly. ✅

---

## Phase 2 — Isometric room (done)

**Goal:** the pet lives somewhere, not floating in space.

- True 2:1 diamond projection, 5×5 floor, two back walls, checker tiles.
- Procedural pixel **furniture** (rug, plant, lamp, bookshelf, beanbag, poster).
- **Depth sorting** (painter's algorithm by `col+row`) across furniture + pet + bugs.
- Pet **wanders** between tiles, faces its direction, casts a soft shadow.
- Day/night tint overlay.

**Acceptance:** furniture occludes/!occludes the pet correctly as it moves; scene reads
clearly at mobile and desktop widths; stays crisp (pixelated scaling). ✅

---

## Phase 3 — Interaction juice (done)

**Goal:** every interaction feels good.

- New action **CLEAN**; **Bug Hunt** mini-game (tap scuttling bugs for coins + XP).
- **Particles** (hearts, crumbs, stars, sparks, bubbles, confetti, coins, z's) via a pool.
- **WebAudio** blip SFX per action/event; sound toggle.
- Squash-and-bounce animation, mood-driven anim speed, speech bubbles, toasts.

**Acceptance:** actions emit fitting particles + sound; Bug Hunt is playable with a HUD;
reduced-motion disables non-essential motion. ✅

---

## Phase 4 — Progression & content (done)

**Goal:** reasons to keep coming back.

- **Currency** earned from actions/Hunt/achievements; **shop** for food, furniture, species.
- **Unlockable species** (8 beyond the 4 starters) at a coin cost.
- **Achievements** (10) with reward coins + trophy panel.
- **Daily quests** (3 sampled/day) + **visit streaks**.

**Acceptance:** coins flow in/out; buying furniture places it in the room; species unlock
and switch; achievements/quests complete and pay out; all persist across reloads. ✅

---

## Phase 5 — Drag-to-place & room editing (next)

**Goal:** let players arrange their room.

- Tap-to-select a tile, drag furniture between tiles, rotate, sell back.
- Validate placement (no overlap, keep a path), show a ghost preview.
- Persist exact layout (already in `placed[]`).

**Acceptance:** drag works on touch + mouse; invalid drops snap back; layout saved.

---

## Phase 6 — More mini-games & events (backlog)

- A second mini-game (e.g. "Merge Conflict" matching, "Code Review" timing).
- Random room **events** (visiting pet, package delivery, power outage at night).
- Weather/seasonal tints tied to real date.

**Acceptance:** at least one new game with its own reward curve; events are rare,
skippable, and never punish offline players.

## Phase 7 — Personality & life stages (backlog)

- Per-species personality modifiers on decay/mood thresholds (data already hinted in
  species `personality`).
- Stage-specific sprite variants (true baby/adult art, not just scale).
- Naming the pet; simple relationship/bond meter.

## Phase 8 — Polish & distribution (backlog)

- PWA manifest + service worker for installable offline play (keeps `file://` working too).
- Settings: data export/import (JSON), accessibility audit (contrast, focus order, keyboard).
- Optional: self-host the pixel font to remove the last network dependency.
- Performance pass: cache static floor/wall layers to an offscreen canvas.

---

## Testing strategy

- **Syntax:** `for f in src/*.js; do node --check "$f"; done`.
- **Headless smoke harness:** a Node + `vm` script that stubs `window`/`document`/canvas/
  `localStorage`/`AudioContext`, loads all modules in order, boots, then exercises actions,
  the mini-game, shop, species switch, leveling, and a render frame. Catches reference/typo
  and wiring errors without a browser.
- **Migration test:** load a synthetic v1 save and assert progress is preserved while the
  v3 fields are backfilled.
- **Manual playtest checklist** (per CLAUDE.md): console clean, needs move, actions, Hunt,
  unlocks, depth sorting, evolution toasts, reduced-motion, reload persistence.

## Design guardrails

- Keep it openable from `file://`; no build step; no runtime deps.
- Tunables in `config.js`; clamp all stat writes; communicate via the event bus.
- Never punish absence harshly (offline cap); never lose a save (version + migrate).
