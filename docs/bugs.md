# Bugs

## Open

### BUG-1: WebGL context lost right after the first frame in headless Chrome (software GL)

**Status:** open, parked for the bug bash. Found 30 Oct 2026 while verifying the Vite build.

**What happens:** in headless Chrome with `--use-gl=swiftshader`, the Vite build loses its WebGL context ~0.5 s after load, on every fresh browser (5/5 runs). Every shader program then fails to link (`THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false`, empty info log), three.js throws `Cannot read properties of null (reading 'trim')` in `getUniforms`, and the error overlay shows "Something went wrong". The original single-file `index.html` (first commit) never loses the context in the same harness (0/5).

**Not affected (so far):** the Claude desktop in-app browser with a real GPU. The whole game was played through there with no context loss. Real phones are untested: this could be the same failure on weak GPUs, so it matters.

**Ruled out:**

- three.js version: same with 0.160.0 (the original's) and 0.160.1.
- Fonts / text labels: happens with fonts blocked, delayed, not loaded, and with no labels created. Font timing only changes _when_ the loss is reported (the main thread is busy compiling shaders for ~2 s, so the event arrives late).
- Any one island: happens with every island's `build()` skipped, including all four at once. So it's in shared code (core, world, player, systems, npcs) or in how the bundle is loaded.
- Something calling `loseContext()`: only one WebGL context exists and nothing in the page calls it. The GPU process drops it.
- HTML overlays: same with every overlay hidden.

**Next ideas:** diff what the first frame draws between old and new (object/material/texture counts, render targets, texture sizes); check that `renderer` setup (pixel ratio, shadow map type, `antialias`) and canvas size are identical at the first `render()`; try the old file with three from npm and Vite (no other changes) to see whether bundling alone triggers it; try `renderer.compile()` before the first frame; listen for `webglcontextrestored` (three does rebuild: programs relink ~frame 65) and recover instead of showing the error overlay.

**Repro:** `npm run build && npm run preview`, then open http://localhost:4173/spartacus-island/ in headless Chrome with `--use-gl=swiftshader --enable-unsafe-swiftshader` and watch the console for `CONTEXT_LOST_WEBGL`.

## Found in the scripted play-throughs (Nov 2026)

Islands 3, 4, 6 and 7 were played start to finish in headless Chrome at 844×390 with touch on (reload and Continue included). Fixed on the spot: island 3's Give at the hive (the zipline lands outside its reach), island 4's vent canyon (no way through, the pillow unreachable), island 6's Sail spot and a Mini-Me hint, island 7's gondola camera, the kelp pillar's "another magic seed" hint, and intro lines that never closed. Still open:

- **The to-do list covers a third to half of the screen on an iPhone held sideways**, including the top of the stick, and hid island 7's red rocket from Bullseye Rock. Every play-through flagged it. Probably: start collapsed on small screens.
- **The win panel is too tall** at 844×390: the top of "What a Jamboree!" is cut off.
- **Island 6: a full-size dog can flap round either end of the tunnel walls** and skip the Mini-Me holes (walls 7 m longer didn't stop it). Nobody gets stuck (the cubby still needs Mini-Me). A roof or curved ends, or accept it.
- **An open speech box's Next outranks Swap and Place** (island 6), and Lina's palace lines never close on their own because she flies along with him.
- Hints that fire at odd moments: "Up high? SLAM down!" while floating on island 6; island 4's crab hint 0.3 s after arriving, before the story; island 3's "gate is open" toast waits behind a slam tip.
- **Worth watching with Zoë:** island 6's Swap window at Leo's nest (about 1.4 s each time he lands); island 4's canyon timing (0.7 s of every 3 s; widen the 0.6 s vent step to 0.5 if it's too hard); island 7's Leo often flies behind the camera after a woof; the 9 o'clock wheel ticket means riding past the top while the hint says jump out at the top; pressing the green button too far from the octopus drops the pillow.
- Not played: island 7's Skittles Alley and the rides while giant.

## Fixed since v1

| Bug                                                                                                                                                                                                                                                                                                                                                               | Fix                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Island 4: the screen went solid blue when the camera rose high (the lift vent, the ledge, big jumps). Island 5's sea patch reaches back over island 4's basin, and its flat sea floor (4.2 m below the surface) was drawn there: a camera above it looked down onto it (Nov 2026, reported by Claudio)                                                            | Sea patches' floors aren't drawn while under water (`world/ocean.js`)                                                                                                                                                                      |
| Phones: the touch stick could get stuck walking forward, and touching it again did nothing. The stick only let go on its own finger's "lifted" event, which phones sometimes never send (a notification or the control centre slides over, the app is switched, an edge swipe), and it ignored new touches while it thought that finger was still down (Nov 2026) | A new touch always takes the stick over; a lost touch (`lostpointercapture`) counts as lifting the finger; leaving the page (blur, hidden) lets go of the stick, Jump and the camera drag, like the keyboard already did (`core/input.js`) |

## Fixed in v1 (Vite migration, Oct 2026)

| Bug                                                                                                | Fix                                                                                     |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| New players saw "Continue: Island 4" as the main button (a testing default left in)                | Start at island 1; Continue only appears with a real save                               |
| "Keep exploring" on islands 3 and 4 left no way to progress: no Dive/Ride action anywhere          | Every island has an `exit`: Dive from island 3's dock end, Ride at the ship on island 4 |
| One tap on "Start from the beginning" wiped a saved game                                           | Needs a second tap when there's a save to lose                                          |
| Bush name signs rendered in a fallback font (created before the font loaded)                       | All text labels created in `onFontsReady()`; Fredoka bundled locally                    |
| Fonts came from Google, so nothing worked offline                                                  | Self-hosted font + service worker precache                                              |
| "Too high" hint cooldown counted frames, not seconds (twice as chatty at 120 Hz)                   | Uses `dt`                                                                               |
| Bees' key could be forced into the mouth while already carrying something, losing the other item   | Key waits on the hive if Spartacus is busy                                              |
| Keys pressed while a win panel was open still jumped/acted behind it                               | Game keys ignored while a panel is open; the main button gets focus                     |
| Toasts covered the green action button on phones                                                   | Toasts sit higher on touch screens                                                      |
| Labels (Zzz, Thirsty…) could appear floating at the world origin when continuing on a later island | Labels start hidden                                                                     |
| Water surface animated every frame even underwater                                                 | Skipped underwater                                                                      |
| Long-press on phones could open the system callout / context menu                                  | Disabled on the game canvas and UI                                                      |
| `sfx.boing` defined twice                                                                          | Removed the duplicate                                                                   |

## Candidates for the bug bash

- BUG-1 above (and recover from context loss instead of showing an error).
- Progress is only saved on arrival at an island: closing the tab with a finished list means redoing it.
- Islands 1–4 only have island-level saves: grown vines, dug spots etc. reset on reload (island 5 saves mid-island; see backlog).
- Tuning to check with Zoë: tentacle rhythm (~60% safe), vent push strength, number of crabs, lily pads (island 1) and hook choosing (island 2). A small arrow on the selected hook was suggested.
- Non-QWERTY keyboards: movement uses `e.key` (WASD), so AZERTY layouts get odd keys; `e.code` would fix it.
