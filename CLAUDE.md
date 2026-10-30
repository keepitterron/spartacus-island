# Spartacus's Island

A cosy 3D browser game Claudio is building for his daughter Zoë (9). Spartacus, the family dog, is a pirate pup who sails from island to island, eats fruits that give him powers, solves gentle puzzles and gathers a crew of animal friends. Zoë invents the story and the levels; we build them.

Vite + plain ES modules + three.js 0.160.0, deployed as a PWA to https://keepitterron.github.io/spartacus-island/ on every push to `main`.

## Read first

- **[docs/design-rules.md](docs/design-rules.md) before changing gameplay.** No conflict, failing costs seconds never progress, one power at a time, every new thing gets a hint, Zoë writes the story.
- [docs/architecture.md](docs/architecture.md): folders, boot order, state machine, the frame.
- [docs/islands.md](docs/islands.md): the island interface and how to add a level.
- [docs/systems.md](docs/systems.md): items, pickups, digs, powers, vines, hooks, hat, NPCs, cutscenes.
- [docs/code-style.md](docs/code-style.md): naming, parameters, comments, modern JS. **Follow it for every change.**
- [docs/testing.md](docs/testing.md): debug console (`window.__g`) and the play-test checklist.
- [docs/bugs.md](docs/bugs.md) and [docs/backlog.md](docs/backlog.md).

## Commands

- `npm run dev`: http://localhost:5173/spartacus-island/ (debug helpers on)
- `npm run build` / `npm run preview`: production build incl. service worker
- `npm run lint` (oxlint), `npm run format` (oxfmt), `npm run check` (lint + format check + build, run before pushing)

## Rules of thumb

- Islands are modules with one shared interface (`src/islands/islandN/index.js`); the loop and menus never branch on island number.
- **Build order matters:** all scenery shares one seeded `rand()`. Add new random scenery at the end of an island's `build()`, add new islands at the end of `ISLANDS` in `main.js`.
- Mutable shared state goes on objects (`game`, `followCam`, `player`), not exported `let`s.
- Don't call imported functions at module top level (there are harmless import cycles); do the work in `build()`.
- Text sprites: create inside `onFontsReady()`, start hidden.
- Every action check tests distance **and** height.
- Readable over dense: descriptive names, one subject + an options object, short "why" comments (see docs/code-style.md).
- Keep assets local (no CDNs): the game must work offline.
