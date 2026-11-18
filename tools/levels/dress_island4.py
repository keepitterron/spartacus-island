# Dresses levels/island4.blend (Bubbly Ocean, under water) with Quaternius models: a sunken rowing
# boat with its spilled cargo, and mossy boulders (docs/island4.md). The coral, starfish and kelp
# are still the island's code. Re-runnable: it replaces the Library and Dressing collections only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island4.blend tools/levels/dress_island4.py
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

WET = {"wet": True}  # everything here is under water

PLACES = {
    "Sunken Boat": [
        ("Boat", -27, 4, {**WET, "yaw": 35, "collider": "box", "sink": 0.5}),
        ("Barrel", -23, 7.5, {**WET, "collider": "cyl", "yaw": 50}),
        ("Crate", -31, 0, {**WET, "collider": "box", "yaw": 20}),
        ("Crate", -24.5, 1, {**WET, "yaw": -15}),
        ("Bags", -29.5, 8, {**WET, "yaw": 80}),
    ],
    "Coral Garden": [
        ("Rock_Moss_1", 31, 10, {**WET, "collider": "cyl"}),
        ("Rock_Moss_4", 22, 19, {**WET, "collider": "cyl"}),
    ],
    "Starfish Flats": [
        ("Rock_Moss_4", 11, 36, {**WET, "collider": "cyl"}),
        ("WoodLog_Moss", 0, 34, {**WET, "yaw": 70}),
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
