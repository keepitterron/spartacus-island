# Island 1, remade bigger (Blender)

Spartacus's Island, rebuilt about twice as wide (130 m across, was 60 m) with the same story, the same seven tasks and six bones, so saves and the to-do list don't change. Each moment grows into a small place of its own. The layout came from a map Claudio and Zoë marked up together (moved pins and notes, Nov 2026).

**Status:** grey-box with Zoë's characters. The whole story plays on the new map with plain shapes, and her three new beats (Juf Anne, Chris, the amethyst crabs) are in. Next: reacting props, wind and dressing.

- Level: `levels/island1.blend`, made by `tools/levels/make_island1.py` (all positions are in that script). Don't re-run it once the `.blend` has been edited by hand.
- Code: `src/islands/island1/index.js` builds the lighthouse, bridge, chest and lily pads at the level's `spot:` markers.
- Islands 2–7 keep their scenery: island 1 says where the shared random sequence stood after the old hand-built island (`sharedSeedAfter`, see main.js). Checked: the sequence after every island is identical to before.

## The places

| Place                                | What happens                                                                                                                                                                                                                                         | Task  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Landing Beach** (south)            | The ship docks; two balls and a bone on the trail inland.                                                                                                                                                                                            |       |
| **West beach**                       | The gull sleeps on the mast of a beached rowing boat: woof to wake him. Three crabs huddle over an amethyst: a woof (or walking up) and they scuttle off with it, drop it further along the sand and burrow away. It goes on the ship as a treasure. | 🐦    |
| **Boing Grove** (south-east)         | The Boing-Boing fruit on a low rock; three ledges to bounce up, a bone on the top one.                                                                                                                                                               | 🌀    |
| **The cave** (middle)                | Growls from inside: a bear?! No, it's Juf Anne, the squirrel teacher, keeping her napping class safe. A surprise, not a task. She gives Spartacus a bone.                                                                                            |       |
| **Chris's camp** (west)              | The lost and found: a tent, a pile of other people's things, and the plank. Chris the fox points a paw at it.                                                                                                                                        |       |
| **Creek & Pond** (middle-east)       | A creek from the spring to the pond and out to sea. The broken bridge to the islet, lily pads (a bone on the last).                                                                                                                                  | 🪵 🗝️ |
| **Lighthouse Headland** (north-west) | The lighthouse on a hill; Boing-Boing up the rock to the deck and the bell (a bone on the rock).                                                                                                                                                     | 🔔    |
| **Hilltop Ruins** (north)            | Walls and an arch on the hilltop; the chest, with the map to Hook Rock Bay.                                                                                                                                                                          | 🧰    |
| **The spring** (north-east)          | Where the creek starts: a bone in a sand mound.                                                                                                                                                                                                      |       |

## Zoë's notes (from the map)

- **The cave:** "There is a cave here. Growls come from inside. You think it's a bear and instead it's mummy squirrel (or another small animal from the assets pack) trying to protect her classroom."
- **The crabs:** "The crabs were hiding an amethyst stone and they will now take it a bit farther ahead before abandoning it for Spartacus to pick up. It's a bonus!"
- **The camp:** "The camp is where Chris rabbit/fox keeps all the lost and found. The plank is in the pile."
- **The key:** "There should be no other way to get here than fixing the bridge."

How the key note is kept: the islet is raised higher than Spartacus can jump from the water, a ring of tall reeds goes all round it except where the bridge lands, the lily pads stay well away from it, and the broken bridge is too wobbly for Boing-Boing (a hint says so), so a super jump can't clear the gap. The gap is 8 m, wider than a running ordinary jump.

## Zoë's answers

- **The cave** is **Juf Anne**, a teacher, not a mummy. It's a **surprise**, not on the to-do list. (Written "juff Anne"; "juf" is the Dutch word for a schoolteacher. The name is one constant, `TEACHER` in `src/islands/island1/juf-anne.js`.)
- **Chris** is just there and points Spartacus to the plank. Made a fox for now (Zoë said rabbit or fox): `src/islands/island1/chris.js`.
- **The amethyst** is a treasure to keep on the ship: `src/systems/treasures.js`.

## How they work

- **Juf Anne** (`juf-anne.js`): within 14 m of the cave mouth, a growl every few seconds and a hint ("a bear?!"). Walking up to the mouth, or woofing within 10 m, and she hops out, wearing glasses. Three lines, then her four little ones wake and come to peek, and she gives Spartacus the cave's bone. Woof again and the class bounces. Her bone counts towards the six.
- **Chris** (`chris.js`): turns to watch Spartacus; while the plank is still in the pile, points a paw at it and says so. Different lines while Spartacus carries it and after the bridge is fixed. A woof: a hop and a hello.
- **The crabs** (`amethyst.js`, using island 4's crab model): huddled round the amethyst, with a hint nearby. A woof or walking right up and they carry it sideways along the sand to `spot:amethyst`, drop it and burrow away towards the sea. Picking it up: a chime, and it appears on the ship's deck, saved for the rest of the game (starting over clears it). If it's already on the ship, the crabs have nothing to carry.

## To do

- The camera inside the cave (it ends up behind the rock: pull in, or fade the roof).
- Reacting props and wind; dressing from the model Library (as on island 8); a winding cliff path up the headland.
- Play-test with Zoë on the phone (walk times, the wobbly-bridge hint, the reeds).
