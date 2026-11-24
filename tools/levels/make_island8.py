# Builds levels/island8.blend: Sunpaw Temple (Nov 2026, see docs/island8.md). A jungle island
# with an old temple built by dogs on a stone plinth: six rooms in a cross (Entrance Hall, Great
# Hall, Garden Court, Echo Hall, Mirror Hall, Sun Chamber), the steps up to the Great Door, the
# school trip's Base Camp, a jungle pond and the beach with the dock.
#
# The architecture is here (ground, walls, ledges, pillars, the pit, statues, floors) with
# `spot:` markers in every doorway and on every puzzle piece; src/islands/island8/ builds the
# moving parts (doors, gates, blocks, mirrors, chests, the Sun Dog) on those spots. Walls are a
# visible box with a tall invisible collider (so a Boing-Boing jump never lands on top of one).
# dress_island8.py dresses it. A one-off: don't re-run once the .blend is edited by hand.
#
#   .bpy/bin/python tools/levels/make_island8.py
#
# Coordinates are the game's island-local (x, z), y up (helpers.blender_xyz converts).
import math
import os
import sys

import bpy
import bmesh  # noqa: I001 (bpy first: it provides bmesh)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, blender_xyz, collection, colour, link, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island8.blend")

GROUND_SIZE = 240
GROUND_CUTS = 480  # half a metre apart, the game's height grid
SEA_FLOOR = -4.6
JUNGLE = 1.6
PLINTH = 4.0  # the temple's floor
WALL = 1.2  # wall thickness
OUTER_TALL = 4.5  # how tall walls look (the camera looks down over them inside)
INNER_TALL = 3.0
COLLIDER_TOP = PLINTH + 12  # higher than any jump

# rooms between wall centre lines: x0, x1, z0, z1 (x east, z south towards the dock)
ROOMS = {
    "sun": (-16, 16, -54, -16),
    "echo": (-48, -16, -16, 16),
    "great": (-16, 16, -16, 16),
    "mirror": (16, 48, -16, 16),
    "entrance": (-16, 16, 16, 38),
    "garden": (-48, -16, 16, 38),
    "terrace": (-7, 7, 38, 44),
}
STAIRS = (-5, 5, 44, 50)  # x0, x1, z0, z1: six steps down from the terrace
STEPS = 6
# the Mirror Hall's pit: x0, x1, z0, z1, its floor, the island in it, the ramp out (SE corner)
PIT = (26.3, 47.4, -15.4, 1.7)
PIT_FLOOR = 1.5
PIT_ISLAND = (37, -8, 2.6)  # x, z, radius: a stone pillar
PIT_RAMP = (43, 47.4, -3, 1.7)
PIT_EDGE = 1.2  # how thick the stone sides are (they hide the ground's slope down into it)
POND = (-34, 64, 8, -1.2)  # x, z, radius, depth


def rect_distance(x, z, rect):
    x0, x1, z0, z1 = rect
    dx = max(x0 - x, 0, x - x1)
    dz = max(z0 - z, 0, z - z1)
    return math.hypot(dx, dz)


def jungle(x, z):
    return JUNGLE + 0.3 * math.sin(x * 0.11) * math.cos(z * 0.09) + 0.18 * math.sin((x + z) * 0.21)


def shore(x, z):
    """0 in the middle, 1 at the water's edge: a rounded rectangle with a wobbly edge."""
    angle = math.atan2(z - 8, x)
    r = ((abs(x) / 66) ** 4 + (abs(z - 8) / 88) ** 4) ** 0.25
    return r * (1 + 0.025 * math.sin(angle * 5 + 1) + 0.02 * math.sin(angle * 9))


def pit_height(x, z):
    """Inside the pit (or None): its floor, and the ramp out. The ground drops a little outside
    the pit's sides, under the stone ledges and walls, so its slope never shows; the island is
    only a pillar (a collider), with no ground of its own to slope up to it."""
    x0, x1, z0, z1 = PIT
    under = 0.6
    if not (x0 - under < x < x1 + under and z0 - under < z < z1 + under):
        return None
    rx0, rx1, rz0, rz1 = PIT_RAMP
    if rx0 < x and z > rz0:
        return lerp(PIT_FLOOR, PLINTH, min(1, (z - rz0) / (rz1 - rz0)))
    return PIT_FLOOR


