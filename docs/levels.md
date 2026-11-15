# Levels made in Blender

An island can be laid out in [Blender](https://www.blender.org/) (free) instead of in code. You sculpt the ground, place scenery and drop markers (empties) where things go, then export a `.glb` that the game loads. The island's code then only holds what's special about it: its story, tasks and puzzles.

Island 8 (Big Test Island, `preview`, so dev / `?debug` only) is the example. It is about ten times the area of Hook Rock Bay.

| File                               | What                                                           |
| ---------------------------------- | -------------------------------------------------------------- |
| `levels/island8.blend`             | The level source: open this in Blender                         |
| `src/islands/island8/level.glb`    | The export the game loads (commit it: the site has no Blender) |
| `src/islands/island8/index.js`     | The island module: tasks, hints, hooks, exit                   |
| `src/world/level.js`               | The loader: ground → heights, colliders, markers               |
| `tools/levels/export.py`           | Exports a `.blend` with the right settings                     |
| `tools/levels/make_test_island.py` | Made `island8.blend` from scratch (a one-off; it overwrites)   |

## Workflow

1. Open `levels/islandN.blend` in Blender and edit it.
2. Save, then export: `npm run levels` (needs `blender` on your PATH; on a Mac, `BLENDER=/Applications/Blender.app/Contents/MacOS/Blender npm run levels`). Or in Blender: **Scripting** tab → open `tools/levels/export.py` → **Run Script**.
3. `npm run dev` and go to the island (`__g.go(8)`, or its chip on the start screen in dev). Vite reloads the page when the `.glb` changes.

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
| custom property `collider` = `cyl` | Also a collider: an upright cylinder around its bounds (posts, towers, mesas).                                                                                                                                                          |
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
const level = makeLevel(levelUrl, { center: CENTER_8 });

const island = {
  id: 8,
  center: CENTER_8,
  zMax: -2300,
  level, // main.js loads it before anything is built
  height: level.height, // the terrain comes from the ground mesh
  build() {
    addSea(CENTER_8.x, CENTER_8.z, { width: 280, depth: 280 });
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

1. Copy `levels/island8.blend` to `levels/islandN.blend` (or start fresh: a mesh named `ground` is all it needs).
2. Copy `src/islands/island8/` to `src/islands/islandN/`, set `id`, `name`, tasks, and add `CENTER_N` to `world/layout.js` (far enough along −z, see [islands.md](islands.md)).
3. Add it at the end of `ISLANDS` in `main.js`, keep `preview: true` until Zoë has played it.
4. `npm run levels`, `npm run dev`.

## Assets

Models from free CC0 packs (e.g. [Kenney](https://kenney.nl/assets), [Quaternius](https://quaternius.com/)) can be imported into the `.blend` (File → Import → glTF / FBX / OBJ) and placed like any mesh; they're exported into the level, so they stay local and work offline. Keep an eye on the `.glb` size (it's precached for offline play, limit 8 MB): reuse models rather than importing a whole pack, and keep the ground smooth-shaded (a flat-shaded ground exports four times bigger).

## Not done yet

- **Physics stay home-made.** Terrain is a height grid and colliders are upright boxes and cylinders, exactly like the hand-built islands, so every existing system (vines, hooks, balls, rides) works unchanged. A physics library (e.g. Rapier) would add rotated and mesh colliders, overhangs and real rolling/stacking props, but replaces the player's movement: worth doing only when a level needs it.
- Instanced palms and flowers (each is still its own set of meshes; see the phone-performance item in [backlog.md](backlog.md)).
- No ship sailing in: island 8 is reached with the picker or `__g.go(8)`, and island 7's dock still ends the game.
