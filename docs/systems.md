# Systems (building blocks)

Reusable pieces in `src/systems/`, `src/npcs/`, `src/cutscenes/` and `src/game/`. Islands combine these; if you write the same thing twice in two islands, it probably belongs here.

## Colliders (`core/colliders.js`)

A flat list of cylinders and boxes: `addCylinder(x, z, {r, bottom, top})`, `addBox(x, z, {hw, hd, bottom, top})`. Anything taller than a step (0.5) pushes the player out sideways; anything lower can be stood on. Set `c.top=-999` to switch one off (cut seaweed, opened gate). `supportHeight(x, z, maxY)` gives the floor height under a point.

## Items (`systems/items.js`)

Carried in the mouth, one at a time.

```js
addItem('pillow', { model: makePillow(), pos, heavy: false, name: 'pillow', lift: 0.2, reach: 1.6, onCarry(it) {…} })
```

- `heavy` items slow Spartacus and stop super jumps and climbing.
- Dropped in water (on islands with `physics.water`) they float home in a bubble with sparkles.
- `carryItem(it)` puts one in the mouth (e.g. straight from a dig), `useUpCarried()` consumes the carried one (given away), `placeItem(to,onDone)` tweens it into place and locks movement while it moves (the bridge plank).
- `grabAction`/`Drop` are offered automatically by the context button.

## Pickups (`systems/collect.js`)

Spinning collectibles counted per island (bones, golden acorns). Configure `collect` on the island, then `addPickup(x, z, {y, island, pop})`. The task text: `pickupText(id,'bones')`.

## Dig spots (`systems/digs.js`)

`addDig(x, z, {reward, marked, y})`: reward is a function `d=>{…}` that runs when digging finishes (spawn a pickup with `pop`, or `carryItem(addItem(…))`). `marked` adds a red X. `digNear(p,r)` for hints.

## Powers and fruits (`systems/powers.js`)

`POWERS` defines each power: `name`, `icon`, `sparkleColors`, `signColor`, `bushColor`, `intro()`, `introMs`. `addFruit(x, z, {type, y, bush})` places one (bush = regrowing bush with a name sign). Eating sets `player.power` and flags (`player.superJump`, `player.canStretch`) and completes any task with `power:type` on the current island.