def height(x, z):
    h = jungle(x, z)
    px, pz, radius, depth = POND
    pond = math.hypot(x - px, z - pz)
    h = lerp(h, depth, 1 - smoothstep(radius - 4, radius, pond))
    # the plinth: flat stone in every room, a grassy bank down to the jungle round it
    d = min(rect_distance(x, z, rect) for rect in ROOMS.values())
    h = lerp(PLINTH, h, smoothstep(0.6, 3.5, d))
    sx0, sx1, sz0, sz1 = STAIRS
    if sx0 - 0.5 <= x <= sx1 + 0.5 and sz0 <= z <= sz1:
        step = min(STEPS, math.ceil((z - sz0) / ((sz1 - sz0) / STEPS)))
        h = PLINTH - step * (PLINTH - JUNGLE) / STEPS
    pit = pit_height(x, z)
    if pit is not None:
        h = pit
    # the beach, then the sea
    s = shore(x, z)
    h = lerp(h, 0.45, smoothstep(0.86, 0.93, s))
    return lerp(h, SEA_FLOOR, smoothstep(0.97, 1.04, s))


L = Level(height)


def block(name, coll, *, x0, x1, z0, z1, bottom, top, color, collider="box", invisible=False):
    """An axis-aligned box from (x0, z0) to (x1, z1), bottom to top."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=blender_xyz((x0 + x1) / 2, (bottom + top) / 2, (z0 + z1) / 2))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (x1 - x0, z1 - z0, top - bottom)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(colour(color))
    if collider:
        obj["collider"] = collider
    if invisible:
        obj["invisible"] = 1
    return link(obj, coll)


def cylinder(name, coll, *, x, z, radius, bottom, top, color, collider="cyl", sides=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=top - bottom,
                                        location=blender_xyz(x, (bottom + top) / 2, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(colour(color))
    if collider:
        obj["collider"] = collider
    return link(obj, coll)


def ball(name, coll, *, x, y, z, radius, color, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=blender_xyz(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])  # game x, y, z scales -> Blender's
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(colour(color))
    return link(obj, coll)


STONE = 0xE0C9A0  # sandstone
STONE_DARK = 0xC9AE82
TRIM = 0xF2B84B  # the sun's gold
MOSS = 0x6FBF5A


def wall(coll, *, x0, x1, z0, z1, outer):
    """A wall piece: what you see, a collider that reaches up out of jumping range, a gold trim."""
    bottom = JUNGLE - 0.6 if outer else PLINTH - 0.1
    top = PLINTH + (OUTER_TALL if outer else INNER_TALL)
    block("wall", coll, x0=x0, x1=x1, z0=z0, z1=z1, bottom=bottom, top=top, color=STONE, collider=None)
    block("trim", coll, x0=x0 - 0.08, x1=x1 + 0.08, z0=z0 - 0.08, z1=z1 + 0.08, bottom=top,
          top=top + 0.25, color=TRIM, collider=None)
    block("wallCollider", coll, x0=x0, x1=x1, z0=z0, z1=z1, bottom=bottom, top=COLLIDER_TOP,
          color=STONE, invisible=True)


def wall_x(coll, x, z0, z1, *, gaps=(), outer=False):
    """A wall along z at x, with doorways (z_from, z_to) left open."""
    for a, b in pieces(z0 - WALL / 2, z1 + WALL / 2, gaps):
        wall(coll, x0=x - WALL / 2, x1=x + WALL / 2, z0=a, z1=b, outer=outer)


def wall_z(coll, z, x0, x1, *, gaps=(), outer=False):
    for a, b in pieces(x0 - WALL / 2, x1 + WALL / 2, gaps):
        wall(coll, x0=a, x1=b, z0=z - WALL / 2, z1=z + WALL / 2, outer=outer)


def pieces(start, end, gaps):
    edges, at = [], start
    for a, b in sorted(gaps):
        edges.append((at, a))
        at = b
    edges.append((at, end))
    return [(a, b) for a, b in edges if b - a > 0.05]


def build_walls(coll):
    # the outside of the cross
    wall_z(coll, -54, -16, 16, outer=True)
    wall_x(coll, -16, -54, -16, outer=True)
    wall_x(coll, 16, -54, -16, outer=True)
    wall_z(coll, -16, -48, -16, outer=True)
    wall_z(coll, -16, 16, 48, outer=True)
    wall_x(coll, -48, -16, 38, outer=True)
    wall_x(coll, 48, -16, 16, outer=True)
    wall_z(coll, 16, 16, 48, outer=True)
    wall_x(coll, 16, 16, 38, outer=True)
    wall_z(coll, 38, -48, 16, gaps=[(-2, 2)], outer=True)  # the Great Door
    # inside: doorways to every room
    wall_z(coll, -16, -16, 16, gaps=[(-3, 3)])  # the Sun Door
    wall_x(coll, -16, -16, 16, gaps=[(-2, 2)])  # the locked door to the Echo Hall
    wall_x(coll, 16, -16, 16, gaps=[(-2, 2)])  # an archway to the Mirror Hall
    wall_z(coll, 16, -48, -16)
    wall_z(coll, 16, -16, 16, gaps=[(-4, 4)])  # Entrance Hall to Great Hall
    wall_x(coll, -16, 16, 38, gaps=[(22, 26), (32.45, 33.55)])  # the Garden's gate, Cleo's tunnel
    # the Echo Hall's three parts, with a crystal gate between each
    wall_x(coll, -26, -16, 16, gaps=[(-1.5, 1.5)])
    wall_x(coll, -36, -16, 16, gaps=[(7, 11)])
    # Cleo's tunnel: a low arch Spartacus is too tall for
    block("tunnelArch", coll, x0=-16.6, x1=-15.4, z0=32.3, z1=33.7, bottom=PLINTH + 0.75,
          top=PLINTH + INNER_TALL, color=STONE_DARK, collider=None)
    block("tunnelCollider", coll, x0=-16.6, x1=-15.4, z0=32.3, z1=33.7, bottom=PLINTH + 0.75,
          top=COLLIDER_TOP, color=STONE, invisible=True)


def outside_pit(x0, x1, z0, z1):
    """The parts of a rectangle that aren't over the pit (up to four strips)."""
    px0, px1, pz0, pz1 = PIT
    if x1 <= px0 or x0 >= px1 or z1 <= pz0 or z0 >= pz1:
        return [(x0, x1, z0, z1)]
    strips = [(x0, x1, z0, max(z0, pz0)), (x0, x1, min(z1, pz1), z1),
              (x0, max(x0, px0), max(z0, pz0), min(z1, pz1)), (min(x1, px1), x1, max(z0, pz0), min(z1, pz1))]
    return [(a, b, c, d) for a, b, c, d in strips if b - a > 0.01 and d - c > 0.01]


