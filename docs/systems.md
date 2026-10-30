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
- `climbVine(tree, towardX, towardZ)`: a seed at the foot; once grown, walking into the trunk climbs it.
- `zipVine(a,b)`: a seed on top of `a` grows a zipline to `b`.
- `vineAction(p)` gives Grow / Zip.

## Hooks (`systems/hooks.js`), Stretchy

`addHook(a,b)` between two landing spots `{x,y,z}`. With Stretchy, standing on either end offers Swing; when several hooks start from one spot, the one Spartacus faces wins (`swingOption`).

## Hat (`systems/hat.js`), Chop-Chop

`addChoppable({x,y,z,onChop(c)})` registers something the hat can cut. `chopAction(p)` throws the hat at the nearest one; everything within 1.9 of the target is cut too.

## Outfits and secrets (`systems/outfits.js`, `systems/secrets.js`, `game/wardrobe.js`)

- **Catalog:** `models/accessories.js` is a data list `{id, name, icon, slot, anchor?, build()}`. Slots: `head` (swaps out the straw hat, which is always owned), `face`, `neck`, `back`, `tail`. `build()` returns a group in the anchor's local space; the comment at the top of the file says where each anchor's origin is. Add `group.userData.animate = (group, time) => …` for things that move (wings, capes).
- **Wearing:** `wear(id)`, `takeOff(slot)`, `giveAccessory(id)`, `randomOutfit()`. The head slot lives in `dog.hat`, so Chop-Chop throws whatever hat is worn.
- **Secrets:** each island lists `secrets: [{id, x, z, reward, y?, dig?}]` in island-local coordinates. A present sits on the highest surface at that spot (rock tops, pillars, tree decks) unless `y` is given; `dig: true` buries it in an unmarked mound. Walking into one opens it, gives and wears the accessory, and shows it spinning above Spartacus. Presents only glitter within 12 units. The to-do list shows `🎁 Secrets n/m`, which never blocks finishing an island.
- **Wardrobe:** the 👕 button (or `O`) opens the dress-up panel as the `wardrobe` cutscene, so the camera can circle Spartacus while the player is frozen. Back and tail tabs look from behind.

## Bark reactions (`systems/reactions.js`)

`barkReactions(pos)` runs on every bark, on every island, before the island's own `bark(p)`. Palms within 7 shake and usually drop a coconut that bounces and pops back into its tree after 12 s (`palms` is filled by `palm()` in `world/props.js`). Add new reactions here: anything that just reacts to a bark, without being part of a puzzle.

## Movement tuning (`player/player.js`)

`MOVE` holds the tuning numbers (`sprint`, `runAfter`, `fullPush`); in debug it's `__g.move`, so you can change them live. Running: Shift, or keep the stick (or keys) pushed all the way for `runAfter` seconds; never while carrying something heavy. Running kicks up dust.

## NPCs

Crew members who travel live in `src/npcs/`; island-only characters live in their island folder (`island4/octopus.js`, `crabs.js`, `eduardo.js`).

- **Gull**: sleeps on island 1, wakes on bark, then circles the ship.
- **Mango**: `placeMango`, `mangoHop` (onto the hat), `mangoToShip(onArrive)`, `ensureMangoCrew()`, and `mangoFetch(to, mesh, onDrop)` for errands on later islands.
- **Wasabi**: island 3 drives her story (stuck → happy → swim); `wasabiFollow()` makes her swim beside Spartacus.

Pattern: each NPC has a `state` string and an `update…(dt)` function that switches over the states, one small helper per state. Riders are attached to `dog.head`; crew on the ship are attached to `ship`.

## Cutscenes

Register `game.cutscenes.name = {update(dt), skip?()}` and set `game.state = 'name'`. While one runs, the player is not simulated (put Spartacus on deck with `player.pos.copy(onDeck())`), the power badge hides, and Enter/Space/Escape call `skip()`.

- `startSail(path, onArrive)`: ship follows a Catmull-Rom path (~13 s, skippable).
- `startBubble(onDone)`: island 3 → 4.
- `startWhale()`: island 4 ending.

## Tasks, celebration, hints (`game/`)

- `completeTask(id)`: ticks a task on whichever island owns it; when a list completes: `onAllDone`, spin + confetti, then the win panel.
- `hintOnce(id, msg, ms)`: once per session. `hintTooHigh(near, msg)`: repeating (10 s) "you need Boing-Boing".
- `toast(msg,ms)` for everything else. Keep messages short and kind.

## Sounds (`core/audio.js`)

`sfx.name()`. Everything goes through one master gain, so `setMuted(bool)` (the 🔊 button or `M`, saved as `muted`) silences it all. Everything is synthesised from `tone(fromHz, {to, duration, type, volume, delay})` and `noise(duration, {freq, volume, delay})`; add a new sound as a one-liner. Audio unlocks on the first tap/click (`audioContext()`).

## Save (`core/save.js`)

`{v:4, island, owned, equipped, secrets}` in `localStorage['spartacus-save']`. `writeSave(data)` merges, so each system writes only its own fields: the island on arrival, outfits and secrets as they change. Starting over keeps outfits and found secrets. When the shape changes, bump `VERSION` and add a step to `migrate()` (v3 saves keep their island). `#islandN` in the URL overrides it for testing. Mid-island progress is not saved yet.
