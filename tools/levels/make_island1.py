# Builds levels/island1.blend: the grey-box of the bigger Spartacus's Island, laid out from the
# map Claudio and Zoë marked up (see docs/island1.md). Plain shapes and markers only; the
# lighthouse, bridge, chest and lily pads are built by src/islands/island1/index.js at the spots
# placed here. A one-off starting point: once someone edits the .blend by hand, don't re-run it
# (it OVERWRITES the file).
#
#   blender -b --python tools/levels/make_island1.py
#
# Coordinates are the game's island-local (x, z), y up; island 1's centre is the world origin.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island1.blend")

GROUND_SIZE = 152  # metres across; the beach is about 64 from the centre
GROUND_CUTS = 170

# the places, from the map
SPAWN = (0, 50)
DOCK = (0, 57)  # the dock runs 11 m towards +z from here
BOAT = (-41.6, 45.9)  # the beached rowing boat; the gull sleeps on its mast
CRABS = (-34, 50)
AMETHYST = (-26, 57)
CAVE = (-3, 17.5)  # the middle of the cave floor; the mouth faces the beach (+z)
CAMP = (-41, -1)  # Chris's lost and found
FRUIT_ROCK = (34, 24)
LEDGES = [(40, 30, 3.5, 3.4), (44, 34, 2.6, 4.9), (46.5, 38.5, 2.0, 6.4)]  # x, z, radius, height
POND = (14, -4)
POND_RADIUS = 17
ISLET_RADIUS = 3.5
ISLET_TOP = 1.5  # higher than Spartacus can jump from the water (-0.55 + 1.84)
BRIDGE_Z = -4
BRIDGE_FROM, GAP_FROM, GAP_TO, BRIDGE_TO = -5, 1.5, 9.5, 11  # x along the bridge
SPRING = (24, -40)
CREEK = [(24, -40), (16, -28), (9, -18), (12, -10)]  # spring -> pond
OUTFLOW = [(30, -2), (44, 6), (72, 10)]  # pond -> east sea
HEADLAND = (-40, -35)  # the hill under the lighthouse
LIGHTHOUSE = (-41, -36)
RUINS = (-6, -48)
CHEST = (-6, -50)


def bump(x, z, cx, cz, height, sigma):
    return height * math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma))


def shore_radius(angle):
    return 64 + 4 * math.sin(angle * 3) + 2.5 * math.sin(angle * 5 + 1)


