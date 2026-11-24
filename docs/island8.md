# Island 8: Sunpaw Temple (the school trip)

Built and playable from the voyage out of the funfair to "To be continued…". **A surprise for Zoë:** Claudio asked for a level bigger and more immersive than the others, with dungeon-style puzzles, where Juf Anne gives the missions and Cleo the corgi joins in. The rest was designed around that. Names she might want to change are in **For Zoë** at the end.

## The story in one breath

The ship sails on from Jamboree Island to a jungle island with an old temple on a stone plinth. On the beach is a school camp: **Juf Anne** (the squirrel teacher from island 1's Growly Cave) has brought her class on a school trip, with **Cleo**, the class's school dog, a corgi. The Sun Temple was built by dogs long ago and only opens for dogs, two at a time, so Cleo joins Spartacus. Juf Anne gives them missions one by one: open the door, find the three Sun Gems, wake the Sun Dog, and take a class photo with him. At the end the class waves goodbye from the dock, Cleo with them. _To be continued…_

It fits the rules: nobody is a villain (the Sun Dog is just very sleepy), nothing hurts, a fall into the pit costs a walk up the ramp, and every puzzle can be reset or undone.

## What's new here

The temple is a dungeon: six rooms in a cross round the Great Hall, each with its own puzzle, a chest with a gem, and a locked door whose key is in another room. Inside, the camera rises and looks down (like a top-down adventure), so walls never hide Spartacus.

| Place            | Puzzle                                                                                                                                                                                                                                                                                       | Cleo                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Temple Steps** | Vines cover the Great Door: eat the Chop-Chop fruit by the steps and chop them. Two paw plates: it takes two dogs.                                                                                                                                                                           | Stays on one plate while Spartacus takes the other                                       |
| **Garden Court** | Reached only through a tunnel too small for Spartacus. A stone block to push onto a square plate (a stuck block slides home when he leaves the garden); with Cleo on the paw plate, steps rise to the sun dais and its chest.                                                                | Opens the gate from inside; sniffs out the buried key; sits on the paw plate             |
| **Echo Hall**    | Locked (the key is dug up in the garden). Woofs echo. A woof near a crystal swaps red and blue: the gates between the three parts rise and sink, and a red step leads up to the ledge with the chest. Every part has a crystal, so nobody is ever shut in.                                   | —                                                                                        |
| **Mirror Hall**  | A sunbeam comes in through a crack. Turn three mirrors to send it to the gold sun face; a stone shutter blocks it unless its paw plate is held. The last mirror is on an island in a pit: swing there on the golden hooks (Stretchy fruit in the Great Hall). The chest rises on the island. | Holds the shutter's plate down (or Spartacus can stand on it once the mirrors are right) |
| **Great Hall**   | The Sun Door with three holes: put the gems in. Clay pots to bowl over (toys). Juf Anne's classroom.                                                                                                                                                                                         | —                                                                                        |
| **Sun Chamber**  | The Sun Dog, a giant stone dog asleep for a thousand years. Two mirrors send the light from the hole in the roof onto his nose (he sneezes, still sleepy); then two dogs on the paw plates and a WOOF wake him. He glows, the braziers light, and he gives a Sun Medal for the ship.         | The second dog on the plates                                                             |
| **Class photo**  | Stand on the paw mark: the camera turns round, counts down, flashes, and the real picture comes up as a polaroid (and can be saved as a file). It's kept on the ship's deck with the medal.                                                                                                  | In the photo                                                                             |

Twelve **crayons** the class dropped are spread over the island and the temple: the beach, the big rock (Boing-Boing), the rock in the pond, behind a column, the dais, the Echo Hall's ledge, the island in the pit, behind the Sun Dog, and the jungle behind the temple.

## Tasks (Juf Anne's missions)

Each mission appears on the to-do list when she gives it (a line says more are to come):

1. 🐿️ Say hello to Juf Anne at the camp
2. 🚪 Open the temple door with Cleo; 🖍️ find 12 crayons
3. 🌸 🔔 🪞 The three Sun Gems; ☀️ put them in the Sun Door (given in the Great Hall)
4. 🐕 Wake up the Sun Dog (given when the Sun Door opens)
5. 📸 Class photo with the Sun Dog (given when he wakes)

A woof near Juf Anne gets a tip for whatever is next.

## Can't get stuck

- **Cleo** is never lost: she follows Spartacus's own path, hops where he jumped or swung, and if he's ever far away she pops up beside him. Waiting on a plate, she comes back when her job there is done, with "Come, Cleo", or when he goes more than 40 m away.
- **Stone blocks** pushed into a corner slide home when he walks out of the garden. Once the steps have risen they stay.
- **Echo Hall:** every part has a crystal; a gate waits to rise while he stands in it.
- **Mirror Hall:** fall into the pit and walk up the ramp in the corner; the hooks swing both ways.
- **The key and the gems** can be dropped anywhere and picked up again; no water inside the temple.
- Everything is saved mid-island: doors, plates, blocks, mirrors, crystals, gems, the Sun Dog, Cleo and the class.

## How it's built

- `levels/island8.blend`, made by `tools/levels/make_island8.py`: the ground (jungle, beach, pond, the plinth, the steps, the pit), every wall (a visible box plus a tall invisible collider, so no Boing-Boing jump lands on one), floors, ledges, columns, statues, places, signposts, crayons, fruit, and a `spot:` marker for every moving part. `dress_island8.py` adds the jungle and the camp; `ambience.py` the frogs, leaping fish and the perched bird.
- `src/islands/island8/`: `index.js` (missions, wiring, saves), `cleo.js` (the corgi), `school.js` (Juf Anne and the class, who move while he's elsewhere), `doors.js` (sinking doors, paw plates), `blocks.js` (push blocks on a grid), `crystals.js` (the Echo Hall's red and blue), `beams.js` (sunbeams and mirrors: beams run along x or z, so a mirror just swaps the direction), `chests.js` (chests, the Sun Gem model), `sundog.js`, `photo.js` (the photo cutscene: it renders a frame and reads the canvas straight back).
- New shared bits: a task can be `hidden()` until it's given (`game/tasks.js`), a `pot` toy, the Sun Medal and the class photo as ship treasures (`savePhoto`/`loadPhoto` in `core/save.js`), crayon and photo-frame models, a handful of synthesised sounds (yip, echo, rumble, scrape, click, crystal, fanfare, sneeze, shutter).
- About 400 draw calls at the spawn, 110–130 inside the temple. The level is 1.4 MB plus 0.46 MB of heights.

## For Zoë

Ask her after she's played it, and change things to her answers:

- **The names:** Sunpaw Temple, the Sun Dog, the Sun Gems, the rooms (Garden Court, Echo Hall, Mirror Hall, Sun Chamber).
- **Cleo:** she goes home with the class at the end. Should she join the crew instead?
- **The photo:** does she want it bigger, framed differently, or a print-out?
- **What happens next.** The end panel asks her to make up the story.
- Tuning to try with her: how long a push takes (`PUSH_TIME` in `blocks.js`), how near a woof must be to a crystal (`HEAR_REACH` in `crystals.js`), Cleo's speed and gap (`cleo.js`), the indoor camera (`camera.limit` in `index.js`).
