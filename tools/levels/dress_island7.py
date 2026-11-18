# Dresses levels/island7.blend (Jamboree Island) with a few Quaternius models by the dock and the
# plaza (docs/island7.md); the fair's own stalls, lamps, balloons and rides are the island's code.
# Re-runnable: replaces the Library and Dressing collections only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island7.blend tools/levels/dress_island7.py
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

PLACES = {
    "the dock": [
        ("Barrel", -3.5, 55, {"collider": "cyl"}),
        ("Crate", -4.6, 56.4, {"yaw": 15, "collider": "box"}),
        ("Bags", 3.6, 55.5, {"yaw": -30}),
    ],
    "The Plaza": [
        ("Bench_1", -5.5, 25, {"yaw": 90, "collider": "box"}),
        ("Flowers", 5, 26.5),
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
