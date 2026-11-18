# Dresses levels/island5.blend (Rainbow Reef) with a few Quaternius models on the hub island, round
# the dock and the arch (docs/island5.md). The islets are left to their puzzles (cove.js,
# seastack.js, tide.js, kelp.js build there). Re-runnable: replaces the Library and Dressing only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island5.blend tools/levels/dress_island5.py
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

PLACES = {
    "Unicorn's Arch": [
        ("Lifeboat", 9, 13.5, {"yaw": -60, "collider": "box"}),
        ("Barrel", 2.6, 10.5, {"collider": "cyl"}),
        ("Crate", 3.8, 11.5, {"yaw": 20, "collider": "box"}),
        ("Bench_1", -8, 3, {"yaw": 60, "collider": "box"}),
        ("Flowers", -5, -9),
        ("Flowers", 4, -10),
        ("Grass", -11, -4),
        ("Grass", 12, 2),
        ("Plant_3", -2, -13),
        ("BushBerries_1", 13, -5),
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
