# CLAUDE.md — TANGOCHI

Guidance for AI agents (and humans) working on this codebase. Read this before making changes.

## What this is

TANGOCHI is a browser-based, coding-themed virtual pet (Tamagotchi). The pet lives in a
2.5D isometric room, has real-time survival needs, skill stats, moods, evolutions, a
shop/economy, achievements, daily quests, and a "Bug Hunt" mini-game. Retro pixel
aesthetic: `Press Start 2P`, CRT scanlines, mood-driven accent theming.

## Hard constraints (do not break these)

- **No build step. No external runtime libraries.** Vanilla HTML/CSS/JS only. The only
  network asset is the Google Fonts stylesheet; the game logic runs fully offline.
- **Must open by double-clicking `index.html` (`file://`).** This is why we use **classic
  `<script>` tags**, not ES modules — ES module imports are blocked by browser CORS over
  `file://`. Modules share one global namespace object: `window.TG`.
- **Pixel aesthetic is hand-coded.** Sprites are integer pixel grids drawn to canvas;
  the room is drawn procedurally. No raster image assets.
- **Respect `prefers-reduced-motion`** and the in-game motion toggle. Particles, bounce,
  and pet wandering must gate on `TG.util.reduced()`.
- **Never lose player progress.** Any schema change must bump `CONFIG.SAVE_VERSION` and
  add a migration step in `state.js`.

## Architecture

Single shared namespace `TG`. Each file attaches to it. Load order matters and is fixed
in `index.html`:

```
core → config → species → state → sprites → particles → audio →
sim → iso → minigame → actions → progress → shop → ui → main
```

| File | Responsibility |
|------|----------------|
| `src/core.js`      | Event bus (`TG.events`) + `TG.util` helpers (clamp, rand, pick, reduced). |
| `src/config.js`    | All tunable balance + content tables (decay rates, items, achievements, quests, moods, day phases). **Change game feel here.** |
| `src/species.js`   | 12 species as 16×16, 2-frame pixel grids (`0-5` palette indices). Extracted verbatim from v1. |
| `src/state.js`     | Save schema, `defaultState()`, `load/save/reset`, **migration**. Owns `TG.STATE`. |
| `src/sprites.js`   | Resolution-independent pixel drawing: `drawSpecies`, `drawGrid`, `drawBug`. |
| `src/particles.js` | Pooled particle system (max 160) + named emitters (hearts, crumbs, stars, confetti…). |
| `src/audio.js`     | WebAudio blip synth, lazily created on first gesture; `TG.audio.play(name)`. |
| `src/sim.js`       | The simulation: needs decay, offline progression, mood calc, day/night phase, evolution gating, sickness, XP/coins. |
| `src/iso.js`       | Isometric room renderer: projection, walls, checker floor, procedural furniture, **depth sort by `col+row`**, wandering pet, day/night tint. |
| `src/minigame.js`  | "Bug Hunt" lifecycle, hit-testing, scoring, rewards. Bugs are depth-sorted inside `iso.render`. |
| `src/actions.js`   | Player actions (feed/play/rest/clean/debug/petClick/consume) → mutate needs+stats, award xp/coins, fire fx. |
| `src/progress.js`  | Achievements + daily quests + streaks; subscribes to the event bus. |
| `src/shop.js`      | Buy food/furniture, unlock species, auto-place furniture into the room. |
| `src/ui.js`        | All DOM: bars, badges, panels (species/shop/quests/trophies), toasts, speech, settings, input wiring. |
| `src/main.js`      | Boot sequence + the single delta-timed `requestAnimationFrame` loop + animation driver + `TG.game.setSpecies`. |

`index.legacy.html` is the original single-file v1, kept for reference. Safe to delete.

## v2 prototypes (`v2/`)

`v2/` is an **experimental, throwaway prototype area** exploring a richer 3D room and a
shop/studio loop. It is **separate from the shipped game** and the hard constraints above
are **intentionally relaxed here only** — specifically, the "no external libraries" rule:
v2 vendors **Three.js r128** (`v2/vendor/three.min.js` + `OrbitControls.js`, the last
release with global `examples/js` controls), loaded via classic `<script>` tags (no ESM /
import maps) so a double-click `file://` open still works. If anything in `v2/` is ever
promoted into the main game, the no-library / ESM-over-`file://` constraints come back.

The cozy-lofi aesthetic is shared across all v2 pages: near-black scene, monochrome
halftone-dot surfaces, **the pet is the only real colour**, one orange accent (`#ffb347`),
CRT scanlines, `Press Start 2P` + `JetBrains Mono`. No mood/hue tints; day/night darkens
in grayscale only.

