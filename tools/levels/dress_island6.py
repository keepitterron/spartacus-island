# Dresses levels/island6.blend (Cottoncrest Islets, in the sky) with a few Quaternius models on the
# cloud tops (docs/island6.md): supplies where the ship moors, a bench and flowers on the palace
# cloud, mossy rocks on the Smash-Smash cloud. Every model has an explicit height (there's no
# ground: each stands on its cloud's top). Re-runnable: replaces the Library and Dressing only.
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island6.blend tools/levels/dress_island6.py
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import Dresser  # noqa: E402

PLACES = {
    "Spawn Cloud": [
        ("Barrel", 4.5, 18, {"y": 0, "collider": "cyl"}),
        ("Crate", 5, 16.3, {"y": 0, "yaw": 25, "collider": "box"}),
        ("Flowers", -3, 13, {"y": 0}),
        ("Flowers", 2, 11, {"y": 0}),
    ],
    "Lina's Palace": [
        ("Bench_1", 6, -50, {"y": 7, "yaw": -150, "collider": "box"}),
        ("Flowers", -4, -48, {"y": 7}),
        ("Flowers", 5, -61, {"y": 7}),
        ("Grass", -7, -58, {"y": 7}),
    ],
    "Tickle Tunnels": [
        ("Rock_Moss_4", -50, -78, {"y": 10, "collider": "cyl"}),
        ("Plant_3", -42, -72, {"y": 10}),
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
