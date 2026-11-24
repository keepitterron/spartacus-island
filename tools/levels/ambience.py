# Ambience markers: frogs at pond edges, fish that leap out of the sea, and single birds perched on
# signposts (systems/critters.js, systems/frogs.js). Re-runnable: it replaces the level's Ambience
# collection with what's listed here for that island. Positions are game island-local (x, z).
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island1.blend tools/levels/ambience.py
#   then export.py to write the .glb
import os
import re
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import ground_height, replace_collection  # noqa: E402
from helpers import blender_xyz  # noqa: E402

# frogs: on land a step from water (they find the water themselves, within 4.5 m);
# leaps: in water deeper than 0.8 m; perch: the name of a signpost the bird sits on
AMBIENCE = {
    1: {
        "frogs": [(-2, -10), (5, 11), (31, -6)],  # round the Lily Pond
        "leaps": [(-12, 70), (16, 68)],  # either side of the dock
        "perch": ["sign:Hallo Harbour", "sign:Lily Pond"],
    },
    2: {
        "leaps": [(6, -20), (-8, 58)],  # Hook Rock Lagoon, off the dock
        "perch": ["sign:Ahoy Beach"],
    },
    3: {
        "perch": ["sign:Mossy Landing"],
    },
    5: {
        "leaps": [(-14, -22), (18, -22), (0, 26)],  # the lagoon round Unicorn's Arch
        "perch": ["sign:Unicorn's Arch"],
    },
    7: {
        "leaps": [(10, 66), (-12, 66)],  # off the dock
        "perch": ["sign:The Plaza"],
    },
    8: {
        "frogs": [(-25.5, 64), (-40, 58.5)],  # round the Jungle Pond
        "leaps": [(15, 99), (0, 101)],  # either side of the dock
        "perch": ["sign:Base Camp"],
    },
}


def signpost_top(sign):
    """Just above where systems/places.js puts a signpost's top (its collider): 1.5 m, 0.45 m
    an arrow, 0.3 m of post; the game snaps the bird down onto it."""
    arrows = [a for a in str(sign.get("arrows", "")).split(",") if a.strip()]
    return sign.location.z + 1.5 + len(arrows) * 0.45 + 0.3 + 0.2


def marker(name, location, coll):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.8
    empty.location = location
    coll.objects.link(empty)


def main():
    island = int(re.search(r"island(\d+)", bpy.data.filepath).group(1))
    spots = AMBIENCE.get(island, {})
    coll = replace_collection("Ambience")
    for x, z in spots.get("frogs", []):
        marker("frogs", blender_xyz(x, ground_height(x, z), z), coll)
    for x, z in spots.get("leaps", []):
        marker("leaps", blender_xyz(x, 0, z), coll)
    for name in spots.get("perch", []):
        sign = bpy.data.objects[name]
        marker("perch", (sign.location.x, sign.location.y, signpost_top(sign)), coll)
    bpy.ops.wm.save_mainfile()
    print(f"ambience for island {island}: {len(coll.objects)} markers")


main()
if bpy.app.background:
    sys.exit(0)
