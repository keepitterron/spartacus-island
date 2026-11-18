# Island 1, remade bigger (Blender)

Spartacus's Island, rebuilt about twice as wide (130 m across, was 60 m) with the same story, the same seven tasks and six bones, so saves and the to-do list don't change. Each moment grows into a small place of its own. The layout came from a map Claudio and Zoë marked up together (moved pins and notes, Nov 2026).

**Status:** dressed and being polished. The whole story plays; Zoë's beats (Juf Anne, Chris, the amethyst crabs) are in, the places have names and signposts, the island saves mid-way, and it's dressed with models instead of grey boxes. Next: play-testing with Zoë and the juice pass (see To do).

- Level: `levels/island1.blend`. Its grey-box was made by `tools/levels/make_island1.py` (don't re-run it: it overwrites the file). `tools/levels/dress_island1.py` dresses it (re-runnable, see Dressing below).
- Code: `src/islands/island1/index.js` builds the lighthouse, bridge, chest and lily pads at the level's `spot:` markers.

## The places

| Place                              | What happens                                                                                                                                                                                                                                         | Task  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Hallo Harbour** (south)          | The ship docks; two balls and a bone on the trail inland.                                                                                                                                                                                            |       |
| **Sleepy Gull Beach** (west)       | The gull sleeps on the mast of a beached rowing boat: woof to wake him. Three crabs huddle over an amethyst: a woof (or walking up) and they scuttle off with it, drop it further along the sand and burrow away. It goes on the ship as a treasure. | 🐦    |
| **Boing-Boing Grove** (south-east) | The Boing-Boing fruit on a low rock; three ledges to bounce up, a bone on the top one.                                                                                                                                                               | 🌀    |
| **Growly Cave** (middle)           | Growls from inside: a bear?! No, it's Juf Anne, the squirrel teacher, keeping her napping class safe. A surprise, not a task. She gives Spartacus a bone.                                                                                            |       |
| **Lost & Found Camp** (west)       | The lost and found: a tent, a pile of other people's things, and the plank. Chris the fox points a paw at it.                                                                                                                                        |       |
| **Lily Pond** (middle-east)        | A creek from the spring to the pond and out to sea. The broken bridge to the islet, lily pads (a bone on the last).                                                                                                                                  | 🪵 🗝️ |
| **Ding-Dong Point** (north-west)   | The lighthouse on a hill; Boing-Boing up the rock to the deck and the bell (a bone on the rock).                                                                                                                                                     | 🔔    |
| **Treasure Hill** (north)          | Walls and an arch on the hilltop; the chest, with the map to Hook Rock Bay.                                                                                                                                                                          | 🧰    |
| **Bubbly Spring** (north-east)     | Where the creek starts: a bone in a sand mound.                                                                                                                                                                                                      |       |

## Place names

Named for Zoë, who lives in Amsterdam and goes to a Montessori school ("Surprise me!"). `PLACES` in `src/islands/island1/index.js`: each has a radius (the first time Spartacus walks in, its name comes up as a title card) and most a signpost. Hallo Harbour's signpost has arrows to five of the others. Lost & Found Camp's name is painted on the level's own sign.

| Place             | Was                 | Why                                                                  |
| ----------------- | ------------------- | -------------------------------------------------------------------- |
| Hallo Harbour     | Landing Beach       | Dutch "hallo": where every visit starts                              |
| Sleepy Gull Beach | West beach          | The gull asleep on the boat (and the crabs' secret stays a surprise) |
| Boing-Boing Grove | Boing Grove         |                                                                      |
| Growly Cave       | The cave            | What you hear before you know it's Juf Anne                          |
| Lost & Found Camp | Chris's camp        |                                                                      |
| Lily Pond         | Creek & Pond        |                                                                      |
| Ding-Dong Point   | Lighthouse Headland | The bell                                                             |
| Treasure Hill     | Hilltop Ruins       | The chest                                                            |
| Bubbly Spring     | The spring          |                                                                      |

Juf Anne's lesson is the Montessori nod: the class sits round her with a pink tower and a chalkboard.

Ask Zoë if she wants to rename any. They're `place:` and `sign:` markers in the `.blend` (its **Places** collection, added by `tools/levels/add_places_island1.py`); rename one there and re-export.

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
- **Chris is a fox** (Nov 2026).
- **When the class wakes up they listen to Juf Anne's lesson.**
- **Juf Anne waves goodbye** at the end.
- **The places get names:** "Surprise me!" (above).

## How they work

- **Juf Anne** (`juf-anne.js`), in two visits (Claudio's idea, Nov 2026: in one go it was too much to read). Within 14 m of the cave mouth, a growl every few seconds and a hint ("a bear?!"). **First visit:** walking up to the mouth, or woofing within 10 m, and she hops out, wearing glasses: a conversation (tap for each line) — not a bear, the class is napping, she growls to keep them asleep, "come back later!" — and she goes back in. Coming back too soon: "Shh! Not yet." **In between:** once Spartacus has been more than 25 m away for 30 s in all, the class wakes up ("Little giggles from Growly Cave…"). **Second visit:** at the mouth she thanks him for letting them sleep and gives him the cave's bone (one of the six; he gets it even if he walks off mid-conversation), and the lesson starts: the class sits in a half circle round her chalkboard and the Montessori pink tower. Coming by, she says a lesson line (the pink tower, counting the bones Spartacus has found, paws, waving hello) and the little ones put a paw up; at most one every 14 s. Woof and the class bounces. Saved as `visit`: hidden, resting, awake or teaching.
- **The goodbye:** when the list is done, once Spartacus is 25 m from both the cave and the dock (so nobody sees them teleport), Juf Anne and the class stand along the dock waving. Close by: "Goodbye, Spartacus! Come back and visit!" They wave the ship off too.
- **Chris** (`chris.js`): turns to watch Spartacus; while the plank is still in the pile, points a paw at it and says so. Different lines while Spartacus carries it and after the bridge is fixed. A woof: a hop and a hello.
- **The crabs** (`amethyst.js`, using island 4's crab model): huddled round the amethyst, with a hint nearby. A woof or walking right up and they carry it sideways along the sand to `spot:amethyst`, drop it and burrow away towards the sea. Picking it up: a chime, and it appears on the ship's deck, saved for the rest of the game (starting over clears it). If it's already on the ship (back on island 1 from the island picker), the crabs have already dug in and aren't there. That's checked on the first frame of play, not at build, because "Start from the beginning" empties the ship after the island is built.

- **Cave camera:** under the cave roof the camera stays inside the cave (or out in front of the mouth) and below the roof (`limitCaveCamera`, through the island's `camera.limit` hook).
- **Mid-island saves** (`savesProgress`): ticked tasks, bones, digs and items as on island 5, plus the island's own `saveState()`: whether the class is awake, whether the crabs have run off, the places seen. The bridge, the chest and the gull follow from the ticked tasks. Continue appears on the start screen for an island 1 save too.

## Dressing

`tools/levels/dress_island1.py` (run it, then `export.py`; no Blender needed, see [levels.md](levels.md)):

- **Looks over the grey boxes.** Every grey box stays as an invisible collider, unchanged, so nothing about playing changes; a look goes on top. The cave: lumpy stone walls and roof under seven boulders (each kept clear of the hollow and the mouth), so it reads as a rocky hill. The ruins: lumpy stone with mossy tops. The grove's ledges: lumpy sandstone with a grassy cap exactly at the collider's top (that's what Spartacus stands on). The islet's reed wall: clumps of reeds with cattails, as tall as the old wall. The lost-and-found pile: crates and a barrel stretched to the boxes (the toys sit on them). The rowing boat and tent: real ones (the tent's collider is now round the model).
- **Models round the places** (Quaternius, `tools/levels/library.py`): supplies and a lifeboat at the harbour, a log and rocks on Sleepy Gull Beach, trees and berry bushes at the grove, plants by the cave, a campfire and bench at the camp, willows, water lilies and grass at the pond, the lighthouse keeper's barrels and a bench, fallen stones and a stump on Treasure Hill, a ring of stones round the spring, shade trees inland. `check_markers()` warns if anything solid lands within 2 m of a marker.
- **Alive** (`src/islands/island1/ambience.js`): the campfire flickers, glows (more at night), smokes, sparks and crackles softly within 6 m; the spring bubbles and rings ripples. Palms sway on every island. Each effect reuses a small pool of meshes and only runs within 60 m.

## To do

The plan to finish it (Nov 2026), in passes:

1. **Play well:** ~~cave camera~~, ~~place names and signposts~~, ~~mid-island saves~~, ~~Zoë's answers~~. Play-test with Zoë on the phone (walk times, the wobbly-bridge hint, the reeds, the lily pads). Maybe worn paths between the places.
2. **Dressing:** ~~models over the grey boxes and round each place~~, ~~merged static scenery for phones~~. Still: a winding cliff path up the headland; worn paths between places.
3. **Lively:** ~~swaying palms~~, ~~the campfire~~, ~~spring bubbles~~. Still: grass parting round Spartacus, frogs at the pond, fish in the creek, crabs peeking out later, a small sound for each place. Ask Zoë whether the campfire's crackle is cosy or too much (she found the ocean sound unsettling).
4. **Juice:** bones drifting to Spartacus, a squash on landing, a wag when a task ticks, a short camera look the first time a place comes into view.
5. **Physics props (Rapier test):** ~~a crate pyramid and barrels at Hallo Harbour, odds and ends on the lost-and-found pile~~ (`buildToys`, see Toys in [systems.md](systems.md)). If Zoë loves knocking things over, the puzzles built on it are hers to invent.
