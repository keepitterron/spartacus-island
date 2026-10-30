# Spartacus's Island — handoff

A cosy 3D browser game Claudio is building for his daughter Zoë (9). Spartacus, the family dog, is a pirate pup who sails from island to island, eats fruits that give him powers, solves gentle puzzles and gathers a crew of animal friends. Zoë invents the story and the levels; we build them.

Everything so far lives in one file: `index.html` (~1,600 lines, no build step). It was built in a Claude.ai chat and published as a claude.ai artifact. This doc is what you need to keep going in Claude Code.

---

## 1. Who it's for (read this before changing gameplay)

These rules came from Zoë and are the whole point of the game:

- **No conflict.** No enemies, no damage, no health, no game over. "Grumpy" characters (the octopus) are obstacles with a happy ending, never villains.
- **Failing costs seconds, never progress.** Falling in water → a bubble carries you back to where you were ~2 s earlier. Tentacles and vents → a soft bonk back a few steps. Dropped items in water → float back to their spot in a visible bubble.
- **Cute even when challenging.** Challenge comes from timing, platforming and figuring things out (Rayman, Sackboy, Humans Fall Flat, Untitled Goose Game are her references).
- **One power at a time.** Each fruit gives a power; eating another swaps it. Bushes regrow, so swapping is part of the puzzles.
- **The friend you rescue helps on the next island.** Mango (parrot) fetches things on island 3; Wasabi (axolotl) is the breathing bubble on island 4; Eduardo (crab) will pinch through ropes on island 5.
- **Every new thing gets a one-time hint toast.** If a kid can't tell what to do, that's a bug.
- **Zoë writes the story.** Ask her (via Claudio) rather than inventing big story beats. She enjoys story-making more than drawing.

Other context: plays on phone (touch controls) and desktop (keyboard). Long term it should be playable **together with her friends** in the browser.

The dog is the real Spartacus: half pitbull, half labrador, shiny black coat, white stripe down the muzzle (thin), big white chest patch, white paw tips, floppy ears, hazel eyes. He wears a straw hat with a red band.

IP note: the straw hat and the "Chop-Chop fruit" name are One Piece nods. Fine for a private family game; rename/redesign before sharing publicly.

---

## 2. What's built

| # | Island | New power | Friend rescued | Core loop |
|---|---|---|---|---|
| 1 | (unnamed starter island) | Boing-Boing (super jump) | — | 7 tasks: bones, fruit, bark at seagull, lighthouse bell, carry plank to fix bridge, dig up key, open chest → map |
| 2 | Hook Rock Bay | Stretchy (swing from golden hooks) | Mango the parrot | Dig snack on a Boing-only mesa, swing rock-to-rock to the tall pillar, feed Mango, he rides your hat to the ship |
| 3 | Mossy Paw Woods | Grow-Grow (grow climbing vines + zipline vines from magic seeds) | Wasabi the blue axolotl | Climb a tree, zip treetop-to-treetop, Mango fetches a flower, trade it to the bees for a key, open the water gate, Wasabi swims down the refilled stream to the ship |
| 4 | Bubbly Ocean (underwater) | Chop-Chop (throw hat like a frisbee to cut seaweed) | Eduardo, purple hermit crab with black spots | Find 5 red hermit crabs (they parade behind you), chase Eduardo through a seaweed corridor guarded by tentacle gates, fetch the octopus's pillow through a bubble-vent canyon so he sleeps and moves aside, bring Eduardo to the ship, whale pushes the ship back to the surface |

Transitions: islands 1→2→3 by a sailing cutscene along a Catmull-Rom path; 3→4 by Wasabi's bubble sinking the ship (fade); 4 ends with the whale cutscene and a "To be continued…" screen.

Shared verbs: move, jump, bark (`B`), context action (`F` / green button: Grab, Drop, Dig, Fix, Open, Give, Swing, Grow, Zip, Chop, Sail), climb (walk into a grown vine), camera (`Q`/`E` or drag).

