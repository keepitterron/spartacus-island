# Spartacus's Island: docs

A cosy 3D browser game for Zoë (9). Spartacus, the family dog, is a pirate pup who sails from island to island, eats fruits that give him powers, solves gentle puzzles and gathers a crew of animal friends.

Live: https://keepitterron.github.io/spartacus-island/

| Doc | Read it when |
|---|---|
| [design-rules.md](design-rules.md) | **Before changing any gameplay.** Zoë's rules for the game. |
| [architecture.md](architecture.md) | You need to find your way around `src/`, the loop or the state machine. |
| [islands.md](islands.md) | You're adding or changing an island (level). Includes a step-by-step for island 5. |
| [systems.md](systems.md) | You're using or adding a building block: items, pickups, digs, powers, vines, hooks, NPCs, cutscenes, hints. |
| [testing.md](testing.md) | You want to run, debug or play-test the game (debug console, manual checklist). |
| [deployment.md](deployment.md) | You're shipping: GitHub Pages, PWA, icons, updates. |
| [bugs.md](bugs.md) | Known bugs, what v1 fixed, candidates for the bug bash. |
| [backlog.md](backlog.md) | What's next (from Zoë and from play-testing). |

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173/spartacus-island/. The debug console helpers (`window.__g`) are always on in dev.
