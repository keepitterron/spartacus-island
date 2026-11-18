# Dresses levels/island2.blend (Hook Rock Bay) with Quaternius models round each place
# (docs/island2.md). Re-runnable: it replaces the Library and Dressing collections only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island2.blend tools/levels/dress_island2.py
#
# Positions are the game's island-local (x, z), as in make_island2.py.
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

TREE = {"collider": "cyl", "radius": 0.45}  # trees collide at the trunk, not the canopy

PLACES = {
    # Ahoy Beach: a beached boat, the camp (its fire is the Bonfire model; code adds the flames),
    # supplies by the dock
    "Ahoy Beach": [
        ("Boat", -19, 42, {"yaw": 65, "collider": "box"}),
        ("Bonfire_Lit", -11, 34),
        ("Bench_1", -8, 31, {"yaw": -35, "collider": "box"}),
        ("Barrel", -15.5, 31, {"collider": "cyl"}),
        ("Bags", -16.5, 33.2, {"yaw": 30}),
        ("Crate", 3.2, 40.5, {"yaw": 10, "collider": "box"}),
        ("Barrel", 4.4, 39, {"collider": "cyl"}),
        ("Grass", 9, 34),
        ("Grass", -4, 30),
    ],
    # Stretchy Grove: a ring of shade trees round the practice swing
    "Stretchy Grove": [
        ("CommonTree_1", -33, 11, TREE),
        ("CommonTree_2", -19, 9, TREE),
        ("CommonTree_3", -30, 6, TREE),
        ("CommonTree_2", -36, 18, TREE),
        ("BushBerries_1", -21, 18),
        ("BushBerries_1", -29, 17),
        ("Flowers", -27, 20),
        ("Flowers", -22, 15.5),
        ("Grass", -34, 24),
    ],
    # Cookie Mesa: mossy boulders round its foot
    "Cookie Mesa": [
        ("Rock_Moss_1", -40, -5, {"collider": "cyl"}),
        ("Rock_Moss_4", -30, -14, {"collider": "cyl"}),
        ("Grass", -37, -2),
        ("Grass", -31, -3),
        ("Plant_3", -39, -12),
    ],
    # Hook Rock Lagoon: plants round the shore, lilies on the water
    "Hook Rock Lagoon": [
        ("Plant_3", -9, -4),
        ("Plant_3", 18, -22),
        ("Plant_3", 14, -1),
        ("Grass", -8, -22),
        ("Grass", 6, 0),
        ("Lilypad", 0, -20, {"y": 0.02, "wet": True}),
        ("Lilypad", 11, -21, {"y": 0.02, "wet": True}),
        ("Lilypad", -4, -10, {"y": 0.02, "wet": True}),
    ],
    # Lookout Hill: a bench to sit and look at the bay, a stump, a tree
    "Lookout Hill": [
        ("Bench_1", 24.5, -26, {"yaw": 200, "collider": "box"}),
        ("TreeStump_Moss", 19.5, -21, {"collider": "cyl"}),
        ("CommonTree_1", 29, -18, TREE),
        ("Flowers", 21, -27),
    ],
    # Crabby Cove: rocks and driftwood
    "Crabby Cove": [
        ("Rock_Moss_4", 42.5, 9.5, {"collider": "cyl"}),
        ("WoodLog_Moss", 32.5, 18, {"yaw": 40}),
        ("Grass", 34, 8),
    ],
    # shade trees inland, and a well
    "inland": [
        ("CommonTree_2", -6, -27, TREE),
        ("CommonTree_3", 20, 8, TREE),
        ("CommonTree_1", -18, -16, TREE),
        ("Well", -15, 4, {"collider": "cyl"}),
    ],
}


def main():
    dresser = Dresser()
    for items in PLACES.values():
        dresser.group(items)
    dresser.finish()


main()
if bpy.app.background:
    sys.exit(0)
