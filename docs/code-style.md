# Code style

Write code for the next person to read it, whether that's Claudio in six months or a new contributor. Prefer plain, modern, standard JavaScript, and be brief without being clever.

## Tools

| Command                | Does                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`         | [oxlint](https://oxc.rs/docs/guide/usage/linter) (`.oxlintrc.json`)                                   |
| `npm run format`       | [oxfmt](https://oxc.rs/docs/guide/usage/formatter), a Prettier-compatible formatter (`.oxfmtrc.json`) |
| `npm run format:check` | What CI runs: fails if anything isn't formatted                                                       |
| `npm run check`        | Lint, format check and build: run it before pushing                                                   |

CI runs lint and the format check before every deploy, so a red lint blocks the release. Let the formatter handle layout and don't hand-align code.

## Names

- **Say what it is.** `player`, `followCam`, `terrainHeight(x, z)`, `distToSegmentXZ`, not `P`, `cam`, `terrainH`, `segDist`. Short names are fine where the meaning is obvious: `i` in a loop, `x`/`y`/`z`, `dt`, `t` for 0..1 progress, `a`/`b` for the two ends of something.
- **Functions are verbs:** `addHook`, `startClimb`, `completeTask`, `hintTooHigh`. Predicates read as questions: `isPlaying()`, `isMovementLocked()`, `allTasksDone()`.
- **Per-frame updates are `updateX(dt)`**, e.g. `updateGull`, `updateCrabs`. A context-button check is `xAction(p)` and returns `{label, run}` or `null`.
- **Factories:** `makeX()` builds a model and returns it without adding it to the scene. `addX(...)` builds it, places it in the world and registers it (colliders, lists).
- **Constants:** `UPPER_SNAKE` for tuning numbers and fixed world positions (`GRAVITY`, `JUMP_SPEED`, `CENTER_3`). camelCase for everything else, including mutable singletons (`game`, `player`, `followCam`).
- **Use the same name everywhere.** If a thing is `pos` in one place, don't call it `p`, `where` and `at` elsewhere. Common ones: `pos`/`vel` (Vector3), `x, z` (ground position), `y`/`top` (heights), `g` or `group` (a `THREE.Group`), `m` (a mesh inside a short builder), `it` (an item record), `c` (a collider).

## Functions and parameters

- **One subject, then an options object.** The first parameter is the thing the function is about. Anything else goes in a destructured object with defaults:

  ```js
  burst(pos, { count: 12, color: 0xffd84d, speed: 3, up: 2, life: 0.8 });
  addItem('key', { model: makeKey(), pos, name: 'key' });
  export function rock(x, z, { radius, height, color = 0xa3acb8 }) { … }
  ```

- **World positions are the exception.** Things placed on the ground take `(x, z, options)` because that's how every island lays itself out: `rock(4, -2, { radius: 1.2, height: 2 })`, `addDig(x, z, { reward })`.
- Small math helpers keep their usual positional form: `clamp(v, min, max)`, `lerp(a, b, t)`, `smoothstep(a, b, x)`.
- Lint enforces at most 3 parameters (`max-params`). If you need a 4th, it belongs in the options object.
- Return early instead of nesting. Keep functions short enough to read in one screen; if a block needs a comment to explain what it does, it can probably be a named function.

## Comments

Comments are for humans who know JavaScript but not this game.

- **Explain why, or what's not obvious.** For example: "build order matters: all scenery shares one seeded rand()", "coyote time and a jump buffer make jumps forgiving", "phone GPUs drew vertex colours black, so paint into a texture".
- **One line at the top of each module** says what lives there and how it's used.
- **Document data shapes** where they're defined: `// {type:'cyl', x, z, r, bottom, top}`.
- **Explain magic numbers** when the value matters for gameplay (reach distances, heights, timers). Leave the obvious ones alone.
- Don't narrate code (`// increment i`), don't leave commented-out code, and don't write long JSDoc blocks. A good name plus one short line beats a paragraph.

## Modern, native JavaScript

- ES modules, `const` by default, `let` only when the value is reassigned, never `var`.
- Use object spread (`{ ...defaults, ...opts }`), optional chaining (`I.buildLate?.()`), nullish coalescing (`y ?? terrainHeight(x, z)`), destructuring and template strings over their older equivalents.
- Use `===` (lint allows `== null` for null-or-undefined).
- Use `for…of` over index loops unless you need the index or are removing while iterating (then loop backwards).
- Use the platform: `document.querySelector`, `classList`, `addEventListener`, `matchMedia`, `localStorage`, WebAudio. No libraries beyond three.js unless there's a strong reason, and keep everything local so the game works offline.
- Avoid clever tricks such as comma expressions, `!!x &&` side effects, nested ternaries and bit tricks outside the RNG. If you need to stop and think about a line, rewrite it.

## Game-specific rules

These are easy to break when refactoring. See [architecture.md](architecture.md) for details.

- **Build order matters.** All scenery shares one seeded `rand()`. Don't reorder `rand()` calls inside `build()`; add new random scenery at the end.
- Shared mutable state lives on objects (`game`, `player`, `followCam`), not exported `let`s.
- Don't call imported functions at module top level (there are harmless import cycles). Do the work in `build()`.
- Create text sprites inside `onFontsReady()` and start them hidden.
- Every action check tests distance **and** height.
