# Levels made in Blender

An island can be laid out in [Blender](https://www.blender.org/) (free) instead of in code. You sculpt the ground, place scenery and drop markers (empties) where things go, then export a `.glb` that the game loads. The island's code then only holds what's special about it: its story, tasks and puzzles.

Island 1 is the example ([island1.md](island1.md)): a story island moved from code to Blender, with `tools/levels/make_island1.py` building its grey-box, `tools/levels/dress_island1.py` dressing it and `tools/levels/helpers.py` holding the shared Blender helpers for new level scripts. (Island 8, a big test island for the pipeline, was removed in Nov 2026; it's in git history before then.)

**Moving an existing island to Blender:** its old code used the shared random sequence, so the islands after it would get different trees and flowers. Measure `rand.seed()` after the old island's `build()` and set it as the island's `sharedSeedAfter`; `main.js` carries on from there, and nothing else moves.

| File                            | What                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `levels/island1.blend`          | The level source: open this in Blender                                  |
| `src/islands/island1/level.glb` | The export the game loads (commit it: the site has no Blender)          |
| `src/islands/island1/index.js`  | The island module: tasks, hints, hooks, exit                            |
| `src/world/level.js`            | The loader: ground → heights, colliders, markers                        |
| `tools/levels/export.py`        | Exports a `.blend` with the right settings                              |
| `tools/levels/make_island1.py`  | Made `island1.blend`'s grey-box from scratch (a one-off; it overwrites) |
| `tools/levels/dress_island1.py` | Island 1's looks over its grey boxes, and its models (re-runnable)      |
| `tools/levels/library.py`       | The model Library both dressing scripts share                           |
| `tools/levels/run_with_bpy.py`  | Runs any of these without Blender installed (below)                     |
| `levels/assets/quaternius/`     | The CC0 models (originals) and their credits                            |

## Workflow

1. Open `levels/islandN.blend` in Blender and edit it.
2. Save, then export: `npm run levels` (needs `blender` on your PATH; on a Mac, `BLENDER=/Applications/Blender.app/Contents/MacOS/Blender npm run levels`). Or in Blender: **Scripting** tab → open `tools/levels/export.py` → **Run Script**.
3. `npm run dev` and go to the island (`__g.go(1)`, or its chip on the start screen). Vite reloads the page when the `.glb` changes.

**No Blender to hand** (a cloud session, CI): Blender's Python module runs the same scripts headless. `python3.13 -m venv .bpy && .bpy/bin/pip install bpy` once (bpy 5.3 matches the `.blend` files, saved by Blender 5.3), then `.bpy/bin/python tools/levels/run_with_bpy.py levels/island1.blend tools/levels/export.py`. That's how island 1 was dressed.

Don't export from **File → Export → glTF** by hand unless you tick **Include → Custom Properties** and **Data → Mesh → Apply Modifiers**: the script does that for you.

## Coordinates

One Blender metre is one game unit. The level's origin is the island's centre (`CENTER_N` in `world/layout.js`), so Blender positions are the island-local coordinates the rest of the docs use, with one twist: Blender is Z-up, so **Blender (x, y, z) is game (x, z, −y)**. The game's +z (towards the dock, where islands put their spawn) is Blender's **−Y**, which is "front" in Blender's front view (numpad 1).

`__g.where()` gives island-local game coordinates: a spot at game `{x: 10, y: 2, z: -30}` is Blender `(10, 30, 2)`.

## What becomes what

Objects are recognised by **name**. Blender adds `.001`, `.002` to copies; they're ignored, so `palm.014` is just another `palm`. A name with a colon is `kind:arg`, like `fruit:boing`.

### Meshes

| Object                             | In the game                                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a mesh named `ground`              | The island's terrain. Its top surface is baked into a height grid (half a metre apart) that becomes the island's `height(x, z)`. It's drawn the game's way (painted grass and sand by height), unless custom property `look` = `model`. |
| any other mesh                     | Scenery, as modelled. A plain colour becomes the game's flat-shaded material; textured models (asset packs) keep their own.                                                                                                             |
| custom property `collider` = `box` | Also a collider: an upright box around the object's bounds. Colliders don't rotate, so rotate boxes in 90° steps.                                                                                                                       |
| custom property `collider` = `cyl` | Also a collider: an upright cylinder around its bounds (posts, towers, mesas). With `radius` too: a cylinder that wide round the object's origin (a tree's trunk).                                                                      |
| custom property `invisible` = 1    | Not drawn (an invisible wall, with `collider`).                                                                                                                                                                                         |

Custom properties are in the **Object Properties** tab (orange square) → **Custom Properties** → **New**.

**The ground's edges must go under the sea.** Ground below −0.55 is wading depth, below −3.5 open sea (the current carries Spartacus back to the island). Outside the ground mesh is sea floor at −4.2. Leave a beach around 0.3–0.7 high.

The terrain is a height grid, so it can't have overhangs, caves or arches: make those from scenery meshes with colliders. A steep slope is still walkable (there's no slope limit); a real cliff needs a collider.

