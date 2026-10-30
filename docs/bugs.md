# Bugs

## Open

### BUG-1: WebGL context lost right after the first frame in headless Chrome (software GL)

**Status:** open, parked for the bug bash. Found 30 Oct 2026 while verifying the Vite build.

**What happens:** in headless Chrome with `--use-gl=swiftshader`, the Vite build loses its WebGL context ~0.5 s after load, on every fresh browser (5/5 runs). Every shader program then fails to link (`THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false`, empty info log), three.js throws `Cannot read properties of null (reading 'trim')` in `getUniforms`, and the error overlay shows "Something went wrong". The original single-file `index.html` (first commit) never loses the context in the same harness (0/5).

**Not affected (so far):** the Claude desktop in-app browser with a real GPU. The whole game was played through there with no context loss. Real phones are untested: this could be the same failure on weak GPUs, so it matters.

**Ruled out:**
- three.js version: same with 0.160.0 (the original's) and 0.160.1.
- Fonts / text labels: happens with fonts blocked, delayed, not loaded, and with no labels created. Font timing only changes *when* the loss is reported (the main thread is busy compiling shaders for ~2 s, so the event arrives late).
- Any one island: happens with every island's `build()` skipped, including all four at once. So it's in shared code (core, world, player, systems, npcs) or in how the bundle is loaded.
- Something calling `loseContext()`: only one WebGL context exists and nothing in the page calls it. The GPU process drops it.
- HTML overlays: same with every overlay hidden.

**Next ideas:** diff what the first frame draws between old and new (object/material/texture counts, render targets, texture sizes); check that `renderer` setup (pixel ratio, shadow map type, `antialias`) and canvas size are identical at the first `render()`; try the old file with three from npm and Vite (no other changes) to see whether bundling alone triggers it; try `renderer.compile()` before the first frame; listen for `webglcontextrestored` (three does rebuild: programs relink ~frame 65) and recover instead of showing the error overlay.

**Repro:** `npm run build && npm run preview`, then open http://localhost:4173/spartacus-island/ in headless Chrome with `--use-gl=swiftshader --enable-unsafe-swiftshader` and watch the console for `CONTEXT_LOST_WEBGL`.

## Fixed in v1 (Vite migration, Oct 2026)

| Bug | Fix |
|---|---|
| New players saw "Continue: Island 4" as the main button (a testing default left in) | Start at island 1; Continue only appears with a real save |
| "Keep exploring" on islands 3 and 4 left no way to progress: no Dive/Ride action anywhere | Every island has an `exit`: Dive from island 3's dock end, Ride at the ship on island 4 |
| One tap on "Start from the beginning" wiped a saved game | Needs a second tap when there's a save to lose |
| Bush name signs rendered in a fallback font (created before the font loaded) | All text labels created in `onFontsReady()`; Fredoka bundled locally |
| Fonts came from Google, so nothing worked offline | Self-hosted font + service worker precache |
| "Too high" hint cooldown counted frames, not seconds (twice as chatty at 120 Hz) | Uses `dt` |
| Bees' key could be forced into the mouth while already carrying something, losing the other item | Key waits on the hive if Spartacus is busy |
| Keys pressed while a win panel was open still jumped/acted behind it | Game keys ignored while a panel is open; the main button gets focus |
| Toasts covered the green action button on phones | Toasts sit higher on touch screens |
| Labels (Zzz, Thirsty…) could appear floating at the world origin when continuing on a later island | Labels start hidden |
| Water surface animated every frame even underwater | Skipped underwater |
| Long-press on phones could open the system callout / context menu | Disabled on the game canvas and UI |
| `sfx.boing` defined twice | Removed the duplicate |

## Candidates for the bug bash

- BUG-1 above (and recover from context loss instead of showing an error).
- Progress is only saved on arrival at an island: closing the tab with a finished list means redoing it.
- Pressing a win-panel button while in a bubble rescue does nothing (the panel stays; tapping again later works).
- Only island-level saves: grown vines, dug spots etc. reset on reload (see backlog: mid-island saves).
- Tuning to check with Zoë: tentacle rhythm (~60% safe), vent push strength, number of crabs, lily pads (island 1) and hook choosing (island 2). A small arrow on the selected hook was suggested.
- Non-QWERTY keyboards: movement uses `e.key` (WASD), so AZERTY layouts get odd keys; `e.code` would fix it.