def floor(coll, name, rect, *, tile=4, colors=(0xEAD7B0, 0xD9C298)):
    """A checkered stone floor over a room, just above the plinth (it isn't a collider). It runs
    to the walls' middle lines, so the doorways between two rooms are floored too."""
    x0, x1, z0, z1 = rect
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    for c in colors:
        mesh.materials.append(colour(c))
    bm = bmesh.new()
    y = PLINTH + 0.02
    nx, nz = max(1, round((x1 - x0) / tile)), max(1, round((z1 - z0) / tile))
    for i in range(nx):
        for j in range(nz):
            ax, bx = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            az, bz = z0 + (z1 - z0) * j / nz, z0 + (z1 - z0) * (j + 1) / nz
            for cx0, cx1, cz0, cz1 in outside_pit(ax, bx, az, bz):  # no floor over the pit
                corners = [(cx0, cz0), (cx1, cz0), (cx1, cz1), (cx0, cz1)]
                face = bm.faces.new([bm.verts.new(blender_xyz(px, y, pz)) for px, pz in corners])
                face.material_index = (i + j) % 2
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for face in mesh.polygons:
        if face.normal.z < 0:
            face.flip()
    return obj


def quad(coll, name, corners, color):
    """One flat face through four game (x, y, z) corners, facing up."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    mesh.materials.append(colour(color))
    mesh.from_pydata([blender_xyz(*c) for c in corners], [], [(0, 1, 2, 3)])
    if mesh.polygons[0].normal.z < 0:
        mesh.polygons[0].flip()
    return obj


def build_floors(coll):
    for name in ["sun", "echo", "great", "mirror", "entrance", "terrace"]:
        floor(coll, f"floor_{name}", ROOMS[name])


def build_pit(coll):
    """Stone sides all round: the west and south ones are ledges (floor from above, wall from
    below), the north and east ones carry the room's wall down (too tall to stand on, so no way
    round the edge to the island). The island in the middle is a pillar; the ramp in the south-east
    corner is the way out."""
    x0, x1, z0, z1 = PIT
    bottom, top, edge = PIT_FLOOR - 0.5, PLINTH, PIT_EDGE
    rx0 = PIT_RAMP[0]
    block("pitEdge", coll, x0=x0 - 0.6, x1=x0 + edge, z0=z0, z1=z1 + 0.6, bottom=bottom, top=top,
          color=STONE_DARK)
    block("pitEdge", coll, x0=x0, x1=rx0, z0=z1 - edge, z1=z1 + 0.6, bottom=bottom, top=top, color=STONE_DARK)
    for ex0, ex1, ez0, ez1 in [(x0, x1, z0, z0 + edge), (x1 - edge, x1, z0, PIT_RAMP[2])]:
        block("pitWall", coll, x0=ex0, x1=ex1, z0=ez0, z1=ez1, bottom=bottom, top=top, color=STONE_DARK,
              collider=None)
        block("pitWallCollider", coll, x0=ex0, x1=ex1, z0=ez0, z1=ez1, bottom=bottom, top=COLLIDER_TOP,
              color=STONE, invisible=True)
    ix, iz, radius = PIT_ISLAND
    cylinder("pitIsland", coll, x=ix, z=iz, radius=radius, bottom=bottom, top=top, color=STONE_DARK, sides=14)
    rx0, rx1, rz0, rz1 = PIT_RAMP
    quad(coll, "pitRamp", [(rx0, PIT_FLOOR + 0.03, rz0), (rx1, PIT_FLOOR + 0.03, rz0),
                           (rx1, PLINTH + 0.03, rz1), (rx0, PLINTH + 0.03, rz1)], STONE)
    block("pitFloor", coll, x0=x0, x1=x1, z0=z0, z1=z1, bottom=PIT_FLOOR - 0.2, top=PIT_FLOOR + 0.01,
          color=0x8A7A66, collider=None)


def dog_statue(coll, x, z, *, yaw=0, bottom=PLINTH, size=1.0):
    """A sitting stone dog on a pedestal, facing yaw (0: game +z, towards the dock)."""
    s = size
    block("statuePedestal", coll, x0=x - 0.8 * s, x1=x + 0.8 * s, z0=z - 0.8 * s, z1=z + 0.8 * s,
          bottom=bottom - 0.1, top=bottom + 1.2 * s, color=STONE_DARK)
    top = bottom + 1.2 * s
    fx, fz = math.sin(yaw), math.cos(yaw)
    parts = [
        (0, 0.55, -0.1, 0.5, (1, 1.2, 1.1)),  # body
        (0, 1.25, 0.25, 0.42, (1, 1, 1)),  # head
        (0, 1.15, 0.6, 0.2, (1, 0.8, 1.2)),  # snout
        (-0.3, 1.6, 0.15, 0.13, (0.8, 1.6, 0.6)),  # ears
        (0.3, 1.6, 0.15, 0.13, (0.8, 1.6, 0.6)),
        (-0.22, 0.2, 0.35, 0.16, (1, 1.4, 1)),  # front paws
        (0.22, 0.2, 0.35, 0.16, (1, 1.4, 1)),
    ]
    for sx, sy, sz, radius, scale in parts:
        px = x + (sx * math.cos(yaw) + sz * fx) * s
        pz = z + (-sx * math.sin(yaw) + sz * fz) * s
        ball("statue", coll, x=px, y=top + sy * s, z=pz, radius=radius * s, color=STONE, scale=scale)


def build_temple_details(coll):
    # the Echo Hall's high ledge (the chest is up there)
    block("echoLedge", coll, x0=-47.4, x1=-43, z0=-14, z1=-4, bottom=PLINTH - 0.1, top=PLINTH + 3, color=STONE_DARK)
    # the Garden Court's sun dais, with its chest on top
    block("gardenDais", coll, x0=-47.4, x1=-41, z0=16.6, z1=23, bottom=PLINTH - 0.1, top=PLINTH + 3, color=STONE_DARK)
    block("daisTrim", coll, x0=-47.4, x1=-40.9, z0=16.6, z1=23.1, bottom=PLINTH + 3, top=PLINTH + 3.15,
          color=TRIM, collider=None)
    # planters in the garden: in the way of the stone blocks (grid cells, see blocks.js)
    for x, z in [(-36, 30), (-32, 28), (-26, 34)]:
        block("planter", coll, x0=x - 0.95, x1=x + 0.95, z0=z - 0.95, z1=z + 0.95, bottom=PLINTH - 0.1,
              top=PLINTH + 0.9, color=0xB57B46)
        ball("planterBush", coll, x=x, y=PLINTH + 1.2, z=z, radius=0.95, color=0x4CB956, scale=(1, 0.7, 1))
    # the Entrance Hall's columns, and the Great Hall's
    for x, z in [(-9, 22), (9, 22), (-9, 31), (9, 31), (-9, -9), (9, -9), (-9, 9), (9, 9)]:
        cylinder("column", coll, x=x, z=z, radius=0.9, bottom=PLINTH - 0.1, top=PLINTH + 3.6, color=STONE)
        cylinder("columnCap", coll, x=x, z=z, radius=1.15, bottom=PLINTH + 3.6, top=PLINTH + 4,
                 color=TRIM, collider=None)
    # broken columns in the Sun Chamber and the Mirror Hall (good for hopping on)
    for x, z, tall in [(-12, -22, 1.4), (12, -22, 1.1), (-12, -30, 0.8), (19, -13, 1.2), (45, 13, 0.9)]:
        cylinder("brokenColumn", coll, x=x, z=z, radius=0.9, bottom=PLINTH - 0.1, top=PLINTH + tall, color=STONE)
    # a planter for the Stretchy bush in the Great Hall
    block("bushPlanter", coll, x0=10, x1=13, z0=-13, z1=-10, bottom=PLINTH - 0.1, top=PLINTH + 0.35,
          color=0xB57B46, collider=None)
    # stone dogs either side of the Great Door, and two big ones by the steps
    dog_statue(coll, -6, 42.6, yaw=0)
    dog_statue(coll, 6, 42.6, yaw=0)
    # the steps: stone treads over the terrain's staircase, and a low wall either side
    sx0, sx1, sz0, sz1 = STAIRS
    rise = (PLINTH - JUNGLE) / STEPS
    tread = (sz1 - sz0) / STEPS
    for i in range(STEPS):
        top = PLINTH - (i + 1) * rise
        block("step", coll, x0=sx0, x1=sx1, z0=sz0 + i * tread, z1=sz0 + (i + 1) * tread,
              bottom=top - 0.6, top=top + 0.02, color=STONE if i % 2 else STONE_DARK, collider=None)
    for x in (sx0 - 0.6, sx1 + 0.6):
        block("stairWall", coll, x0=x - 0.5, x1=x + 0.5, z0=sz0 - 0.5, z1=sz1, bottom=JUNGLE - 0.6,
              top=PLINTH + 0.6, color=STONE_DARK)
    # the Sun Chamber's round hole in the roof: a ring of roof stones up on four posts
    for x, z in [(-14, -51), (-8, -51), (-14, -45), (-8, -45)]:
        cylinder("roofPost", coll, x=x, z=z, radius=0.35, bottom=PLINTH, top=PLINTH + 6.5, color=STONE)
    block("roofFrame", coll, x0=-14.5, x1=-7.5, z0=-51.5, z1=-50.5, bottom=PLINTH + 6.5, top=PLINTH + 7,
          color=STONE, collider=None)
    block("roofFrame", coll, x0=-14.5, x1=-7.5, z0=-45.5, z1=-44.5, bottom=PLINTH + 6.5, top=PLINTH + 7,
          color=STONE, collider=None)
    # gold suns over the doorways
    for x, y, z in [(0, PLINTH + 5.3, 38.7), (0, PLINTH + 3.7, -15.3), (-15.3, PLINTH + 3.7, 0),
                    (15.3, PLINTH + 3.7, 0)]:
        ball("doorSun", coll, x=x, y=y, z=z, radius=0.7, color=TRIM, scale=(1, 1, 0.4) if abs(x) < 1 else (0.4, 1, 1))
    # vines growing over the outer walls (moss boxes)
    for x0, x1, z0, z1 in [(-30, -24, 37.2, 38.9), (20, 30, -55, -53.2), (-48.9, -47.2, -6, 6),
                           (47.2, 48.9, -10, -2), (-12, -6, 37.2, 38.9)]:
        block("moss", coll, x0=x0, x1=x1, z0=z0, z1=z1, bottom=PLINTH + 1, top=PLINTH + 4.3, color=MOSS,
              collider=None)


def build_outside(coll):
    # rocks to climb (a crayon on the big one), a rock in the pond
    L.marker("rock", 30, 50, coll, scale=(2.2, 2.2, 3.2), color="#a3acb8")
    L.marker("rock", -34, 64, coll, scale=(1.5, 1.5, 2.0), color="#9aa6b8")
    for x, z, r, h in [(-52, 20, 2.5, 1.5), (54, 30, 2, 1.2), (-40, -66, 3, 2), (42, -64, 2.4, 1.6),
                       (18, 74, 1.4, 0.9), (-20, 82, 1.2, 0.7)]:
        L.marker("rock", x, z, coll, scale=(r, r, h))
    for x, z in [(-20, 88), (24, 86), (-36, 80), (40, 76), (-56, 46), (58, 52), (-58, 64), (56, 66), (34, 88)]:
        L.marker("palm", x, z, coll)


def build_markers(coll):
    m = L.marker
    m("spawn", 6, 86, coll)
    m("dock", 8, 89, coll, length=12)
    for name, (x, z), radius in [
        ("Sunny Beach", (4, 86), 10),
        ("Base Camp", (-2, 67), 9),
        ("Jungle Pond", (-34, 64), 10),
        ("Temple Steps", (0, 46), 6),
        ("Entrance Hall", (0, 27), 9),
        ("Garden Court", (-32, 27), 11),
        ("Great Hall", (0, 0), 12),
        ("Echo Hall", (-32, 0), 13),
        ("Mirror Hall", (32, 0), 13),
        ("Sun Chamber", (0, -35), 14),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    sign = m("sign:Base Camp", 10, 75, coll)
    sign["arrows"] = "Temple Steps, Jungle Pond, Sunny Beach"
    sign = m("sign:Great Hall", 5, 12, coll, y=PLINTH)
    sign["arrows"] = "Garden Court, Echo Hall, Mirror Hall, Sun Chamber"

    # power fruit: Chop-Chop for the vines, Boing-Boing for high places, Stretchy for the hooks
    m("fruit:chop", -12, 54, coll)
    m("fruit:boing", 24, 58, coll)
    m("fruit:stretch", 11.5, -11.5, coll, y=PLINTH + 0.4)

    # the crayons (pickups): placed a little above what they sit on, the game snaps them down
    for x, z, y in [
        (0, 80, None),  # on the beach
        (30, 50, JUNGLE + 3.6),  # on the big rock (Boing-Boing)
        (-34, 64, 1.0),  # on the rock in the pond
        (12.5, 35, PLINTH),  # behind a column in the Entrance Hall
        (-13, -13, PLINTH),  # a corner of the Great Hall
        (-44, 35, PLINTH),  # among the garden's flowers
        (-45.5, 21.5, PLINTH + 3.3),  # on the sun dais
        (-46.5, -6, PLINTH + 3.3),  # on the Echo Hall's ledge
        (-31, -12, PLINTH),  # the middle of the Echo Hall
        (38.6, -6.6, PLINTH),  # on the island in the pit
        (-8, -52, PLINTH),  # behind the Sun Dog
        (20, -68, None),  # in the jungle behind the temple
    ]:
        m("pickup", x, z, coll, y=y)

    # ambient life
    for x, z in [(40, 52), (-52, -32), (50, -44), (-24, 72)]:
        m("birds", x, z, coll)
    for x, z in [(-38, 33), (-12, 60), (26, 70)]:
        m("butterflies", x, z, coll)
    m("fish", -34, 64, coll, y=-0.7)

    # named spots for src/islands/island8/ (world positions at the empty)
    spots = {
        # Base Camp and the school trip
        "camp": (-4, 67, None),
        "anne": (3, 65, None),
        "cleo": (5, 67.5, None),
        "boat": (-9, 92, None),
        # the way in
        "vines": (0, 38.8, PLINTH),
        "greatDoor": (0, 38, PLINTH),
        "doorPlateWest": (-3.8, 41.3, PLINTH),
        "doorPlateEast": (3.8, 41.3, PLINTH),
        "classroom": (-5, 11, PLINTH),
        "pots": (6, -5, PLINTH),
        # the Garden Court
        "tunnel": (-16, 33, PLINTH),
        "gardenGate": (-16, 24, PLINTH),
        "gatePlate": (-20, 30, PLINTH),
        "keyDig": (-44, 29, PLINTH),
        "blockStart": (-30, 32, PLINTH),
        "blockPlate": (-36, 26, PLINTH),
        "cleoPlate": (-28, 22, PLINTH),
        "daisSteps": (-38, 20, PLINTH),
        "gardenChest": (-44.5, 19.5, PLINTH + 3),
        # the Echo Hall
        "echoDoor": (-16, 0, PLINTH),
        "crystalA": (-21, -10, PLINTH),
        "crystalB": (-31, 11, PLINTH),
        "crystalC": (-43, 12, PLINTH),
        "gateBlue": (-26, 0, PLINTH),
        "gateRed": (-36, 9, PLINTH),
        "stepRed": (-41.6, -9, PLINTH),
        "pillarBlue": (-31, -6, PLINTH),
        "echoChest": (-45.5, -10, PLINTH + 3),
        # the Mirror Hall
        "mirrorDoor": (16, 0, PLINTH),
        "sunWindow": (47.4, 11, PLINTH),
        "mirror1": (25, 11, PLINTH),
        "mirror2": (25, -8, PLINTH),
        "mirror3": (37, -8, PLINTH),
        "shutter": (25, 5, PLINTH),
        "shutterPlate": (20.5, 6, PLINTH),
        "sunEye": (37, -15.4, PLINTH),
        "hookWest": (26.9, -3.5, PLINTH),
        "hookIsland": (35.3, -6.4, PLINTH),
        "mirrorChest": (37, -10.2, PLINTH),
        # the Sun Door and the Sun Chamber
        "sunDoor": (0, -16, PLINTH),
        "roofLight": (-11, -48, PLINTH),
        "sunMirrorA": (11, -48, PLINTH),
        "sunMirrorB": (11, -37, PLINTH),
        "sunDog": (0, -45, PLINTH),
        "pawWest": (-4, -31, PLINTH),
        "pawEast": (4, -31, PLINTH),
        "photo": (0, -27, PLINTH),
        "shipSpot": (13, 97, 0),
    }
    for name, (x, z, y) in spots.items():
        m(f"spot:{name}", x, z, coll, y=y)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS, color=0x6CCB5F)
    temple = collection("Temple")
    build_walls(temple)
    build_floors(temple)
    build_pit(temple)
    build_temple_details(temple)
    build_outside(collection("Outside"))
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