### Markers (empties: Add → Empty)

| Name                              | Becomes                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `spawn`                           | Where Spartacus arrives                                                                                                    |
| `dock`                            | A wooden dock from here towards game +z (Blender −Y). Custom property `length` (default 11).                               |
| `palm`                            | A palm tree (`world/props.js`), shakes when you woof                                                                       |
| `rock`                            | A mossy rock: the empty's X scale is its radius, its Z scale its height. Optional custom property `color`, e.g. `#9aa6b8`. |
| `pickup`                          | One of the island's collectibles (bones…). The island needs `collect`; its `total` is counted for you.                     |
| `dig` / `dig:marked`              | A sand mound with a collectible inside (`marked`: with a red X)                                                            |
| `fruit:boing`, `fruit:stretch`, … | A regrowing fruit bush (any power in `POWERS`)                                                                             |
| `ball`                            | A beach ball                                                                                                               |
| `birds`, `butterflies`, `fish`    | Ambient critters (fish swim at the empty's height)                                                                         |
| `spot:name`                       | Nothing by itself: a named position for the island's code, `level.spots['name']`                                           |
| anything else                     | Whatever the island's code says (below), or a console warning                                                              |

A marker is snapped down onto whatever is right under it (terrain, or the top of a rock, crate or wall), as long as it's no more than half a metre below the marker. So to put a bone on a tower, place the empty just above the tower's top.

## The island module

```js
import levelUrl from './level.glb?url';
const level = makeLevel(levelUrl, { center: CENTER_N });

const island = {
  id: N,
  center: CENTER_N,
  zMax: …,
  level, // main.js loads it before anything is built
  height: level.height, // the terrain comes from the ground mesh
  build() {
    addSea(CENTER_N.x, CENTER_N.z, { width: 280, depth: 280 });
    level.build(island, {
      // optional: marker kinds of its own (or replacing a built-in one)
      markers: {
        lantern(marker) { addLantern(marker.x, marker.z, { y: marker.ground }); },
        gate: { phase: 'late', run: (marker, island) => { … } },
      },
    });
    const top = level.spots['summit']; // {x, y, z, ground, scale, yaw, props}
  },
  buildLate: () => level.buildLate(island),
  …
};
```

- `level.spots['name']`: a `spot:name` marker. `level.all('kind')`: every marker of a kind.
- A marker is `{kind, arg, x, y, z, ground, scale, yaw, props}` in world coordinates; `ground` is the surface under it, `props` its custom properties.
- **Phases:** `shape` markers (rock, palm, dock: things to stand on) run first, then `normal` ones, then `late` ones in `buildLate` (fruit, digs: no `rand()`). Within a phase, file order.
- **Random scenery:** an island with a `level` is built with its own random seed (`main.js`), so moving palms in one level never moves another island's trees.
- Everything else (tasks, hints, `interact`, `actions`, exit, ship placement) works as on any island: see [islands.md](islands.md).

## Adding a new level island

1. Start `levels/islandN.blend` from a script like `tools/levels/make_island1.py` (or by hand: a mesh named `ground` is all it needs).
2. Make `src/islands/islandN/` with an `index.js` like island 1's, set `id`, `name`, tasks, and add `CENTER_N` to `world/layout.js` (far enough along −z, see [islands.md](islands.md)).
3. Add it at the end of `ISLANDS` in `main.js`, with `preview: true` if it should stay hidden from the start screen (dev / `?debug` only) while you build it.
4. `npm run levels`, `npm run dev`.

## Assets (models from packs)

Island 1 is dressed with free [Quaternius](https://quaternius.com/) models (CC0: public domain): trees, willows, berry bushes, flowers, water lilies, mossy rocks and logs, a tent, a campfire, benches, barrels, crates, a well and two boats. The originals are in `levels/assets/quaternius/` (with a README crediting the packs); GitHub mirrors are the easy source, since the packs' own sites are often blocked for scripts.

**The Library.** A dressed level's `.blend` has a **Library** collection with one copy of each model, already scaled for a dog about 1.1 m tall and recoloured to the game's palette (Quaternius greens and browns are muted; the game's are bright). It's excluded from the scene and never exported. Each model is also marked as an asset, so in Blender: open an **Asset Browser**, pick **Current File**, and drag a tree onto the island. Or copy one with **Alt+D** (a linked duplicate: the `.glb` stores the mesh once however many you place).

**Placing them:** a dragged-in model is plain scenery. Give it a custom property `collider` (`box` for crates, benches, boats; `cyl` for barrels, rocks, stumps) if Spartacus should bump into it or stand on it. For trees use `collider` = `cyl` plus `radius` = `0.45`: the collider is then just the trunk, not the whole canopy. Leave flowers, bushes, grass and lilies without colliders.

**Adding a model:** put its `.glb` in `levels/assets/quaternius/`, add it to `MODELS` (with its scale) in `tools/levels/library.py`, and add any new colours to `PALETTE` there (the script prints colours it doesn't know). Then re-run it.

**`tools/levels/dress_island1.py`** rebuilds the Library, **Looks** and **Dressing** collections (see Dressing in [island1.md](island1.md)). It only replaces those two collections, but hand edits _inside_ Dressing are lost when it runs, so once you start arranging things by hand in Blender, stop running it (or move your models to another collection).

```bash
blender -b levels/island1.blend --python tools/levels/dress_island1.py && npm run levels
```

**Keep it light:** a few groups of things with space between them, not a carpet. Every model is a few draw calls on a phone, and the `.glb` is precached for offline play (limit 8 MB; island 1 is 2.9 MB, half of it the ground). Models are exported smooth-shaded (shared corners, a smaller file); the game draws them flat-shaded anyway. Keep the ground smooth-shaded too (flat exports four times bigger). Skip anything that breaks Zoë's rules (weapons, traps, skulls, enemies).

## Not done yet

- **Scenery is merged for phones.** Every scenery mesh is static: `world/statics.js` merges it with the rest of the island's static scenery (one mesh per material per 40 m patch), so 70 models cost a handful of draw calls. Don't animate or look up a level mesh after `build()`; make a marker and build the moving thing in code instead (like island 1's campfire flames on `spot:campfire`).
- **Grey box, then looks.** Island 1 keeps its grey boxes as invisible colliders (`invisible` = 1) and puts a look on top: a model stretched to the box, or a lumpy stone copy (Subdivision + Displace with mid-level 1, so it only dents inwards and never sticks out of its collider). Gameplay can't change when the looks do.
- **Physics stay home-made for Spartacus.** Terrain is a height grid and colliders are upright boxes and cylinders, exactly like the hand-built islands, so every existing system (vines, hooks, balls, rides) works unchanged. Rapier is in the game for loose props only (`systems/toys.js`): toys tumble on a heightfield copy of the ground. Moving Spartacus onto it (rotated and mesh colliders, overhangs) would replace `stepPlayer` on every island: worth doing only when a level needs it.
- Instanced palms and flowers (each is still its own set of meshes; see the phone-performance item in [backlog.md](backlog.md)).
