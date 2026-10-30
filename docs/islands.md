# Islands (levels)

Each island is one module, `src/islands/islandN/index.js`, that default-exports an object with the same shape. The main loop, menus and flow never branch on `island===n`; they ask the current island.

| #   | Island                       | New power                             | Friend rescued          | Core loop                                                                                                                                                           |
| --- | ---------------------------- | ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Spartacus's Island (starter) | Boing-Boing (super jump)              | —                       | 6 bones, fruit, bark at seagull, lighthouse bell, plank fixes bridge, dig up key, open chest → map                                                                  |
| 2   | Hook Rock Bay                | Stretchy (swing from golden hooks)    | Mango the parrot        | Dig snack on a Boing-only mesa, swing rock to rock to the tall pillar, feed Mango, he rides your hat to the ship                                                    |
| 3   | Mossy Paw Woods              | Grow-Grow (climbing vines + ziplines) | Wasabi the axolotl      | Climb, zip treetop to treetop, Mango fetches a flower, trade it to the bees for a key, open the water gate, Wasabi swims to the ship                                |
| 4   | Bubbly Ocean (underwater)    | Chop-Chop (hat frisbee cuts seaweed)  | Eduardo the hermit crab | 5 red crabs parade behind you, chase Eduardo through the tentacle lane, fetch the octopus's pillow through the vent canyon, bring Eduardo to the ship, whale ending |

Layouts for islands 3 and 4 are **placeholders** until Zoë draws them.

## The island interface

```js
const island = {
  id:3, center:CENTER_3, name:'Mossy Paw Woods',
  zMax:-245,                 // terrain band: this island's height() is used for z < zMax
  height(x,z){…},            // terrain height function
  underwater:false,          // switches fog/background, hides the gull
  physics:{…},               // optional overrides: gravity, maxFall, speed, jump, water, bound
  camera:{minY(pos), maxY, assist(dt)},   // optional camera hooks

  tasks:{title, list:[{id, ic, t:()=>text, power?}]},   // ic = emoji icon, t = label text
  //   ids must be unique across the whole game; power:'grow' ticks itself when that fruit is eaten
  collect:{total, count:0, taskId, name, all, model},   // optional bones/acorns-style pickups
  secrets:[{id, x, z, reward, y?, dig?}],                // hidden presents (island-local), see systems.md
  balls:[[x, z], …],                                     // beach balls (island-local)
  critters:{birds, butterflies, fish},                   // ambient life spots (island-local)
  music:{tempo, root, wave, melody, bass},               // the island's tune (core/music.js)
  intro:[[delayMs, text, durationMs], …],                // toasts after arriving
  win:{title, text, tip, go},                            // win panel; "go" button runs exit.run
  exit:{label, at(p), run()},                            // dock action once every task is done
  sailPath,                                              // optional: the next island's ship spot is the end of this path
  onAllDone(){…},                                        // optional extra when the list completes

  build(),          // meshes, colliders, items, pickups (may use rand(): see architecture.md)
  buildLate(),      // optional: fruit bushes, dig spots (no rand())
  enter(arrived),   // optional: on arrival (place ship, bring crew, …)
  update(dt),       // per-frame animation while this is the current island
  interact(p,dt),   // per-frame walk-into triggers and hints
  actions(p),       // context-button actions: return {label, run} or null
  bark(p),          // what barking does here
};
export default island;
```

`actions(p)` is checked after the exit and before the generic actions (swing, drop, grab, dig); see `game/actions.js`. A typical body:

```js
actions(p) {
  const nearHive = distXZ(p, HIVE.x, HIVE.z) < 2.8 && Math.abs(p.y - HIVE.y) < 1.5;
  if (player.carrying?.id === 'flower' && !island.done.trade && nearHive)
    return { label: 'Give', run: giveFlower };
  return vineAction(p); // reuse a system's action
},
```

Every action check should test both **distance and height** (`Math.abs(p.y-target.y)<…`), or the button shows up from the ground under a tree top.

## Adding island 5: step by step

1. **Story first.** Get Zoë's story: where the whale leaves the ship, what's tied up, who needs rescuing, what the new power is. Eduardo pinches through ropes here.
2. **Place it in the world.** Add `CENTER_5` to `world/layout.js` (e.g. `{x:0,z:-900}` for underwater, or between existing land islands with ~150 units of sea). Pick a `zMax` so its terrain band doesn't overlap a neighbour.
3. **Copy a template.** Copy `islands/island2/index.js` (land, compact) or `island4/` (underwater, split into files) to `islands/island5/`. Point its `toWorld(x, z)` helper at `CENTER_5` and set `id:5`, `center:CENTER_5`, `name`.
4. **Terrain.** Write `height(x,z)`: base height, features (ponds, hills), then the shore falloff (`lerp(h, -4, smoothstep(e, e + 2.5, r))`). In `build()` call `buildGround(CENTER_5.x, CENTER_5.z, {size, segments: LOW_POWER ? 90 : 140, palette})` first.
5. **Spawn + dock.** Set `island.spawn` in `build()` and add a `dock()`. Keep the area behind the spawn clear (the camera sits there).
6. **Content.** Use the systems: `addPickup`, `addItem`, `addDig`, `addFruit`, `addHook`, `climbVine`/`zipVine`, `addChoppable`. Positions in `toWorld(x, z)` so Zoë's map is a number edit.
7. **Tasks.** Write the list (unique ids!), a `win` panel and an `exit`. If the new power is eaten here, mark that task with `power:'…'`.
8. **Hints.** For every new object or mechanic add a `hintOnce` in `interact()`. Use `hintTooHigh(near, msg)` for "you need Boing-Boing here".
9. **Arriving.** Set the previous island's exit to take you here (`enterIsland(5,true)` at the end of a cutscene). Today island 4 ends with the whale and the `#end` panel: change `island4/whale.js` to call `enterIsland(5,true)` instead of showing "To be continued…", and move the end panel to island 5's exit. In `enter()`, bring the crew (`ensureMangoCrew()`, Wasabi, Eduardo) and place the ship.
10. **Register it** in `src/main.js`: add to `ISLANDS` **at the end** (build order). `continueIsland()` and `#island5` work automatically.
11. **Test** with `npm run dev`, `__g.go(5)`, and the checklist in [testing.md](testing.md). Check it on a phone.

## Checklist for any level change

- [ ] Can't get stuck: every item dropped anywhere can be picked up again or floats home; every high place has a way down.
- [ ] Nothing can be finished in an order that breaks a later step (e.g. item consumed before it's needed).
- [ ] "Keep exploring" on the win panel still leaves a way to leave (the `exit`).
- [ ] Every new thing has a one-time hint.
- [ ] Nothing tall right behind the spawn or in narrow corridors (camera).
- [ ] Phone: buttons readable, toasts short, frame rate OK with `LOW_POWER`.
