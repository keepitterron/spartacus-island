# Builds levels/island3.blend: the grey-box of the bigger Mossy Paw Woods (Nov 2026, see
# docs/island3.md). Same story as before (climb the seed tree's vine, zip treetop to treetop, Mango
# fetches the flower, the bees trade it for the key, the gate lets the stream refill Wasabi's
# spring). The four big trees keep exactly the same places relative to each other (the zip lines
# and the hook are tuned to those distances); the island grows round them: a beach and a path up
# from the dock, Pinecone Hill and Mossy Hollow, six acorns.
# Markers only, plus a few rocks; the trees, vines, hive, gate, stream, flower tree and mushroom
# are built by src/islands/island3/index.js at the spots placed here. dress_island3.py dresses it.
# A one-off starting point: once someone edits the .blend by hand, don't re-run it (it OVERWRITES).
#
#   .bpy/bin/python tools/levels/make_island3.py
#
# Coordinates are the game's island-local (x, z), y up.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island3.blend")

GROUND_SIZE = 104
GROUND_CUTS = 120

SPAWN = (0, 33)
DOCK = (0, 39)  # 12 m towards +z
SHIP = (5.6, 54)
# the big trees, as on the old island: x, z, top (above the sea); only the seed tree is climbable
TREES = {
    "seed tree": (-2, 2, 10),
    "junction tree": (6, -6, 8.5),
    "hive tree": (-3, -13, 7),
    "acorn tree": (15, -12, 8),
}
SPRING = (-12, -4)  # Wasabi's spring
GATE = (-14, -17.5)  # the water gate (its reservoir is upstream, at -z)
# the stream bed, from just below the gate down past the spring to the beach (longer than before)
STREAM = [(-14, -15), (-12, -4), (-10, 6), (-9, 18), (-8, 30), (-7, 44)]
FLOWER_TREE = (-5, 9)  # the flower hangs from a branch over the stream, towards -x
MUSHROOM = (14, 6)
BUSHES = {"grow": (5, 12), "boing": (11, 1), "stretch": (9, -2)}
PINECONE_HILL = (28, -6)
HOLLOW = (-30, 8)  # Mossy Hollow: logs, stumps and a big mossy rock
HOLLOW_ROCK = (-33, 4, 1.8, 2.3)  # x, z, radius, height: a Boing-Boing jump reaches the top


def bump(x, z, cx, cz, height, sigma):
    return height * math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma))


def dist_to_segment(x, z, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(x - (ax + dx * t), z - (az + dz * t))


def dist_to_stream(x, z):
    return min(dist_to_segment(x, z, a, b) for a, b in zip(STREAM, STREAM[1:]))


def coast_radius(angle):
    return 44 + 2.5 * math.sin(angle * 5) + 2 * math.sin(angle * 3 + 2)


def height(x, z):
    r = math.hypot(x, z)
    h = 1.25 + 0.3 * math.sin(x * 0.35 + 1) * math.cos(z * 0.3) + 0.18 * math.sin(x * 0.8 + z * 0.7)
    h += bump(x, z, *PINECONE_HILL, 5.5, 7)
    h += bump(x, z, -6, -30, 2.2, 8)  # rising ground behind the gate
    # the stream bed and the spring, carved down as before
    stream = dist_to_stream(x, z)
    if stream < 2.2:
        h = lerp(0.5, h, smoothstep(1.1, 2.2, stream))
    spring = math.hypot(x - SPRING[0], z - SPRING[1])
    if spring < 4.6:
        h = lerp(0.45, h, smoothstep(3.2, 4.6, spring))
    coast = coast_radius(math.atan2(z, x))
    h = lerp(h, 0.35, smoothstep(coast - 6, coast - 2.5, r))
    return lerp(h, -4.6, smoothstep(coast, coast + 4, r))


L = Level(height)


def build_markers(coll):
    m = L.marker
    m("spawn", *SPAWN, coll)
    m("dock", *DOCK, coll, length=12)
    m("spot:ship", *SHIP, coll, y=0)
    m("spot:dock end", 0, DOCK[1] + 6, coll)
    for name, (x, z, top) in TREES.items():
        m(f"spot:{name}", x, z, coll, top=top)
    m("spot:spring", *SPRING, coll)
    m("spot:gate", *GATE, coll)
    for i, (x, z) in enumerate(STREAM):
        m(f"spot:stream {i + 1}", x, z, coll, y=0.5)
    m("spot:flower tree", *FLOWER_TREE, coll)
    m("spot:mushroom", *MUSHROOM, coll)
    for kind, (x, z) in BUSHES.items():
        m(f"fruit:{kind}", x, z, coll)
    # acorns: the seed tree, the acorn tree and the mushroom get theirs from the code; these are
    # Pinecone Hill's top, the big rock in Mossy Hollow, and one buried in the hollow
    m("pickup", *PINECONE_HILL, coll)
    hx, hz, hr, htall = HOLLOW_ROCK
    m("rock", hx, hz, coll, scale=(hr, hr, htall), color="#8f9aa6")
    m("pickup", hx, hz, coll, y=height(hx, hz) + htall + 0.3)
    m("dig", HOLLOW[0] + 3, HOLLOW[1] + 5, coll)
    # the places
    for name, (x, z), radius in [
        ("Mossy Landing", (0, 34), 11),
        ("Treetop Walk", (3, -4), 14),
        ("Wasabi's Spring", SPRING, 6),
        ("The Water Gate", (GATE[0], GATE[1] - 2), 7),
        ("Toadstool Glade", MUSHROOM, 7),
        ("Pinecone Hill", PINECONE_HILL, 9),
        ("Mossy Hollow", HOLLOW, 9),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    for name, (x, z), arrows in [
        ("Mossy Landing", (4, 29), "Treetop Walk, Wasabi's Spring, Pinecone Hill, Mossy Hollow"),
        ("Wasabi's Spring", (-7, -1), ""),
        ("The Water Gate", (-9, -15), ""),
        ("Pinecone Hill", (21, -2), ""),
        ("Mossy Hollow", (-23, 12), ""),
    ]:
        sign = m(f"sign:{name}", x, z, coll)
        sign.rotation_euler = (0, 0, math.atan2(0 - x, 8 - z))
        if arrows:
            sign["arrows"] = arrows
    # palms on the beach ring only (the middle is woods)
    for i in range(28):
        angle = i / 28 * math.tau + 0.05
        if abs(angle - math.pi / 2) < 0.28:
            continue
        r = coast_radius(angle) - 6 - (i % 2) * 2
        x, z = math.cos(angle) * r, math.sin(angle) * r
        if dist_to_stream(x, z) < 4:
            continue
        m("palm", x, z, coll)
    for x, z, radius, tall in [(20, 30, 1.1, 0.8), (-22, 28, 1.2, 0.9), (34, 14, 1.3, 1.0),
                               (-36, -12, 1.2, 0.9), (16, -30, 1.4, 1.1)]:
        L.marker("rock", x, z, coll, scale=(radius, radius, tall))
    m("ball", 4, 28, coll)
    for x, z in [(10, 30), (-26, 20), (26, -20)]:
        m("birds", x, z, coll)
    for x, z in [(5, 12), (-8, 14), (12, 0), (-6, -6), (-24, 4), (20, 12), (26, -10)]:
        m("butterflies", x, z, coll)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS)
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
