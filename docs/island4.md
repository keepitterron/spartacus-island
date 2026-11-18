# Island 4: Bubbly Ocean (sea floor in Blender)

Remade in Nov 2026 (the third round of the [levels plan](levels-plan.md)). The puzzle in the middle is exactly as it was; the basin round it is wider (open sea floor out to about 42 m from the middle, was about 27 m; Spartacus can roam to 46 m) with new places to explore. A mid-island save from the old layout starts the island fresh (`layout: 2`).

- Level: `levels/island4.blend`, made by `tools/levels/make_island4.py` (the sea floor, 20 m down, and its walls; boulders; places) and dressed by `tools/levels/dress_island4.py` (a sunken rowing boat with its cargo, mossy boulders). The ground is painted sandy, fading to rock where it rises (`groundPalette: { seabed }`).
- Code: everything the puzzle needs stays in code at the positions in `src/islands/island4/geo.js` and `index.js`: the seaweed lane and its tentacle gates, the octopus, the vent canyon and pillow, the high places and the crabs, the ship in its bubble, the surface and sun rays. The coral, starfish and loose kelp are scattered over the whole basin now.
- No toys here yet: Rapier's toys fall with normal gravity, which would look wrong under water (the plan's slow, drifting shells need low gravity per toy area first).

## The places

| Place              | What happens                                                    |
| ------------------ | --------------------------------------------------------------- |
| **Bubble Landing** | The ship in its bubble, where Spartacus arrives.                |
| **Seaweed Lane**   | Eduardo's chase, past the tentacle gates.                       |
| **Octopus's Bed**  | Where the grumpy octopus sleeps (once he has his pillow).       |
| **Vent Canyon**    | The bubble vents, the pillow at the far end.                    |
| **Sunken Boat**    | A rowing boat on the sea floor, barrels and crates spilled out. |
| **Coral Garden**   | Coral and mossy boulders.                                       |
| **Starfish Flats** | Open sand with starfish and driftwood.                          |

## Tuning notes

- **Vent Canyon** (Nov 2026 play-through): the three push vents' bubbles overlap, so there's nowhere to wait between them. They used to stop in the wrong order (the far one first), which made the canyon impossible to cross down the middle. Now each vent stops 0.6 s after the one before it: a dash just after the first one stops gets through (about 0.7 s of every 3 s, walking or running), and the last vent stops short of the pillow's rock, so standing there to grab it is safe.