**Layouts for islands 3 and 4 are placeholders.** Zoë is meant to draw/describe the maps; positions are expressed in island-local coordinates (`W3(x,z)`, `W4(x,z)`) so her layout can be dropped in by editing numbers.

---

## 3. How the code is organised

Single file, plain script, `three@0.160.0` UMD build loaded from jsDelivr. Section markers in order:

1. **HTML/CSS** — HUD to-do list (collapsible, restart link), power badge, toast, action prompt, title card, touch controls (stick + Act/Woof/Jump), overlays (start, per-island wins, error, fade).
2. **Error overlay script** — catches errors and WebGL failures so phones show "Oops!" instead of a blank screen.
3. **renderer** — `LOW` flag for touch/small screens lowers pixel ratio, shadows, mesh density.
4. **terrain** — one height function per island (`island1H…island4H`) and a dispatcher `terrainH(x,z)` that picks by **z coordinate**. All islands live in one world, spread along −z: island 1 at z≈0, island 2 at −170, island 3 at −322, island 4 at −720 (seabed at y=−20, no global water there).
   `buildGround()` builds each island mesh and **paints colours into a texture** (vertex colours were invisible on some phone GPUs).
5. **colliders** — flat list of `{type:'cyl'|'box', x,z, r|hw,hd, bottom, top}`. Anything you can stand on or bump into. A cylinder with `.tree` set is climbable once its vine is grown. Disable one by setting `top=-999`.
6. **props / island blocks** — each island builds its own content and exports small objects (`LH`, `I2`, `T1…T4`, `HIVE`, `GATE`, `OCTO`, `gates`, `vents`, `crabs`…).
7. **items** — carryable things (`addItem`): carried in the dog's mouth (`dog.mouth`), `heavy` slows you and lowers jumps; float back if dropped in water.
8. **bones / acorns**, **fruits** (`addFruit`, `POWERS`, regrow), **dig spots** (`addDig`, reward handled in `finishDig`).
9. **NPCs** — seagull, Mango, Wasabi, octopus, crabs, Eduardo, whale. Each has a `state` string and an `upd*` function.
10. **Spartacus model** (`makeDog`) — returns `{root, body, head, ears, legs, tail, tongue, mouth, hat}`. Friends ride on `dog.head`.
11. **particles & sprites** — `burst()` (negative `grav` makes bubbles rise), `textSprite()` for "WOOF!", "Zzz", "A SHARK!!".
12. **audio** — all sounds are synthesised with WebAudio in `sfx` (no assets).
13. **tasks & UI** — `TASKS[n] = {title, done, list}`, `done1…done4` objects, `complete(id)` (ids are globally unique and route to the right island), `celebrate()` → win overlay.
14. **save** — `localStorage['spartacus-save'] = {v:3, island:n}`. Saves older than `v:3` are ignored and the game defaults to island 4. Hash overrides for testing: `#island2`, `#island3`, `#island4`.
15. **state machine** — `state` ∈ `start | play | rescue | sail | bubble | whale`. Player sub-states live on `P`: `swing`, `climb`, `zip`, `digT`, `carry`.
16. **actions** — `currentAction()` decides the context button label by priority; `doAction()` runs it.
17. **sailing** — `SAILS[n]` paths, `startSail()`, `enterIsland(n, arrived)` (sets ship, spawn, ambience, crew, tasks, save, title card).
18. **physics** — `stepPlayer()`: camera-relative input, gravity (16 underwater, else 30), coyote time + jump buffer, step-up of 0.5, side push-out, support from terrain or collider tops, climb entry, safe-position history for rescue.
19. **loop** — `update(dt)` with `dt` capped at 1/30; camera follow; per-island updates.

---

## 4. Lessons learned (bugs we already hit)

