# Island 2: Hook Rock Bay (remade bigger, Blender)

Remade in Nov 2026 as the first round of the [levels plan](levels-plan.md): about 100 m across (was 44 m), laid out in Blender, with the same story and the same five tasks, so saves and the to-do list don't change (a save made mid-island on the old layout starts the island fresh; see `layout` below). Six named places, six bones (was four).

- Level: `levels/island2.blend`. Its grey-box was made by `tools/levels/make_island2.py` (don't re-run it once the `.blend` is edited by hand: it overwrites the file). `tools/levels/dress_island2.py` dresses it (re-runnable; the model list is data, using `Dresser` from `tools/levels/library.py`).
- Code: `src/islands/island2/index.js` builds the swing pads, the hooks, Mango's nest, the X on the mesa, the camp's fire, the rock pools' bubbles and the toys at the level's `spot:` markers.
- Islands 3–7 keep their scenery: `sharedSeedAfter` is where the shared random sequence stood after the old hand-built island (checked identical for every island after it).

## The story

Mango the parrot is stuck on the tallest pillar in the lagoon: too hungry to fly. Eat a Stretchy fruit and swing pillar to pillar on the golden hooks; his snack (a cracker tin) is buried under a red X on top of Cookie Mesa, which only a Boing-Boing jump reaches. Dig it up, swing to Mango, Give; he rides Spartacus's hat, and flies to the crow's nest when Spartacus walks onto the dock.

## The places

| Place                        | What happens                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ahoy Beach** (south)       | The dock and the ship; a beached rowing boat, a campfire with a bench, and a stack of barrels and crates to bowl over. Signpost to the rest.  |
| **Stretchy Grove** (SW)      | The Stretchy bush in a ring of shade trees, and a practice swing on dry land: a pad and a low rock with a hook between (a bone on the rock).  |
| **Cookie Mesa** (west)       | The mesa with the red X and a red flag you can see from the beach; a bone on top; the Boing-Boing bush at its foot.                           |
| **Hook Rock Lagoon** (north) | The swing route, exactly as on the old island: west pad → first → second → Mango's pillar → east pad, a branch to the side pillar. Two bones. |
| **Lookout Hill** (NE)        | A hill with a bench and a cairn; a bone on top.                                                                                               |
| **Crabby Cove** (east)       | A sandy cove with two bubbling rock pools, driftwood, and a buried bone.                                                                      |

The names are ours (Zoë likes surprises); ask her if she wants to rename any (`place:` and `sign:` markers in the `.blend`).

## Notes

- **Findable:** the hints say where (Cookie Mesa, under the red flag); Mango says it too when you woof at him; the last two bones sparkle.
- **Saves:** `layout: 2` on the island; `game/progress.js` ignores a mid-island save from a different layout (the bones and spots have moved), so an old save starts island 2 fresh.
- **Arriving:** island 1's voyage ends at `spot:ship` (5.6, 58 island-local); island 2's voyage to Mossy Paw Woods starts there.
- **Toys:** barrels and crates beside the camp (`buildToys`).
