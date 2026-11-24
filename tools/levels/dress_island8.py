# Dresses levels/island8.blend (Sunpaw Temple, docs/island8.md) with Quaternius models: the jungle
# round the temple, the school trip's Base Camp, the class's rowing boat on the beach, lilies on the
# pond and flowers in the Garden Court. The temple itself is make_island8.py's.
# Re-runnable: replaces the Library and Dressing collections only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island8.blend tools/levels/dress_island8.py
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402
from make_island8 import ROOMS, POND, shore  # noqa: E402

PLACES = {
    "Base Camp": [
        ("Tent", -12, 63, {"yaw": 35, "collider": "box"}),
        ("Bonfire_Lit", -4, 67),
        ("Bench_1", -4, 71.5, {"yaw": 0, "collider": "box"}),
        ("Bags", -9, 70, {"yaw": 20}),
        ("Crate", -14, 69, {"yaw": 10, "collider": "box"}),
        ("Barrel", -15.5, 67.4, {"collider": "cyl"}),
        ("Flowers", 8, 62),
    ],
    "Sunny Beach": [
        ("Boat", -9, 92, {"yaw": 70}),
        ("Barrel", 2, 88, {"collider": "cyl"}),
        ("Crate", 13, 90, {"yaw": -10, "collider": "box"}),
    ],
    "Jungle Pond": [
        ("Lilypad", -30, 61, {"wet": True, "y": 0.02}),
        ("Lilypad", -37, 67, {"wet": True, "y": 0.02}),
        ("Lilypad", -31, 68, {"wet": True, "y": 0.02}),
        ("Lilypad", -38, 60, {"wet": True, "y": 0.02}),
        ("Plant_3", -25, 60),
        ("Plant_3", -43, 66),
        ("WoodLog_Moss", -27, 72, {"yaw": 40, "collider": "box"}),
    ],
    "Garden Court": [
        ("Flowers", -45, 33),
        ("Flowers", -42, 36),
        ("Flowers", -22, 36),
        ("Flowers", -20, 19),
        ("BushBerries_1", -46, 27),
        ("Grass", -24, 30),
        ("Grass", -40, 25),
        ("CommonTree_1", -45.5, 36.5, {"collider": "cyl", "radius": 0.45}),
    ],
    "Temple Steps": [
        ("Plant_3", -9, 50),
        ("Plant_3", 9, 51),
        ("Rock_Moss_1", 12, 47, {"collider": "cyl"}),
        ("TreeStump_Moss", -15, 47, {"collider": "cyl"}),
    ],
}

TREES = ["CommonTree_1", "CommonTree_2", "CommonTree_3", "Tree1", "Willow_2"]
UNDERGROWTH = ["Plant_3", "Grass", "BushBerries_1"]


def keep_clear(x, z):
    """True where the jungle mustn't grow: the temple, paths, the camp, the pond, the beach."""
    if any(r[0] - 6 < x < r[1] + 6 and r[2] - 6 < z < r[3] + 6 for r in ROOMS.values()):
        return True
    if -9 < x < 12 and 44 < z < 92:  # camp, the path to the steps, the beach
        return True
    if math.hypot(x + 4, z - 67) < 14:
        return True
    px, pz, radius, _ = POND
    if math.hypot(x - px, z - pz) < radius + 3:
        return True
    if math.hypot(x - 30, z - 50) < 5 or math.hypot(x - 24, z - 58) < 4:  # the big rock, a bush
        return True
    return shore(x, z) > 0.84


def jitter(i, j, k):
    """A fixed wobble per grid cell (no random numbers: re-running gives the same jungle)."""
    h = math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453
    return h - math.floor(h)


def jungle(dresser):
    step = 9
    for i in range(-8, 9):
        for j in range(-10, 12):
            x = i * step + (jitter(i, j, 1) - 0.5) * 6
            z = j * step + (jitter(i, j, 2) - 0.5) * 6
            if keep_clear(x, z):
                continue
            pick = jitter(i, j, 3)
            if pick < 0.6:
                name = TREES[int(jitter(i, j, 4) * len(TREES))]
                dresser.place(name, x, z, yaw=jitter(i, j, 5) * 360, collider="cyl", radius=0.45,
                              scale=0.9 + jitter(i, j, 6) * 0.4)
            elif pick < 0.85:
                name = UNDERGROWTH[int(jitter(i, j, 7) * len(UNDERGROWTH))]
                dresser.place(name, x, z, yaw=jitter(i, j, 5) * 360)


def main():
    dresser = Dresser()
    for items in PLACES.values():
        dresser.group(items)
    jungle(dresser)
    dresser.finish(ignore=("birds", "butterflies", "fish", "palm", "rock"))


main()
if bpy.app.background:
    sys.exit(0)
