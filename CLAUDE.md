# Spartacus's Island

A cosy 3D browser game Claudio is building for his daughter Zoë (9). Spartacus, the family dog, is a pirate pup who sails from island to island, eats fruits that give him powers, solves gentle puzzles and gathers a crew of animal friends. Zoë loves surprises: she gives a direction now and then (a friend, a place, a fruit) and play-tests; we design the levels, puzzles and story around it.

Vite + plain ES modules + three.js 0.160.0 (+ Rapier, only for physics toys), deployed as a PWA to https://keepitterron.github.io/spartacus-island/ on every push to `main`.

## Read first

- **[docs/design-rules.md](docs/design-rules.md) before changing gameplay.** No conflict, failing costs seconds never progress, one power at a time, every new thing gets a hint and is easy to spot, surprises for Zoë (she steers, we design), Spartacus never changes (no dress-up). Its feedback log lists what she has already said no to.
- [docs/architecture.md](docs/architecture.md): folders, boot order, state machine, the frame.
- [docs/islands.md](docs/islands.md): the island interface and how to add a level.
- [docs/levels.md](docs/levels.md): laying out islands in Blender (`levels/*.blend` → `.glb`): ground, colliders, markers. Island 1 is the example. Island designs: [island1.md](docs/island1.md) (the bigger remake), [island2.md](docs/island2.md), [island3.md](docs/island3.md), [island4.md](docs/island4.md), [island5.md](docs/island5.md), [island6.md](docs/island6.md), [island7.md](docs/island7.md).
- [docs/systems.md](docs/systems.md): items, pickups, digs, powers, vines, hooks, hat, NPCs, cutscenes.
- [docs/code-style.md](docs/code-style.md): naming, parameters, comments, modern JS. **Follow it for every change.**
- [docs/testing.md](docs/testing.md): debug console (`window.__g`) and the play-test checklist.
- [docs/bugs.md](docs/bugs.md) and [docs/backlog.md](docs/backlog.md).

## Commands

- `npm run dev`: http://localhost:5173/spartacus-island/ (debug helpers on)
- `npm run build` / `npm run preview`: production build incl. service worker
- `npm run levels`: re-export `levels/*.blend` to each island's `level.glb` (needs Blender)
- `npm run lint` (oxlint), `npm run format` (oxfmt), `npm run check` (lint + format check + build, run before pushing)

## Rules of thumb

- Islands are modules with one shared interface (`src/islands/islandN/index.js`); the loop and menus never branch on island number.
- **Every island has its own random sequence** (`rand()`, reseeded with the island's id before its `build()`), so changing one island's scenery never moves another's. Within an island, reordering `rand()` calls moves its own random scenery (bushes, flowers, palm turns): fine, but don't let gameplay positions depend on `rand()`. Add new islands at the end of `ISLANDS` in `main.js`.
- Mutable shared state goes on objects (`game`, `followCam`, `player`), not exported `let`s.
- Don't call imported functions at module top level (there are harmless import cycles); do the work in `build()`.
- Text sprites: create inside `onFontsReady()`, start hidden.
- Scenery that never moves: `addStatic(mesh)` after adding it, so it's merged for phones (`world/statics.js`). Never for anything that moves or is looked up later.
- Every action check tests distance **and** height.
- Readable over dense: descriptive names, one subject + an options object, short "why" comments (see docs/code-style.md).
- Keep assets local (no CDNs): the game must work offline.
- Edit a Blender level in its `.blend`, then re-export: never hand-edit a `level.glb`. Commit both.