**Adding a power:** add an entry to `POWERS` and a texture to `fruitSkins`, then implement what it does, usually as an action (`chopAction`-style function returned from the island's `actions(p)`) or a physics flag read in `stepPlayer`.

## Vines (`systems/vines.js`), Grow-Grow

- A _tree_ is `{x,z,gh,top,grown}` with a collider whose `.tree` points back to it (`bigTree` on island 3, kelp `pillar` on island 4).
- `climbVine(tree, towardX, towardZ)`: a seed at the foot; once grown, walking into the trunk climbs it. A tree standing on a rock instead of the terrain sets `raised: true` (island 5's sea stack): the seed sits at `gh` and climbing down stops there.
- Islands only offer Grow / Zip if their `actions(p)` returns `vineAction(p)`.
- `zipVine(a,b)`: a seed on top of `a` grows a zipline to `b`.
- `vineAction(p)` gives Grow / Zip.

## Hooks (`systems/hooks.js`), Stretchy

`addHook(a,b)` between two landing spots `{x,y,z}`. With Stretchy, standing on either end offers Swing; when several hooks start from one spot, the one Spartacus faces wins (`swingOption`).

## Hat (`systems/hat.js`), Chop-Chop

`addChoppable({x,y,z,onChop(c)})` registers something the hat can cut. `chopAction(p)` throws the hat at the nearest one; everything within 1.9 of the target is cut too.

## Bark and pound reactions (`systems/reactions.js`)

`barkReactions(pos)` runs on every bark (and `poundReactions(pos)` on every ground-pound landing), on every island, before the island's own `bark(p)` (or `pound(p)`). Palms within 7 shake and usually drop a coconut that bounces and pops back into its tree after 12 s (`palms` is filled by `palm()` in `world/props.js`). Add new reactions here: anything that just reacts to a bark, without being part of a puzzle.

## Beach balls (`systems/balls.js`)

Islands list `balls: [[x, z], …]` (island-local). Home-made physics, no library: gravity, bounces, rolling friction, pushed out of colliders. Running into a ball kicks it, a bark shoves balls within 6, a ground pound launches them. A ball in the water (sea or pond) bobs for 2.5 s, then pops back to the last dry spot it rested on (at least 0.3 above the sea), so a bad kick costs seconds, not the kicking before it. Balls further than 70 from Spartacus sleep. `addBall(x, z)` adds one at runtime (Wasabi brings one up on island 5); `ballsNear(x, z, r)` gives puzzles the balls nearby, whose `pos` and `vel` they may nudge (island 5's plates pull a slow ball in).

## Ambient critters (`systems/critters.js`)

Islands list spots: `critters: { birds: [[x, z]], butterflies: [[x, z]], fish: [[x, z, height]] }`. Each spot gets a flock of 6 birds, 3 butterflies or a school of 8 fish. Birds scatter when Spartacus runs or ground-pounds within 4.5, or barks within 10, swirl around and land again ~9 s later. Butterflies loop over their spot and drift away if he comes close. Fish circle and dart round wide after a bark. Every kind is a few `InstancedMesh`es (6 draw calls in total); spots further than 80 aren't animated.

## Movement tuning (`player/player.js`)

`MOVE` holds the tuning numbers (`sprint`, `runAfter`, `fullPush`, `wadeSpeed`, `current`); in debug it's `__g.move`, so you can change them live.

- **Running:** Shift, or keep the stick (or keys) pushed all the way for `runAfter` seconds; never while carrying something heavy or wading. Running kicks up dust.
- **Water** (islands with `physics.water`): below the surface he wades and paddles at `wadeSpeed`. Where it's too deep to stand, the surface holds him up like ground (`player.swimming`, feet at `SWIM_Y`), so he paddles around, bobbing, and can hop out with an ordinary jump (no Boing-Boing from the water). Over the open sea (floor deeper than `OPEN_SEA`) a current of `current` carries him back towards the island centre, faster than he paddles. Falling in deep water makes a big splash. There's no drowning and no rescue bubble (Zoë found it frustrating).
- **Ground pound** (`player/pound.js`): in the air, at least 1.3 above whatever is below, the action button offers **Slam** (it's last in the action list, so island actions, swing, drop, grab and dig win). Three beats: a 0.45 s wind-up (he rises a little and does one eased somersault), a stretched drop with a puff trail, and a 0.3 s landing pause (squash, sand ring; movement locked). `poundPose()` gives `dog.js` the body pitch and stretch directly, so the somersault isn't smoothed away. Landing calls `poundReactions(pos)`: palms shake, and a sand mound right underneath is dug up instantly (`poundDig`).

## NPCs

Crew members who travel live in `src/npcs/`; island-only characters live in their island folder (`island4/octopus.js`, `crabs.js`, `eduardo.js`).

- **Gull**: sleeps on island 1, wakes on bark, then circles the ship.
- **Mango**: `placeMango`, `mangoHop` (onto the hat), `mangoToShip(onArrive)`, `ensureMangoCrew()`, and `mangoFetch(to, mesh, onDrop)` for errands on later islands.
- **Wasabi**: island 3 drives her story (stuck → happy → swim); `wasabiFollow()` makes her swim beside Spartacus; `wasabiToBucket()` puts her back on deck; `wasabiFetch({from, to, carried, onDrop})` has her pop up at `from` with something and paddle it ashore (island 5).
- **Eduardo** (`islands/island4/eduardo.js`): `ensureEduardoCrew()` on deck, `eduardoRideHat()` on Spartacus's hat (island 5, where Pinch needs him there).
- **Unicorn** (`npcs/unicorn.js`): met on island 5. `addUnicorn(x, z, {y, yaw})`, `colourStripe(i, color)` (one of her four grey mane/tail stripes gets its colour back, with a hop), `setHornGlow(k)`, `unicornFollow()`, `unicornBoard(onAboard)`, `unicornAboard()`. States `sad` | `happy` | `follow` | `boarding` | `crew`. Updated from island 5 for now; move `updateUnicorn` into the main loop when island 6 needs her.

Pattern: each NPC has a `state` string and an `update…(dt)` function that switches over the states, one small helper per state. Riders are attached to `dog.head`; crew on the ship are attached to `ship`.

## Cutscenes

Register `game.cutscenes.name = {update(dt), skip?()}` and set `game.state = 'name'`. While one runs, the player is not simulated (put Spartacus on deck with `player.pos.copy(onDeck())`), the power badge hides, and Enter/Space/Escape call `skip()`.

- `startSail(path, onArrive)`: ship follows a Catmull-Rom path (~13 s, skippable).
- `startBubble(onDone)`: island 3 → 4.
- `startWhale()`: island 4 ending; it sails on to island 5 unless that's a `preview` (then dev/`?debug` only). `makeWhale()` builds the model (island 5's lagoon has one whose spout throws Spartacus up).
- `startRainbowRide()` (`islands/island5/finale.js`): island 5 ending, the ship rides a rainbow road up into the sky.

## Tasks, celebration, hints (`game/`)

- `completeTask(id)`: ticks a task on whichever island owns it; when a list completes: `onAllDone`, spin + confetti, then the win panel.
- `hintOnce(id, msg, ms)`: once per session. `hintTooHigh(near, msg)`: repeating (10 s) "you need Boing-Boing".
- `toast(msg,ms)` for everything else. Keep messages short and kind.

## Sounds (`core/audio.js`)

`sfx.name()`. Everything goes through one master gain, so `setMuted(bool)` (the 🔊 button or `M`, saved as `muted`) silences it all. Everything is synthesised from `tone(fromHz, {to, duration, type, volume, delay})` and `noise(duration, {freq, volume, delay})`; add a new sound as a one-liner. Audio unlocks on the first tap/click (`audioContext()`).

## Music (`core/music.js`)

Each island has a tune as data: `music: {tempo, root, wave, melody, bass}`. `melody` and `bass` are 16 half-beat steps counting up the major pentatonic scale from `root` (a MIDI note): 0 is the root, 5 an octave up, -5 an octave down, `null` a rest. Any steps sound fine together, so Zoë can make up tunes as lists of numbers. A look-ahead scheduler plays it from `startMusic()` (called when the game starts), switching tune when the island changes. There's deliberately no ocean/waves ambience (Zoë found it unsettling). 🎵 / `N` turns the music off (saved as `music`); 🔊 / `M` mutes everything. Footsteps (`sfx.step`) sound different on sand, grass, wood and in shallow water.

## Day and night (`world/daylight.js`)

The 🌙 button (or `L`, saved as `night`) fades to night over 2.5 s: sky, fog, sun and hemisphere light lerp to moonlit colours (a darker blue underwater), stars appear, butterflies sleep and fireflies come out (`systems/critters.js`), and the island tune plays slower and softer. It's a toggle rather than a timed cycle; ask Zoë which she prefers. `daylight.night` (0..1) is what other systems read.

## Save (`core/save.js`)

`{v:5, island, muted, music, night}` in `localStorage['spartacus-save']`. `writeSave(data)` merges, so each system writes only its own fields (the island on arrival, the toggles when they change). When the shape changes, bump `VERSION` and add a step to `migrate()`: v3 and v4 saves keep their island and toggles (v4's dress-up fields are dropped). `#islandN` in the URL overrides it for testing.

**Mid-island saves** (`game/progress.js`), only for islands with `savesProgress: true` (island 5 so far; islands 1–4 still only save which island you're on). The save's `progress` field holds the ticked tasks, the pickup count, taken pickups, dug mounds and grown seeds (by spot, `spotKey(x, z)`), each item's state and position (by id), the power, the last dry spot Spartacus stood on, and the island's own `saveState()`. It's written every 5 s, on every ticked task and when the page is hidden. Continue puts it back (`restoreProgress`, after `enter()`), with toasts silenced (`game.restoring`); arriving by ship or starting over clears it. Systems know whose digs, seeds and items they add from `game.building` (set in `main.js` around each `build()`), or the current island at runtime.
