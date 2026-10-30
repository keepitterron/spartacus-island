# Architecture

Plain JavaScript ES modules, bundled by Vite. `three` is pinned to **0.160.0** (the version the game was built against). No framework, no assets except the font and icons: every model is built from three.js primitives and every sound is synthesised.

## Folders

```
index.html            HUD, touch controls, overlays (start, win, end, error)
src/
  main.js             boot: register islands, build the world in order, wire menus/input, main loop
  style.css
  core/               engine-level helpers, no game rules
    state.js          game (shared mutable game state) and followCam (camera settings)
    util.js           math helpers, seeded rand(), vec3(), distXZ(), distToSegmentXZ()
    renderer.js       renderer, scene, camera, lights, LOW_POWER flag, setUnderwater()
    materials.js      material() (cached), mesh(), canvasTexture(), drawPaw()
    colliders.js      collider list, addCylinder/addBox, supportHeight, pushOut
    input.js          keys, touch stick, drag-to-look, moveAxis(), bindInput()
    audio.js          sfx.* (WebAudio synth)
    fx.js             burst() particles, textSprite(), onFontsReady()
    ui.js             toast, hintOnce, showTitleCard, armButton, overlayOpen
    save.js           localStorage save, continueIsland()
  world/              things shared by all islands
    layout.js         island centres CENTER_1..CENTER_4
    terrain.js        addTerrain / terrainHeight dispatcher, buildGround()
    props.js          palm, rock, rockTop, crate, scatter, dock
    ocean.js          sea floor + animated water surface
    ship.js           the ship, its bubble, placeShipAt, onDeck, addBucket
    sky.js            clouds
  player/
    player.js         player (state), stepPlayer physics, bubble rescue
    dog.js            Spartacus model + animateDog
  models/items.js     small reusable models (plank, key, bone, acorn, flower, pillow, seed…)
  systems/            reusable gameplay building blocks (see systems.md)
    items.js  collect.js  digs.js  powers.js  vines.js  hooks.js  hat.js
  npcs/               crew members that travel between islands: gull, mango, wasabi
  cutscenes/          sail.js, bubble.js (island-agnostic)
  game/
    tasks.js          to-do lists, completeTask(), celebrate, win panel
    actions.js        context button (currentAction / doAction), bark, prompt
    interact.js       per-frame walk-into triggers (checkTriggers), hintTooHigh()
    flow.js           startGame, enterIsland, restart
    camera.js         follow camera with per-island hooks
    debug.js          window.__g helpers (dev / ?debug)
  islands/
    island1/ … island4/   one module per island (see islands.md)
```

## Boot order (main.js)

1. **Register** each island: `game.islands[island.id] = island`, `initTasks(island)`, `addTerrain(island.zMax, island.height)`. All terrain must exist before anything is built, because props sit on `terrainH`.
2. **Build** every island in play order (`island.build()`), then `buildSky()`, then `island.buildLate()`.
   **Order matters:** all scenery uses one seeded generator (`rand()` in `core/util.js`). Building in a different order, or adding a `rand()` call in the middle of an existing island, moves trees/flowers/coral around. Put new random scenery at the end of your island's `build()`, or add a new island after the others.
   `buildLate()` is for things that don't use `rand()` (fruit bushes, dig spots).
3. Wire HUD/menus and input, start `frame()`.

## Shared state

ES modules can't reassign each other's `let`s, so mutable game state lives on objects:

- `game` (`core/state.js`): `state`, `island`, `islands`, `cutscenes`, `time` (seconds since boot, drives idle animation), `flagUp`, celebration, hint cooldown.
- `followCam`: follow-camera `yaw`/`height`/`distance`.
- `player` (`player/player.js`): `pos`, `vel`, `power`, `carrying`, and sub-states `swing`, `climb`, `zip`, `digTimer`, `placing`. Timers ending in `Timer`/`Cooldown` count down in seconds.
- `currentIsland()` = the current island module; `isPlaying()`, `isInCutscene()` for the common state checks.

There are a few circular imports (e.g. `player.js` ↔ `systems/vines.js`). They are fine because they only use each other inside functions, never at module top level. Keep it that way: don't call imported functions while a module is being evaluated, put that work in `build()`.

## State machine

`game.state` is one of:

| state                     | meaning                                               | who sets it                                                                   |
| ------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `start`                   | title screen, camera orbits island 1                  | initial                                                                       |
| `play`                    | normal play                                           | `startGame`, `enterIsland`, end of rescue                                     |
| `rescue`                  | bubble carrying Spartacus back after falling in water | `startRescue`                                                                 |
| `sail`, `bubble`, `whale` | cutscenes                                             | registered in `game.cutscenes`; each has `update(dt)` and optionally `skip()` |

Inside `play`, one of these drives the player each frame: `player.swing` → `updateSwing`, `player.climb` → `updateClimb`, `player.zip` → `updateZip`, otherwise `stepPlayer` (+ digging and item placing).

## The frame (main.js `update`)

1. Global updates: ocean, sky, ship, pickups, fruits, digs, hooks, vines, hat, crew NPCs (gull, Mango, Wasabi).
2. `currentIsland().update(dt)`: only the **current** island animates its own things.
3. Particles, woof label, sun follows the player (the shadow camera is small).
4. Start screen or cutscene? run it and return.
5. Otherwise: move the player, `checkTriggers(dt)` (pickups, fruits, island triggers), prompt, dog animation, camera.

`dt` is capped at 1/30 s, so a slow phone runs in slow motion rather than tunnelling through things.

## Coordinates

All islands share one world spread along −z (`world/layout.js`). Each island owns a band of z for its terrain (`zMax` in the island module) and positions its content in island-local coordinates via a `toWorld(x, z)` helper in each island, so a new map from Zoë is a matter of editing numbers.

The underwater island sits at z=−720 with its sea bed at y=−20 and no global water; "is this water?" is a per-island question (`physics.water`).

## Rendering notes

- `LOW_POWER` (touch or small screen) lowers pixel ratio, shadow map size and mesh density.
- Ground colours are painted into a canvas texture: vertex colours rendered black on some phone GPUs.
- Text labels (`textSprite`) must be created inside `onFontsReady()`, or they render in a fallback font. Create them `visible=false` and let an update function show them.
- Tall walls that would hide the dog are visually short with a taller invisible collider (`colH`), and the island 4 camera turns down the seaweed lane (`camera.assist`).
