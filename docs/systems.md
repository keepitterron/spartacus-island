# Systems (building blocks)

Reusable pieces in `src/systems/`, `src/npcs/`, `src/cutscenes/` and `src/game/`. Islands combine these; if you write the same thing twice in two islands, it probably belongs here.

## Colliders (`core/colliders.js`)

A flat list of cylinders and boxes: `addCyl(x,z,r,bottom,top)`, `addBox(x,z,hw,hd,bottom,top)`. Anything taller than a step (0.5) pushes the player out sideways; anything lower can be stood on. Set `c.top=-999` to switch one off (cut seaweed, opened gate). `supportAt(x,z,maxY)` gives the floor height under a point.

## Items (`systems/items.js`)

Carried in the mouth, one at a time.

```js
addItem('pillow', makePillow(), pos, heavy, {name:'pillow', lift:.2, reach:1.6, onCarry(it){…}})
```

- `heavy` items slow Spartacus and stop super jumps and climbing.
- Dropped in water (on islands with `physics.water`) they float home in a bubble with sparkles.
- `carry(it)` puts one in the mouth (e.g. straight from a dig), `useUp()` consumes the carried one (given away), `placeItem(to,onDone)` tweens it into place and locks movement while it moves (the bridge plank).
- `grabAction`/`Drop` are offered automatically by the context button.

## Pickups (`systems/collect.js`)

Spinning collectibles counted per island (bones, golden acorns). Configure `collect` on the island, then `addPickup(x,z,y,islandId,pop)`. The task text: `pickupText(id,'bones')`.

## Dig spots (`systems/digs.js`)

`addDig(x,z,reward,marked,y)`: reward is a function `d=>{…}` that runs when digging finishes (spawn a pickup with `pop`, or `carry(addItem(…))`). `marked` adds a red X. `digNear(p,r)` for hints.

## Powers and fruits (`systems/powers.js`)

`POWERS` defines each power: name, emoji, sparkle colours, sign colour, intro message. `addFruit(type,x,z,y,bush)` places one (bush = regrowing bush with a name sign). Eating sets `P.power` and flags (`P.super`, `P.stretch`) and completes any task with `power:type` on the current island.

**Adding a power:** add an entry to `POWERS` and a texture to `tex`, then implement what it does, usually as an action (`chopAction`-style function returned from the island's `actions(p)`) or a physics flag read in `stepPlayer`.

## Vines (`systems/vines.js`), Grow-Grow

- A _tree_ is `{x,z,gh,top,grown}` with a collider whose `.tree` points back to it (`bigTree` on island 3, kelp `pillar` on island 4).
- `climbVine(tree, towardX, towardZ)`: a seed at the foot; once grown, walking into the trunk climbs it.
- `zipVine(a,b)`: a seed on top of `a` grows a zipline to `b`.
- `vineAction(p)` gives Grow / Zip.

## Hooks (`systems/hooks.js`), Stretchy

`addHook(a,b)` between two landing spots `{x,y,z}`. With Stretchy, standing on either end offers Swing; when several hooks start from one spot, the one Spartacus faces wins (`swingOption`).

## Hat (`systems/hat.js`), Chop-Chop

`addChoppable({x,y,z,onChop(c)})` registers something the hat can cut. `chopAction(p)` throws the hat at the nearest one; everything within 1.9 of the target is cut too.

## NPCs

Crew members who travel live in `src/npcs/`; island-only characters live in their island folder (`island4/octopus.js`, `crabs.js`, `eduardo.js`).

- **Gull**: sleeps on island 1, wakes on bark, then circles the ship.
- **Mango**: `placeMango`, `mangoHop` (onto the hat), `mangoToShip(onArrive)`, `ensureMangoCrew()`, and `mangoFetch(to, mesh, onDrop)` for errands on later islands.
- **Wasabi**: island 3 drives her story (stuck → happy → swim); `wasabiFollow()` makes her swim beside Spartacus.

Pattern: each NPC has a `state` string and an `upd…(dt)` function with one branch per state. Riders are attached to `dog.head`; crew on the ship are attached to `ship`.

## Cutscenes

Register `G.cutscenes.name={update(dt), skip?()}` and set `G.state='name'`. While one runs, the player is not simulated (put Spartacus on deck with `P.pos.copy(onDeck())`), the power badge hides, and Enter/Space/Escape call `skip()`.

- `startSail(path, onArrive)`: ship follows a Catmull-Rom path (~13 s, skippable).
- `startBubble(onDone)`: island 3 → 4.
- `startWhale()`: island 4 ending.

## Tasks, celebration, hints (`game/`)

- `complete(id)`: ticks a task on whichever island owns it; when a list completes: `onAllDone`, spin + confetti, then the win panel.
- `hintOnce(id,msg,ms)`: once per session. `tooHigh(near,msg)`: repeating (10 s) "you need Boing-Boing".
- `toast(msg,ms)` for everything else. Keep messages short and kind.

## Sounds (`core/audio.js`)

`sfx.name()`. Everything is synthesised from `tone()` and `noise()`; add a new sound as a one-liner. Audio unlocks on the first tap/click (`ac()`).

## Save (`core/save.js`)

`{v:3, island:n}` in `localStorage['spartacus-save']`, written on arriving at an island. Bump `VERSION` when an old save could strand someone. `#islandN` in the URL overrides it for testing. Mid-island progress is not saved yet.