| File | Responsibility |
|------|----------------|
| `v2/room-prototype.html`        | Three.js 3D room: free orbit/zoom/pan (OrbitControls), four walls with the two nearest the camera **culled per-frame** (cutaway iso), billboarded dot-matrix sprites for pet/furniture, click-to-place / grab-to-move, click-pet-to-poke. Built-in furniture catalog. Aspect-aware fov so the room stays framed on narrow screens. `window.__room` debug handle. |
| `v2/shop-prototype.html`        | "Room of Requirement · Object Studio": a catalog where objects are **developed** through stages (idea→concept→prototype→ready) then **acquired** with coins, plus a clickable dot-matrix **sketch pad** to conjure new object ideas. Persists to `localStorage['tangochi_studio_v2']`. |
| `v2/room-of-requirement.html`   | Three.js room that **materialises objects acquired in the studio** (auto-place + shimmer), with grab-to-move arranging. Persists layout to `localStorage['tangochi_ror_v2']`; live-syncs via the `storage` event when the studio tab changes. `window.__ror` debug handle. |
| `v2/room-prototype.cssed.html`  | Backup of the original CSS-3D room (pre-Three.js rebuild), kept for reference. |
| `v2/vendor/`                    | Vendored Three.js r128 globals. |

The studio (`shop-prototype.html`) and the Room of Requirement (`room-of-requirement.html`)
are linked **only through shared `localStorage`** (same origin) — there is no shared JS
module. Each v2 page is a self-contained single HTML file.

## Data model (`TG.STATE`, save key `tangochi`, version 3)

```
species, level, xp, mood, stage('baby'|'juvenile'|'adult'), health('ok'|'sick'),
stats:{debugging,patience,chaos,wisdom,speed}   // 0..100 skill stats
needs:{hunger,energy,happiness,hygiene}         // 0..100, 100 = satisfied
careScore                                       // rolling care quality → gates evolution
coins, inventory:{id:count}, placed:[{item,col,row,wall?}],
unlockedSpecies:[], achievements:{id:ts}, counters:{...}, quests:{day,list:[]},
streak:{count,lastDay}, lastFed, lastSeen, sessions, created, settings:{sound,reducedMotion}
```

## Core mechanics

- **Real-time needs.** Decay rates are per real minute (`CONFIG.decayPerMin`). The loop
  applies decay ~once/second; on load, `sim.applyOffline()` applies elapsed time once,
  capped at `CONFIG.maxOfflineHours`.
- **Mood** is derived (`sim.recalcMood`) from needs + stats + time of day; never set it as
  ground truth except as a transient animation state after an action.
- **Evolution** requires both a level and a `careScore` threshold (`CONFIG.evolution`),
  and only ever moves forward.
- **Sickness** triggers after sustained neglect; cured by `medkit` or recovery.
- **Economy:** actions give small coins; Bug Hunt and achievements give more; shop spends.

## Rendering & coordinates

- Canvas internal resolution is fixed (`320×300`) and CSS-scaled up with
  `image-rendering: pixelated`. Don't resize the backing store per-DPI.
- Iso projection: `x = ox + (col-row)*hw`, `y = oy + (col+row)*hh` (2:1 diamond).
- **Depth:** everything drawable (furniture, pet, bugs) goes into one list sorted by
  `col+row` then a sub-order. Add new room objects to that list — don't draw them after.

## Conventions

- Pure-ish modules: each wraps an IIFE and exposes one object on `TG`.
- Cross-module comms via `TG.events.emit/on`, not direct calls, for game events
  (`levelup`, `evolve`, `sick`, `quest:*`, `coins`, `bug:squashed`).
- Tunables live in `config.js`. Don't hardcode balance numbers in logic files.
- Clamp every stat/need write with `TG.util.clamp(v,0,100)`.

## Verify before shipping

```bash
# syntax
for f in src/*.js; do node --check "$f"; done
# headless smoke + migration tests
node /tmp/harness.js        # see plan.md "Testing" for the harness
```
Then open `index.html` in a browser and confirm: zero console errors, needs bars move,
each action works, Bug Hunt scores + rewards, species switch/unlock, furniture appears in
the room with correct depth, level-up/evolution toasts, and the motion toggle.

## Known gotchas

- Audio needs a user gesture first; `audio.ensure()` is called on canvas tap and Hunt start.
- `confirm()` is used for reset — fine for a toy, swap for a custom modal if embedding.
- The speech bubble is anchored to the top of the room card (not tracked to the pet) so it
  stays readable across responsive scaling.
