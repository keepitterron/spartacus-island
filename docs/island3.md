# Island 3: Mossy Paw Woods (remade bigger, Blender)

Remade in Nov 2026 (the second round of the [levels plan](levels-plan.md)): about 88 m across (was 52 m), laid out in Blender, the same story and six tasks. Seven named places, six golden acorns (was four). A mid-island save from the old layout starts the island fresh (`layout: 2`).

- Level: `levels/island3.blend`, made by `tools/levels/make_island3.py` (don't re-run once edited by hand) and dressed by `tools/levels/dress_island3.py` (re-runnable, data). Its ground is painted a deeper green (`groundPalette` in `makeLevel`).
- Code: `src/islands/island3/index.js` builds the four big trees, the vines and zip lines, the hive, the water gate and reservoir, the stream and spring, the flower tree and the giant mushroom at the level's `spot:` markers, plus the woods' own little pines, round trees and toadstools (`buildForest`).

## The story

Wasabi the axolotl's spring has dried up: the water gate upstream is locked. Eat a Grow-Grow fruit, grow the vine at the seed tree's roots and climb it; grow and ride the zip lines treetop to treetop to the hive tree. Woof under the flower over the stream and Mango fetches it; trade it to the bees for their key; open the gate; the stream runs, the spring fills and Wasabi swims down to the ship.

## The places

| Place               | What happens                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Mossy Landing**   | The dock, a lifeboat and supplies, a bench; the path up into the woods. Signpost.                       |
| **Treetop Walk**    | The four big trees, exactly as before (the zip lines and the hook to the acorn tree are tuned to them). |
| **Wasabi's Spring** | The spring under a willow, the stream past it down to the beach.                                        |
| **The Water Gate**  | The locked gate and its reservoir, among mossy rocks.                                                   |
| **Toadstool Glade** | The giant mushroom (an acorn on top, Boing-Boing) with berry bushes.                                    |
| **Pinecone Hill**   | A hill with a bench; an acorn on top.                                                                   |
| **Mossy Hollow**    | Logs, stumps and a big mossy rock (an acorn on top, Boing-Boing), and a buried acorn.                   |

Names are ours; ask Zoë if she wants to rename any.
