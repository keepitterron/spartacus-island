# Plan: the island 1 treatment for islands 2–7

**Status:** agreed direction (Nov 2026). Decided with Claudio:

- **We design, Zoë is surprised.** She doesn't want to design islands: she may give a direction (a friend, a place, a fruit) and plays what we make. Nothing waits for her.
- **Every island moves to Blender.**
- **iPhone only.** She plays on Claudio's iPhone (landscape, about 844 × 390 points), never on a tablet. Test at that size.
- **Toys are good:** more of them, on more islands.
- **Easy to find, still a puzzle** ([design-rules.md](design-rules.md)): a first pass over every island is done (Nov 2026: Wasabi's bubbles, the island 4 crabs, the last collectibles sparkle, hints that say where).

## What island 1 got

| #   | Layer                 | What it was                                                                                      | Shared code?                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1   | **Layout remake**     | Twice as wide, laid out in Blender; grey-box made by `make_island1.py`                           | pipeline yes, layout no                                     |
| 2   | **Characters**        | Juf Anne, Chris, the amethyst crabs                                                              | no                                                          |
| 3   | **Places**            | Names, signposts, a title card the first time you walk in (`systems/places.js`)                  | yes                                                         |
| 4   | **Mid-island saves**  | Continue puts back tasks, bones, the island's own state                                          | system yes, each island's state no                          |
| 5   | **Dressing**          | Grey boxes become invisible colliders with a look on top; ~70 Quaternius models round the places | `library.py` yes, `dress_island1.py` is island 1's          |
| 6   | **Alive**             | Campfire, spring bubbles; palms sway everywhere                                                  | palms and bubbles (`world/bubble-spot.js`) yes              |
| 7   | **Phone performance** | Static scenery merged per patch, instanced palm crowns, `mergeParts` for characters              | merging yes, but islands 2–7 don't register their own props |
| 8   | **Readable dialogue** | Messages queue; every character speaks in the speech box (`say`)                                 | **done for every island**                                   |
| 9   | **Toys**              | Crates and barrels to bowl over (`systems/toys.js`, Rapier)                                      | yes                                                         |

## Where islands 2–7 stand

Draw calls at the spawn point, headless Chrome (island 1: 407 after its performance work, 1,670 before).

| #   | Island             | Code  | Saves | Draw calls | Terrain                      | Move to Blender: the hard part                             |
| --- | ------------------ | ----- | ----- | ---------- | ---------------------------- | ---------------------------------------------------------- |
| 2   | Hook Rock Bay      | 319   | no    | **480**    | land                         | nothing: rocks, pillars, a mesa                            |
| 3   | Mossy Paw Woods    | 823   | no    | 389        | land, trees and vines        | trees, vines and ziplines stay code, on markers            |
| 4   | Bubbly Ocean       | 1,748 | no    | **653**    | underwater                   | the sea floor as ground 20 m down; the canyon and the lane |
| 5   | Rainbow Reef       | 1,649 | yes   | 197        | five islets in a lagoon      | one ground for all five islets and the sandbar             |
| 6   | Cottoncrest Islets | 1,387 | yes   | 134        | clouds in the sky            | no ground at all: clouds are platforms (colliders)         |
| 7   | Jamboree Island    | 3,294 | yes   | 351        | funfair, rides built in code | rides stay code, on markers; the biggest job               |

## Single pass or one at a time, now

With Zoë out of the critical path, the main reason for going one island at a time (waiting for her map) is gone. What's left in favour of rounds: each one is a PR that can be played and shipped, Zoë gets a new surprise every round, and a mistake stays on one island. In favour of a single pass: the tools are written once and the shared `rand()` chain disappears.

**So: one pass, shipped in rounds.** Build the shared foundations first, then move the islands one after another without pausing, one PR each, every PR live on `main`. That's a single pass in planning (same tools, same rules, the islands in a row) and rounds in shipping.

## Phase A: foundations (no island changes how it plays)

1. ✅ **Phone performance** (done: instanced particles, small far things not drawn, islands 2–7's props merged; see architecture.md). Islands 2–7 register their own fixed props with `addStatic`; characters use `mergeParts`. Islands 4 and 2 first. It also makes the later Blender export simpler (static scenery is exactly what goes into the `.blend`).
2. ✅ **Mid-island saves for islands 2–4** (done), so all seven islands save the same way before their layouts move.
3. **Pipeline upgrades:**
   - ✅ **A small ground** (done: `heights.bin`, island 1 went from 2.9 MB to 1.9 MB). Export the height grid as a 16-bit heightmap instead of a mesh. Today the ground is half of island 1's 2.9 MB file; seven levels at that rate would add about 17 MB to the offline download.
   - ✅ **Places and signposts as markers** (done: `place:Name`, `sign:Name`), not code positions (island 1's first, as the example).
   - **Moved into the rounds** (Nov 2026), because each is best built and tested against the island that first needs it:
     - the **capture tool** (record an island's terrain and its palms, rocks, docks, pickups, fruit and digs from the running game; a Blender script builds the `.blend` from it) and **sailing into a level island**: island 2's round
     - the **data-driven grey-box and dressing script**: island 2's round, generalised from `make_island1.py` and `dress_island1.py`
     - **under water**: island 4's round; **no ground** (clouds): island 6's round
4. **The ambience kit** grows round by round: `world/bubble-spot.js` is the first piece (island 1's spring, island 5's Wasabi spot); the campfire, fish, frogs and birds that land follow as the islands need them.

## Phase B: the islands, in order

Each round: export the island's current layout into a `.blend` as it is (`height()` sampled into the ground, random palms and rocks into markers, the code-built things onto `spot:` markers), check it plays exactly the same, then rework it in Blender:

- **Layout:** bigger where it helps, each moment its own small place, with names and signposts
- **Dressing:** looks over the grey boxes, models round the places
- **Alive:** a few ambience pieces per island
- **Toys:** a themed toy area (see below)
- **Findable:** walk the island at iPhone size; anything to find is visible from where its hint fires

The order:

1. ✅ **Island 2, Hook Rock Bay** (done, [island2.md](island2.md)). Next in the story, the smallest and plainest: the new tools get tested on an easy one. Also the worst draw calls for its size.
2. ✅ **Island 3, Mossy Paw Woods** (done, [island3.md](island3.md)). Land again; trees and vines stay code on markers.
3. **Island 4, Bubbly Ocean.** The first underwater level.
4. **Island 5, Rainbow Reef.** Five islets in one ground.
5. **Island 6, Cottoncrest Islets.** The first level with no ground.
6. **Island 7, Jamboree Island.** Last: the most code, the newest design.

When every island has its own seed, delete `sharedSeedAfter` and the "build order matters" rule (CLAUDE.md, islands.md, levels.md).

## Toys on every island

Rapier stays for toys only (Spartacus keeps `stepPlayer`). One themed toy area per island, built in its round:

- **2, Hook Rock Bay:** a pirate's stack of barrels and crates on the beach; buoys bobbing in the bay
- **3, Mossy Paw Woods:** pine cones and acorns that roll downhill; a log stack
- **4, Bubbly Ocean:** shells and sea urchins that drift and bounce slowly (low gravity, if Rapier's per-area gravity allows it, or heavy damping)
- **5, Rainbow Reef:** beach balls and floats in the lagoon; crates in Crab Cove
- **6, Cottoncrest Islets:** fluffy cloud puffs that bounce high
- **7, Jamboree Island:** a coconut shy and skittles to bowl over (giant Spartacus bowling, an idea from island 7's notes)

Later, once Zoë has played with them, puzzles built on toys (stack crates to reach a ledge, roll a ball onto a plate).

## Budgets (iPhone)

- **Download:** keep each `level.glb` at about 2 MB or less with the heightmap ground (models are stored once, however many times they're placed). The whole game under about 25 MB precached.
- **Draw calls:** under about 400 at any spot.
- **Test at 844 × 390** (an iPhone held sideways), with touch controls on.

## Still open

- **How much bigger?** Island 1 went from 60 to 130 m across. Islands 2–4 are the smallest and oldest and gain most from growing; 5–7 are already big, so they'd get dressing, places and toys rather than more space. A rule of thumb, to revisit after island 2.
