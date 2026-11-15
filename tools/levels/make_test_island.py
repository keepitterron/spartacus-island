# Builds levels/island8.blend, the test island for the Blender level pipeline, from scratch.
# A one-off starting point: after this, edit levels/island8.blend in Blender by hand.
# Running it again OVERWRITES the .blend, so only do that on purpose.
#
#   blender -b --python tools/levels/make_test_island.py
#
# Coordinates below are the GAME's island-local (x, z) with y up, as in docs/islands.md.
# Blender is z-up with -y towards the game's +z, so a game spot (x, y, z) is Blender (x, -z, y).
import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island8.blend")

GROUND_SIZE = 184  # metres across; the beach is at about 64 from the centre
GROUND_CUTS = 150  # grid cuts each way: one vertex every ~1.2 m


def smoothstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def bump(x, z, cx, cz, height, sigma):
    d2 = (x - cx) ** 2 + (z - cz) ** 2
    return height * math.exp(-d2 / (2 * sigma * sigma))


HILL = (-25, -20)  # the big hill, ~13 m up
LAGOON = (32, -18)
SPAWN = (0, 52)


def shore_radius(angle):
    return 68 + 5 * math.sin(angle * 3) + 3 * math.sin(angle * 5 + 1)


def height(x, z):
    r = math.hypot(x, z)
    h = 1.0 + 0.4 * math.sin(x * 0.15) * math.cos(z * 0.12) + 0.2 * math.sin(x * 0.4 - z * 0.3)
    h += bump(x, z, *HILL, 12, 14)
    h += bump(x, z, 30, 26, 4, 8)
    h += bump(x, z, -40, 32, 3, 9)
    lagoon = math.hypot(x - LAGOON[0], z - LAGOON[1])
    h = lerp(-2.2, h, smoothstep(12, 15.5, lagoon))
    # flat ground where he arrives and around the fort
    h = lerp(h, 1.0, 1 - smoothstep(9, 15, math.hypot(x - SPAWN[0], z - SPAWN[1])))
    h = lerp(h, 1.1, 1 - smoothstep(10, 15, math.hypot(x + 38, z - 18)))
    shore = shore_radius(math.atan2(z, x))
    h = lerp(h, 0.35, smoothstep(shore - 7, shore - 3, r))
    return lerp(h, -4.6, smoothstep(shore, shore + 4, r))


def blender_xyz(x, y, z):
    return (x, -z, y)


# ---------- helpers ----------


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


MATERIALS = {}


def colour(hex_rgb):
    """A plain Principled material; the game turns it into its own flat-shaded material."""
    if hex_rgb in MATERIALS:
        return MATERIALS[hex_rgb]
    mat = bpy.data.materials.new(f"#{hex_rgb:06x}")
    rgb = [srgb_to_linear(((hex_rgb >> s) & 255) / 255) for s in (16, 8, 0)]
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
    MATERIALS[hex_rgb] = mat
    return mat


def collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def link(obj, coll):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def marker(name, x, z, coll, y=None, scale=None, **props):
    """An empty: its name says what it becomes in the game (see docs/levels.md)."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "SPHERE" if scale else "PLAIN_AXES"
    empty.empty_display_size = 1 if scale else 0.8
    empty.location = blender_xyz(x, height(x, z) if y is None else y, z)
    if scale:
        empty.scale = scale
    for key, value in props.items():
        empty[key] = value
    coll.objects.link(empty)
    return empty


def box(name, x, z, size, coll, color, bottom=None, collider="box"):
    """A box standing on the ground at (x, z); size = (width x, height y, depth z)."""
    bottom = height(x, z) - 0.3 if bottom is None else bottom
    w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=blender_xyz(x, bottom + h / 2, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(colour(color))
    if collider:
        obj["collider"] = collider
    return link(obj, coll)


def cylinder(name, x, z, coll, radius, tall, color, bottom=None, collider="cyl", sides=10):
    bottom = height(x, z) - 0.3 if bottom is None else bottom
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=sides, radius=radius, depth=tall, location=blender_xyz(x, bottom + tall / 2, z)
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(colour(color))
    if collider:
        obj["collider"] = collider
    return link(obj, coll)


def cone(name, x, z, coll, radius, tall, color, bottom):
    bpy.ops.mesh.primitive_cone_add(
        vertices=10, radius1=radius, depth=tall, location=blender_xyz(x, bottom + tall / 2, z)
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(colour(color))
    return link(obj, coll)


# ---------- the island ----------


def build_ground(coll):
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=GROUND_CUTS, y_subdivisions=GROUND_CUTS, size=GROUND_SIZE
    )
    ground = bpy.context.object
    ground.name = "ground"
    for v in ground.data.vertices:
        x, z = v.co.x, -v.co.y
        v.co.z = height(x, z)
    ground.data.materials.append(colour(0x6ccb5f))
    # smooth: a flat-shaded mesh exports every face's corners separately (4x the file size)
    bpy.ops.object.shade_smooth()
    return link(ground, coll)


def build_scenery(coll):
    # the Boing-Boing mesa by the landing beach: 4.4 m of sandstone, a marked dig on top
    cylinder("mesa", -8, 22, coll, radius=4, tall=4.7, color=0xc9a27a, sides=9)
    # the old fort: four walls with a gateway, a tower in one corner, crates up to it
    fx, fz = -38, 18
    stone = 0xb8b0a0
    box("fort wall north", fx, fz - 7, (15, 3, 1), coll, stone)
    box("fort wall west", fx - 7, fz, (1, 3, 13), coll, stone)
    box("fort wall east", fx + 7, fz, (1, 3, 13), coll, stone)
    box("fort wall south", fx - 4.5, fz + 7, (6, 3, 1), coll, stone)
    box("fort wall south", fx + 4.5, fz + 7, (6, 3, 1), coll, stone)
    box("fort tower", fx - 4.5, fz - 4.5, (4, 6.3, 4), coll, 0xa39a8a)
    # crates in a row towards the tower, each one 1.2 m higher than the last (a normal jump)
    for i, (dx, dz) in enumerate([(2.6, -1.5), (0.8, -1.5), (-1, -1.5), (-2.8, -1.5)]):
        box("crate", fx + dx, fz + dz, (1.6, 1.2 * (i + 1) + 0.3, 1.6), coll, 0xb57b46)
    # the lighthouse on the north cape
    lx, lz = 6, -60
    base = height(lx, lz) - 0.3
    cylinder("lighthouse", lx, lz, coll, radius=1.8, tall=9, color=0xfaf6ee)
    cylinder("lighthouse band", lx, lz, coll, radius=1.85, tall=1.2, color=0xe0524a,
             bottom=base + 5, collider=None)
    cone("lighthouse roof", lx, lz, coll, radius=2.3, tall=2.2, color=0xe0524a, bottom=base + 9)
    # a flag on top of the big hill
    hx, hz = HILL
    top = height(hx, hz)
    cylinder("flag pole", hx, hz, coll, radius=0.08, tall=4, color=0x7a4a2a, sides=6, collider=None)
    box("flag", hx + 0.75, hz, (1.4, 0.9, 0.06), coll, 0xffd84d, bottom=top + 2.8, collider=None)


def build_markers(coll):
    marker("spawn", *SPAWN, coll)
    marker("dock", 0, 59, coll, length=11)
    marker("spot:ship", 5.6, 75, coll, y=0)
    marker("spot:summit", *HILL, coll)
    # palms round the beach (not on the dock path), and a little grove by the fort
    for i in range(30):
        angle = i / 30 * math.tau + 0.11
        if abs(angle - math.pi / 2) < 0.25:
            continue
        r = shore_radius(angle) - 9 - (i % 3) * 2.5
        marker("palm", math.cos(angle) * r, math.sin(angle) * r, coll)
    for x, z in [(-28, 30), (-24, 36), (-48, 6), (14, 30), (22, 40)]:
        marker("palm", x, z, coll)
    # decorative rocks: scale X = radius, scale Z (up) = height
    for x, z, radius, tall in [(12, 48, 1.2, 0.9), (-18, 46, 1.6, 1.3), (40, 8, 1.4, 1.1),
                               (-50, -20, 2, 1.6), (-8, -40, 1.3, 1), (24, -48, 1.8, 1.4),
                               (50, 30, 1.1, 0.8), (-30, 50, 1.5, 1.1)]:
        marker("rock", x, z, coll, scale=(radius, radius, tall))
    # lagoon pillars for the swing route; spots on their tops are the hook ends
    pillars = [(24, -22, 1.4, 6), (32, -28, 1.5, 9), (41, -18, 1.3, 7.5)]
    for x, z, radius, tall in pillars:
        marker("rock", x, z, coll, scale=(radius, radius, tall), color="#9aa6b8")
    marker("spot:hook start", 16, -15, coll)
    for i, (x, z, _, tall) in enumerate(pillars):
        marker(f"spot:pillar {i + 1}", x, z, coll, y=height(x, z) + tall + 0.3)
    marker("spot:hook end", 49, -13, coll)
    # bones: on the tower, the lagoon pillars, the hill, by the lighthouse, in the fort…
    marker("pickup", -42.5, 13.5, coll, y=7.5)  # top of the fort tower
    marker("pickup", 32, -28, coll, y=height(32, -28) + 9.3)
    marker("pickup", 41, -18, coll, y=height(41, -18) + 7.8)
    marker("pickup", HILL[0] + 2, HILL[1] + 1, coll)
    marker("pickup", 9, -58, coll)
    marker("pickup", -35, 22, coll)
    marker("pickup", 34, 28, coll)
    marker("pickup", -56, -30, coll)
    marker("dig:marked", -8, 22, coll, y=height(-8, 22) + 4.6)  # on top of the mesa
    marker("dig", -58, 20, coll)
    # fruit bushes
    marker("fruit:boing", 7, 43, coll)
    marker("fruit:stretch", 12, -10, coll)
    # beach balls and critters
    for x, z in [(-5, 46), (6, 50), (-36, 18)]:
        marker("ball", x, z, coll)
    for x, z in [(-20, 40), (30, 20), (-45, -30), (10, -45)]:
        marker("birds", x, z, coll)
    for x, z in [(-12, 30), (20, 10), (-30, -5), (40, 30)]:
        marker("butterflies", x, z, coll)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_ground(collection("Ground"))
    build_scenery(collection("Scenery"))
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