- **CSS: `.touch{display:none}` also matched `<body class="touch">`** → black screen on phones. Scope selectors (`div.touch`).
- **Vertex colours** didn't render on a phone GPU → ground is now a canvas texture.
- **Camera was clamped to y≥1.2** for the land islands; underwater it pushed the camera above the surface. The clamp is now per-island.
- **Big meshes in front of the camera** (the sunken ship, tall seaweed walls) hide the dog. Keep the area behind the spawn clear; tall walls are visually short with a taller invisible collider; the camera auto-turns down the seaweed corridor.
- **"Is it in water?" is per-island.** Underwater, terrain is below 0 everywhere; land-island water checks must not run there.
- **Multiple options from one spot** (two hooks on one pillar) → pick by facing direction, not distance.
- **Old saves** can strand you on the wrong island → saves carry a version number.
- **Text in sprites** needs the font loaded first; labels are created after `document.fonts.ready`.
- **Published claude.ai artifacts** have a strict CSP (scripts only from jsDelivr/cdnjs, no remote images). Irrelevant once self-hosted, but keep assets local.

---

## 5. Suggested first steps in Claude Code

1. **Get it into a repo as-is** and confirm it runs (`npx serve .`). Commit before refactoring.
2. **Move to Vite + ES modules** (`three` from npm). Suggested layout:
   ```
   src/
     main.js            // boot, loop, state machine
     core/              // renderer, input, camera, physics, colliders, audio, particles, ui, save
     player/            // dog model, animation, actions (carry, dig, swing, climb, zip, chop)
     powers.js          // fruit definitions
     islands/
       island1.js … island4.js   // each exports { build(world), update(dt), interact(p), tasks, spawn, onEnter }
     npcs/              // gull, mango, wasabi, octopus, crabs, eduardo, whale
   ```
   The biggest win is giving every island the same interface so `enterIsland` and the update loop stop branching on `island===n`.
3. **Make layouts data.** Move island 3/4 positions into a JSON/JS object per island (trees, vines, pads, hooks, clumps, vents, crabs). Zoë's maps then become a data edit.
4. **Add a debug mode** (`?debug`): expose `window.__g`, teleport to named spots, toggle tasks, give powers, show colliders.
5. **Add smoke tests with Playwright.** What worked in chat: headless Chromium with `--use-gl=swiftshader`, a small viewport (software rendering is ~3 fps), poll `window.__g` instead of sleeping, teleport the player to each step and press `F`. Keep each test short; whole-island runs take minutes.
6. **Deploy** to GitHub Pages or Netlify so Zoë and friends can open a link.

---

## 6. Backlog

From Zoë and from playtesting:

- **Island 5** — story not written yet. Eduardo's ability is pinching through ropes. Ask Zoë: where does the whale leave the ship, what's tied up, who needs rescuing.
- **Zoë's layouts** for Mossy Paw Woods and Bubbly Ocean (currently placeholders).
- **Spartacus details:** floppy labrador ears (currently short) and hazel eyes (currently brown).
- **Tuning to check with her:** tentacle rhythm (~60% safe), vent push strength, number of crabs, whether the lily pads (island 1) and hook-choosing (island 2) are too fiddly. A small arrow showing the selected hook was suggested.
- **Mid-island saves** (only island-level saves today; would need to persist grown vines, found items, etc.).
- **Multiplayer** (the long-term goal): host-authoritative — one browser runs physics, others send inputs. Options discussed: PeerJS/WebRTC with a share code, or PartyKit/Colyseus. Friends play crew members, each with a built-in ability (Mango glides/carries, Wasabi swims/bubbles, Eduardo pinches), which makes co-op puzzles natural. `stepPlayer` is already isolated, which helps.
- **Ship home base** (Minecraft-style): spend bones/acorns/crabs on ship decorations, sail patterns, hats; rescued friends live on the ship.
- **Performance on phones:** instancing for repeated props (flowers, coral, seaweed strips, rocks) and merging static meshes per island.
