# One-off (Nov 2026): moves island 1's named places and signposts from code (PLACES in
# src/islands/island1/index.js) into levels/island1.blend as markers, in a "Places" collection:
#   place:<Name>  a sphere empty, its size the radius where the name comes up
#   sign:<Name>   a signpost, facing the middle of the island; Hallo Harbour's has `arrows`
# Re-runnable: it replaces the Places collection. Then export (export.py).
#
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island1.blend tools/levels/add_places_island1.py
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import blender_xyz  # noqa: E402

# island-local game (x, z), radius; sign: where its signpost stands
PLACES = [
    ("Hallo Harbour", 0, 50, 13, (4.5, 45)),
    ("Sleepy Gull Beach", -37, 48, 12, (-29, 43)),
    ("Boing-Boing Grove", 39, 30, 12, (29, 31)),
    ("Growly Cave", -3, 20, 8, (4, 25.5)),
    ("Lost & Found Camp", -41, -1, 10, None),  # the camp paints the level's own sign
    ("Lily Pond", 14, -4, 19, (-4.5, 3)),
    ("Ding-Dong Point", -40, -35, 12, (-30, -27)),
    ("Treasure Hill", -6, -48, 11, (-5, -36)),
    ("Bubbly Spring", 24, -40, 8, (19, -42)),
]
HARBOUR_ARROWS = "Growly Cave, Treasure Hill, Ding-Dong Point, Sleepy Gull Beach, Boing-Boing Grove"
FACE = (0, 10)  # signs face the middle of the island


def ground_height(x, z):
    ground = bpy.data.objects["ground"]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    origin = Vector(blender_xyz(x, 200, z))
    hit, location, *_ = ground.evaluated_get(depsgraph).ray_cast(
        ground.matrix_world.inverted() @ origin, Vector((0, 0, -1))
    )
    return (ground.matrix_world @ location).z if hit else 0


def replace_collection(name):
    old = bpy.data.collections.get(name)
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def empty(name, x, z, coll, *, display, size):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = blender_xyz(x, ground_height(x, z), z)
    coll.objects.link(obj)
    return obj


def main():
    coll = replace_collection("Places")
    for name, x, z, radius, sign in PLACES:
        place = empty(f"place:{name}", x, z, coll, display="SPHERE", size=1)
        place.scale = (radius, radius, radius)
        if not sign:
            continue
        sx, sz = sign
        post = empty(f"sign:{name}", sx, sz, coll, display="ARROWS", size=1.5)
        # the board faces the empty's front (Blender -Y, the game's +z) turned by its z rotation,
        # which is the game's yaw: atan2(dx, dz) towards the middle
        post.rotation_euler = (0, 0, math.atan2(FACE[0] - sx, FACE[1] - sz))
        if name == "Hallo Harbour":
            post["arrows"] = HARBOUR_ARROWS
    bpy.ops.wm.save_mainfile()
    print(f"placed {len(coll.objects)} markers in Places")


main()
