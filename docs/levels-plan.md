# Plan: the island 1 treatment for islands 2–7

**Status:** a proposal (Nov 2026), to agree with Claudio before starting. Open questions at the end.

## What island 1 got

Island 1 went through eight layers of work (Oct–Nov 2026, PRs 22–25 and the commits after):

| #   | Layer                 | What it was                                                                                                 | Needs Zoë? | Shared code?                                                |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| 1   | **Layout remake**     | Twice as wide, laid out in Blender from a map Claudio and Zoë marked up; grey-box made by `make_island1.py` | yes (map)  | pipeline yes, layout no                                     |
| 2   | **Zoë's beats**       | Juf Anne, Chris, the amethyst crabs                                                                         | yes        | no                                                          |
| 3   | **Places**            | Names, signposts, a title card the first time you walk in (`systems/places.js`)                             | names      | yes                                                         |
| 4   | **Mid-island saves**  | Continue puts back tasks, bones, the island's own state                                                     | no         | system yes, each island's state no                          |
| 5   | **Dressing**          | Grey boxes become invisible colliders with a look on top; ~70 Quaternius models round the places            | no         | `library.py` yes, `dress_island1.py` is island 1's          |
| 6   | **Alive**             | Campfire, spring bubbles (`island1/ambience.js`); palms sway everywhere                                     | no         | palms yes, the rest island 1's                              |
| 7   | **Phone performance** | Static scenery merged per patch, instanced palm crowns, `mergeParts` for characters                         | no         | merging yes, but islands 2–7 don't register their own props |
| 8   | **Readable dialogue** | Messages queue; every character speaks in the speech box (`say`)                                            | no         | **done for every island**                                   |

## Where islands 2–7 stand

Draw calls are at the spawn point, measured in headless Chrome (island 1 is 407 after its performance work, 1,670 before).

| #   | Island             | Code  | Layout                                          | Saves | Draw calls | Terrain                      |
| --- | ------------------ | ----- | ----------------------------------------------- | ----- | ---------- | ---------------------------- |
| 2   | Hook Rock Bay      | 319   | hand-built, small                               | no    | **480**    | land                         |
| 3   | Mossy Paw Woods    | 823   | **placeholder**, waiting for Zoë's map          | no    | 389        | land, trees and vines        |
| 4   | Bubbly Ocean       | 1,748 | **placeholder**, waiting for Zoë's map          | no    | **653**    | underwater                   |
| 5   | Rainbow Reef       | 1,649 | designed ([island5.md](island5.md))             | yes   | 197        | five islets                  |
| 6   | Cottoncrest Islets | 1,387 | designed ([island6.md](island6.md))             | yes   | 134        | clouds in the sky            |
| 7   | Jamboree Island    | 3,294 | designed, a surprise ([island7.md](island7.md)) | yes   | 351        | funfair, rides built in code |

None of them registers its own props with `addStatic`. All of them still share the seeded `rand()` chain, so changing one island's scenery moves the trees on every island after it (island 1 escapes with `sharedSeedAfter`).

## Single pass or one island at a time?

Neither on its own. Split the work by whether it needs Zoë.

**What a single pass gains**

- Write the tools once: a data-driven grey-box and dressing script instead of one hand-written pair per island; one model library and palette, so the islands look like one game.
- **The shared `rand()` chain goes away.** Once every island is a level with its own seed, "build order matters" and `sharedSeedAfter` can be deleted, and nobody has to check that the islands after a change are untouched.
- Budgets get decided once for the whole game: the download (every `level.glb` is precached for offline play; island 1's is 2.9 MB and half of that is the ground mesh, so six more like it would add about 17 MB) and the draw calls on a phone.
- Systems that every island needs (saves for islands 2–4, the ambience kit, placing places from markers) are cheaper to write once against six islands than to rework six times.

**What a single pass costs**

- Zoë can't design six islands at once, and the layers that make an island hers (the map, the beats, the names) are the ones that need her.
- Nothing new to play for a long time, and a big change across every island at once is harder to play-test.
- Island 7's rides are 3,300 lines tied to its code layout. Moving it is the biggest job and the least needed (it's new and designed).

**One island at a time** keeps Zoë in the loop and ships something every round, but re-solves the same tool problems each time and keeps the `rand()` chain until the last island moves.

## Recommendation: shared foundations once, then islands in rounds

### Phase A: one pass over all islands, no Zoë needed

Doesn't change how anything plays, so it ships to `main` piece by piece.

1. **Phone performance.** Register islands 2–7's own fixed props with `addStatic` and merge characters with `mergeParts`. Islands 4 and 2 first (worst draw calls). Smallest job, straight win.
2. **Mid-island saves for islands 2–4** (`saveState`/`loadState`: the bridge, the chest, Mango, Eduardo's chase, restore-safe digs). Then all seven islands save the same way.
3. **Pipeline upgrades** before the second Blender island:
   - a smaller ground: export the height grid as a compact 16-bit heightmap instead of a mesh (the game bakes it into a grid anyway), so the ground stops being half of each download
   - place names, signposts and campfire-like spots as markers, not code positions
   - grey-box and dressing scripts driven by a data file per island, sharing island 1's helpers (stone looks, model over box, `check_markers`)
   - the ambience kit: island 1's campfire and bubbles as reusable pieces, plus the next few (fish, frogs, birds landing)
   - check sailing **into** a level island (island 1 has only ever been sailed out of)
4. **Lift and shift (decision needed):** move every island into a `.blend` as it is now (sample its `height()` into a ground mesh, its random palms and rocks into markers, its code-built buildings and rides onto `spot:` markers), checking each plays the same. Afterwards the `rand()` chain is gone and any island can be edited in Blender. Worth it if most islands will be reworked; not if only 2–4 will be.

### Phase B: islands in rounds, with Zoë

Each round is one island through layers 1–7, island 1's recipe: a map session with Zoë → grey-box → her beats → places and names → dressing → alive → play-test on her phone. One round per PR or two.

Suggested order:

1. **Island 2, Hook Rock Bay.** Next in the story, the smallest and the plainest, so the new tools get tested on an easy one.
2. **Island 3, Mossy Paw Woods** and 3. **Island 4, Bubbly Ocean.** Their layouts are placeholders waiting for Zoë anyway, so they gain the most. Island 4 is the first underwater level: check the pipeline handles it (the sea floor as ground, coral and kelp as dressing).
3. **Islands 5–7: dress and liven up, no remake** unless Zoë wants one. They're recent and designed; layers 3, 5 and 6 are what they lack. Island 7 waits for Zoë's answers to its questions anyway.

A round can start the moment Zoë has drawn the map; Phase A work fills the gaps in between.

## Questions for Claudio

1. **Remake or redress?** Islands 2–4 remade bigger from a Zoë map like island 1, and 5–7 only dressed and livened up: agreed?
2. **Lift and shift** every island into Blender first (step A4), or only move the ones being remade?
3. **Order:** start with Phase A step 1 (performance) and island 2's map session in parallel?
4. **Download budget:** the game is about 8 MB precached now. What's acceptable on Zoë's phone: 15 MB? 25 MB?
5. **The Rapier toys** on island 1 were a test: keep them and add some to other islands, or wait until Zoë has played with them?