def dist_to_segment(x, z, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(x - (ax + dx * t), z - (az + dz * t))


def dist_to_line(x, z, points):
    return min(dist_to_segment(x, z, a, b) for a, b in zip(points, points[1:]))


def flatten(h, x, z, center, radius, level):
    return lerp(h, level, 1 - smoothstep(radius, radius + 5, math.hypot(x - center[0], z - center[1])))


def height(x, z):
    r = math.hypot(x, z)
    h = 1.2 + 0.35 * math.sin(x * 0.15) * math.cos(z * 0.13) + 0.2 * math.sin(x * 0.35 + z * 0.3)
    h += bump(x, z, *RUINS, 7, 11)
    h += bump(x, z, *HEADLAND, 7.5, 9)
    h += bump(x, z, 40, 30, 1.2, 10)
    h += bump(x, z, CAVE[0], CAVE[1] - 7, 4, 5)  # the hillside the cave is dug into
    h = flatten(h, x, z, (CAVE[0], CAVE[1] + 1), 4, 1.3)
    h = flatten(h, x, z, SPAWN, 9, 1.0)
    h = flatten(h, x, z, CAMP, 8, 1.2)
    # the creek: a wading-deep channel from the spring to the pond, and on to the sea
    creek = min(dist_to_line(x, z, CREEK), dist_to_line(x, z, OUTFLOW))
    h = lerp(-1.0, h, smoothstep(1.6, 4.2, creek))
    h = lerp(-1.2, h, smoothstep(3, 5, math.hypot(x - SPRING[0], z - SPRING[1])))
    # the pond, and its raised islet with steep sides
    pond = math.hypot(x - POND[0], z - POND[1])
    h = lerp(-2.2, h, smoothstep(POND_RADIUS - 2.5, POND_RADIUS, pond))
    h = lerp(ISLET_TOP, h, smoothstep(ISLET_RADIUS, ISLET_RADIUS + 0.7, pond))
    shore = shore_radius(math.atan2(z, x))
    h = lerp(h, 0.35, smoothstep(shore - 7, shore - 3, r))
    return lerp(h, -4.6, smoothstep(shore, shore + 4, r))


L = Level(height)

STONE = 0x9aa3b0
DARK_STONE = 0x6f7886
WOOD = 0xb57b46
REED = 0x5aa84a


def build_cave(coll):
    """Walls and a roof Spartacus walks under (the roof's bottom is above his head)."""
    cx, cz = CAVE
    floor = 1.3
    back, front = cz - 3.5, cz + 3.5
    L.box("cave back", cx, back, (8, 4.6, 1.2), coll, DARK_STONE, bottom=floor - 1)
    for side in (-1, 1):
        L.box("cave wall", cx + side * 3.6, cz, (1.2, 4.6, 7), coll, DARK_STONE, bottom=floor - 1)
    L.box("cave roof", cx, cz, (8.4, 1.6, 8.2), coll, STONE, bottom=floor + 2.5)
    # a big rock on top so it reads as a hill, not a hut
    L.cylinder("cave rock", cx, cz - 1, coll, radius=5, tall=2.4, color=STONE, bottom=floor + 4,
               collider="cyl", sides=7)


def build_grove(coll):
    for i, (x, z, radius, tall) in enumerate(LEDGES):
        L.cylinder(f"grove ledge {i + 1}", x, z, coll, radius=radius, tall=tall + 0.3,
                   color=0xc9a27a, sides=8)


def build_beach(coll):
    x, z = BOAT
    L.box("rowing boat", x, z, (1.8, 1.0, 4.2), coll, WOOD, sink=0.2)
    top = height(x, z) + 0.8
    L.cylinder("mast", x, z - 0.6, coll, radius=0.12, tall=3.4, color=0x7a4a2a, bottom=top,
               collider=None, sides=6)
    return top + 3.4


def build_camp(coll):
    x, z = CAMP
    L.box("tent", x - 5, z + 2, (3.2, 2.4, 3.4), coll, 0xe0524a)
    # the lost-and-found pile: boxes and barrels of other people's things
    for dx, dz, size, color in [(0, -3, (2, 1.2, 1.6), WOOD), (1.6, -3.4, (1.2, 0.9, 1.2), 0xd9b26f),
                                (-1.4, -2.6, (1.0, 1.6, 1.0), 0x8a5a32), (0.4, -2.8, (1.0, 0.8, 1.0), 0x7fb3d5)]:
        L.box("lost and found", x + dx, z + dz, size, coll, color, sink=0.1)
    L.box("sign", x + 3, z - 1, (1.6, 1.0, 0.15), coll, 0xf3e6c8, bottom=height(x + 3, z - 1) + 0.9,
          collider=None)
    L.cylinder("sign post", x + 3, z - 1, coll, radius=0.08, tall=1.3, color=0x7a4a2a, collider=None,
               sides=5)


def build_islet_reeds(coll):
    """Tall reeds all round the islet, with a gap where the bridge lands: the bridge is the only
    way in (Zoë: "there should be no other way to get here than fixing the bridge")."""
    px, pz = POND
    radius = ISLET_RADIUS + 0.9
    count = 30
    for i in range(count):
        angle = i / count * math.tau
        if abs(math.atan2(math.sin(angle - math.pi), math.cos(angle - math.pi))) < 0.36:
            continue  # the bridge comes in from the west
        x, z = px + math.cos(angle) * radius, pz + math.sin(angle) * radius
        L.cylinder("reed", x, z, coll, radius=0.32, tall=9.8, color=REED, bottom=-2.3, sides=5)


def build_ruins(coll):
    x, z = CHEST
    top = height(x, z)
    L.box("ruin wall", x, z - 6, (11, 2.6, 1), coll, STONE, bottom=top - 0.4)
    L.box("ruin wall", x - 6, z - 1, (1, 1.8, 8), coll, STONE, bottom=height(x - 6, z - 1) - 0.4)
    L.box("ruin wall", x + 5.5, z - 2, (1, 1.2, 4), coll, STONE, bottom=height(x + 5.5, z - 2) - 0.4)
    # an arch on the way up from the pond: walk through it
    for side in (-1, 1):
        L.box("arch pillar", x + side * 2.3, z + 7, (1, 3.6, 1), coll, STONE)
    L.box("arch top", x, z + 7, (5.6, 0.8, 1.2), coll, STONE, bottom=height(x, z + 7) + 2.9)


def build_scenery(coll):
    build_cave(coll)
    build_grove(coll)
    build_camp(coll)
    build_islet_reeds(coll)
    build_ruins(coll)
    return build_beach(coll)


def build_markers(coll, gull_top):
    m = L.marker
    m("spawn", *SPAWN, coll)
    m("dock", *DOCK, coll, length=11)
    m("spot:ship", 5.6, 72, coll, y=0)
    m("spot:gull", *BOAT, coll, y=gull_top)
    m("spot:crabs", *CRABS, coll)
    m("spot:amethyst", *AMETHYST, coll)
    m("spot:cave", *CAVE, coll, y=1.3)
    m("spot:lost and found", CAMP[0], CAMP[1] - 3, coll)
    m("spot:plank", CAMP[0] + 2.5, CAMP[1] + 0.2, coll)
    m("spot:pond", *POND, coll, radius=POND_RADIUS)
    m("spot:bridge start", BRIDGE_FROM, BRIDGE_Z, coll, y=ISLET_TOP)
    m("spot:gap start", GAP_FROM, BRIDGE_Z, coll, y=ISLET_TOP)
    m("spot:gap end", GAP_TO, BRIDGE_Z, coll, y=ISLET_TOP)
    m("spot:bridge end", BRIDGE_TO, BRIDGE_Z, coll, y=ISLET_TOP)
    m("spot:lighthouse", *LIGHTHOUSE, coll)
    m("spot:chest", *CHEST, coll)
    # the Boing-Boing fruit on a low rock at the grove's entrance
    m("rock", *FRUIT_ROCK, coll, scale=(1.1, 1.1, 1.15))
    m("fruit:boing", *FRUIT_ROCK, coll, y=height(*FRUIT_ROCK) + 1.3)
    # bones: on the trail, on the top ledge, in the cave, dug up by the spring (the lily pad
    # and lighthouse-rock bones are placed by the code, which builds those)
    m("pickup", 15.8, 36.2, coll)
    lx, lz, _, tall = LEDGES[-1]
    m("pickup", lx, lz, coll, y=height(lx, lz) + tall + 0.2)
    m("pickup", CAVE[0], CAVE[1] - 1, coll, y=1.5)
    m("dig", SPRING[0] + 1, SPRING[1] + 4, coll)
    m("key", POND[0] + 0.5, POND[1] - 0.5, coll, y=ISLET_TOP)
    m("boot", -18, 30, coll)
    # palms round the beach (not on the dock path or the boat), and a few inland
    for i in range(34):
        angle = i / 34 * math.tau + 0.05
        if abs(angle - math.pi / 2) < 0.22:
            continue
        r = shore_radius(angle) - 9 - (i % 3) * 2.5
        x, z = math.cos(angle) * r, math.sin(angle) * r
        if math.hypot(x - BOAT[0], z - BOAT[1]) < 5 or math.hypot(x - POND[0], z - POND[1]) < POND_RADIUS + 1:
            continue
        m("palm", x, z, coll)
    for x, z in [(-16, 34), (12, 46), (-28, 12), (26, 14), (-20, -20), (32, -20)]:
        m("palm", x, z, coll)
    for x, z, radius, tall in [(18, 52, 1.0, 0.7), (-22, 50, 1.3, 0.9), (52, 10, 1.4, 1.0),
                               (-52, 14, 1.2, 0.8), (30, -46, 1.5, 1.2)]:
        m("rock", x, z, coll, scale=(radius, radius, tall))
    for x, z in [(5, 44), (-7, 44)]:
        m("ball", x, z, coll)
    for x, z in [(-20, 40), (28, 40), (-30, -30), (40, -30)]:
        m("birds", x, z, coll)
    for x, z in [(-10, 32), (20, 22), (-24, -6), (-36, 10), (6, -36)]:
        m("butterflies", x, z, coll)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS)
    gull_top = build_scenery(collection("Scenery"))
    build_markers(collection("Markers"), gull_top)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
