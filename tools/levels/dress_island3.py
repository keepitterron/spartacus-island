# Dresses levels/island3.blend (Mossy Paw Woods) with Quaternius models round each place
# (docs/island3.md). Re-runnable: it replaces the Library and Dressing collections only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island3.blend tools/levels/dress_island3.py
#
# Positions are the game's island-local (x, z), as in make_island3.py. The woods' own little
# pines and round trees are still built by the island's code (buildForest); these are the bigger
# pieces round the places, kept clear of the treetop route and the stream.
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

TREE = {"collider": "cyl", "radius": 0.45}

PLACES = {
    "Mossy Landing": [
        ("Lifeboat", 9, 38, {"yaw": -70, "collider": "box"}),
        ("Barrel", -4, 36, {"collider": "cyl"}),
        ("Crate", -4.2, 37.6, {"yaw": 15, "collider": "box"}),
        ("Bench_1", 7, 30, {"yaw": -120, "collider": "box"}),
        ("Grass", 3, 26),
        ("Flowers", -3, 24),
    ],
    "Wasabi's Spring": [
        ("Willow_2", -18, -8, TREE),
        ("Rock_Moss_4", -16, 0, {"collider": "cyl"}),
        ("Lilypad", -11, -6, {"y": 0.55, "wet": True}),
        ("Plant_3", -8, -9),
        ("Grass", -15, -1),
    ],
    "The Water Gate": [
        ("Rock_Moss_1", -20, -20, {"collider": "cyl"}),
        ("Rock_Moss_4", -8, -22, {"collider": "cyl"}),
        ("TreeStump_Moss", -19, -14, {"collider": "cyl"}),
    ],
    "Toadstool Glade": [
        ("BushBerries_1", 18, 9),
        ("Flowers", 11, 9),
        ("Grass", 17, 3),
        ("Plant_3", 10, 4),
    ],
    "Pinecone Hill": [
        ("CommonTree_3", 32, -10, TREE),
        ("CommonTree_1", 24, -12, TREE),
        ("Bench_1", 30, -3, {"yaw": 100, "collider": "box"}),
        ("Flowers", 26, -2),
    ],
    "Mossy Hollow": [
        ("WoodLog_Moss", -25, 15, {"yaw": 30, "collider": "box"}),
        ("WoodLog_Moss", -34, 10, {"yaw": -60}),
        ("TreeStump_Moss", -26, 3, {"collider": "cyl"}),
        ("Rock_Moss_1", -36, 13, {"collider": "cyl"}),
        ("Plant_3", -29, 15),
        ("Grass", -24, 7),
        ("BushBerries_1", -37, 6),
    ],
    # bigger trees round the edge of the woods
    "woods": [
        ("CommonTree_1", -20, 20, TREE),
        ("CommonTree_2", 18, 22, TREE),
        ("Tree1", 24, 4, TREE),
        ("CommonTree_3", -24, -24, TREE),
        ("CommonTree_2", 4, -28, TREE),
        ("Tree1", -30, -4, TREE),
        ("CommonTree_1", 30, 16, TREE),
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
