# Builds levels/island2.blend: the grey-box of the bigger Hook Rock Bay (Nov 2026, see
# docs/island2.md). Same story as before (Stretchy fruit, Mango stuck on the tallest pillar, his
# snack on a mesa only Boing-Boing reaches), with room round it: six places, six bones.
# Plain shapes and markers only; the swing pads, hooks, Mango's nest and the X are built by
# src/islands/island2/index.js at the spots placed here. dress_island2.py dresses it.
# A one-off starting point: once someone edits the .blend by hand, don't re-run it (it OVERWRITES).
#
#   .bpy/bin/python tools/levels/make_island2.py
#
# Coordinates are the game's island-local (x, z), y up.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island2.blend")

GROUND_SIZE = 116  # metres across; the beach is about 48 from the centre
GROUND_CUTS = 130

SPAWN = (0, 37)
DOCK = (0, 43)  # the dock runs 11 m towards +z from here
SHIP = (5.6, 58)
CAMP = (-11, 34)  # Ahoy Beach's campfire and the toys
GROVE = (-26, 16)  # Stretchy Grove
PRACTICE_PAD = (-31, 22)  # a swing pad and a low rock with a hook between: learn to swing on land
PRACTICE_ROCK = (-23, 13, 1.5, 3.0)  # x, z, radius, height above the ground
STRETCH_BUSH = (-25, 23)
MESA = (-34, -8)  # Cookie Mesa: only a Boing-Boing jump reaches the top
MESA_RADIUS, MESA_HEIGHT = 3.6, 4.4
BOING_BUSH = (-27, -3)
LAGOON = (4, -14)  # Hook Rock Lagoon: the pillars are placed round it exactly as before
LAGOON_RADIUS = 11
# pillars: offset from the lagoon's middle, radius, top (above the sea), as on the old island
PILLARS = {
    "first pillar": (-6, 0, 1.4, 3.2),
    "second pillar": (-1, -7, 1.3, 5.2),
    "mango pillar": (6, -3, 1.8, 11),
    "side pillar": (4, 6, 1.05, 6.6),
}
WEST_PAD = (LAGOON[0] - 13, LAGOON[1])
EAST_PAD = (LAGOON[0] + 13, LAGOON[1] + 2)
LOOKOUT = (23, -24)  # Lookout Hill
LOOKOUT_HEIGHT = 6.5
COVE = (37, 13)  # Crabby Cove: rock pools and a buried bone


def bump(x, z, cx, cz, height, sigma):
    return height * math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma))


def shore_radius(angle):
    return 48 + 3 * math.sin(angle * 3 + 0.4) + 2 * math.sin(angle * 5 + 1.3)


def flatten(h, x, z, center, radius, level):
    return lerp(h, level, 1 - smoothstep(radius, radius + 4, math.hypot(x - center[0], z - center[1])))


def height(x, z):
    r = math.hypot(x, z)
    h = 1.1 + 0.3 * math.sin(x * 0.18) * math.cos(z * 0.15) + 0.15 * math.sin(x * 0.4 - z * 0.3)
    h += bump(x, z, *LOOKOUT, LOOKOUT_HEIGHT, 8)
    h += bump(x, z, -38, -24, 2.5, 7)  # a rise behind the mesa
    h = flatten(h, x, z, SPAWN, 8, 1.0)
    h = flatten(h, x, z, CAMP, 5, 1.0)
    h = flatten(h, x, z, GROVE, 9, 1.2)
    # the lagoon, deep enough to paddle in, as on the old island
    lagoon = math.hypot(x - LAGOON[0], z - LAGOON[1])
    h = lerp(-2, h, smoothstep(LAGOON_RADIUS, LAGOON_RADIUS + 2, lagoon))
    # the cove: a sandy dip open to the sea, with two rock pools
    cove = math.hypot(x - COVE[0], z - COVE[1])
    h = lerp(h, 0.4, 1 - smoothstep(6, 11, cove))
    for px, pz in [(COVE[0] + 2, COVE[1] - 2), (COVE[0] - 2.5, COVE[1] + 2.5)]:
        h = lerp(-0.7, h, smoothstep(1.2, 2.2, math.hypot(x - px, z - pz)))
    shore = shore_radius(math.atan2(z, x))
    h = lerp(h, 0.35, smoothstep(shore - 6, shore - 2.5, r))
    return lerp(h, -4.6, smoothstep(shore, shore + 4, r))


L = Level(height)

STONE = "#9aa6b8"
SANDSTONE = "#c9a27a"


def rock_marker(name, x, z, coll, *, radius, top=None, tall=None, color=STONE):
    """A `rock` marker (the game builds it): top is above the sea, tall above the ground."""
    ground = height(x, z)
    tall = tall if tall is not None else top - ground - 0.1
    L.marker("rock", x, z, coll, scale=(radius, radius, tall), color=color)
    if name:  # a spot just above the top, so it lands on the rock
        L.marker(f"spot:{name}", x, z, coll, y=ground + tall + 0.4)
    return ground + tall


def build_scenery(coll):
    # the X's flag on Cookie Mesa: a red flag you can see from the beach
    mx, mz = MESA
    top = height(mx, mz) + MESA_HEIGHT
    L.cylinder("flag pole", mx + 1.8, mz - 1.2, coll, radius=0.08, tall=3.2, color=0x7a4a2a,
               bottom=top, collider=None, sides=6)
    L.box("flag", mx + 2.4, mz - 1.2, (1.1, 0.7, 0.06), coll, 0xF2545B, bottom=top + 2.3,
          collider=None)
    # Lookout Hill: a little stone cairn and a bench on the top
    lx, lz = LOOKOUT
    L.cylinder("cairn", lx - 2, lz - 1.5, coll, radius=0.7, tall=1.3, color=0x9AA6B8, sides=7)


def build_markers(coll):
    m = L.marker
    m("spawn", *SPAWN, coll)
    m("dock", *DOCK, coll, length=11)
    m("spot:ship", *SHIP, coll, y=0)
    m("spot:dock end", 0, DOCK[1] + 4, coll)  # past this on the dock, Mango flies to the ship
    m("spot:camp", *CAMP, coll)
    # Stretchy Grove: the fruit, and a practice swing from a pad to a low rock (a bone on top)
    m("fruit:stretch", *STRETCH_BUSH, coll)
    m("spot:practice pad", *PRACTICE_PAD, coll)
    px, pz, pr, ptall = PRACTICE_ROCK
    top = rock_marker("practice rock", px, pz, coll, radius=pr, tall=ptall)
    m("pickup", px, pz, coll, y=top + 0.2)
    # Cookie Mesa: Mango's snack under the X, a bone, the Boing-Boing bush at its foot
    mx, mz = MESA
    top = rock_marker("mesa", mx, mz, coll, radius=MESA_RADIUS, tall=MESA_HEIGHT, color=SANDSTONE)
    m("spot:snack", mx - 0.5, mz - 0.5, coll, y=top + 0.3)
    m("pickup", mx + 1.6, mz + 0.8, coll, y=top + 0.2)
    m("fruit:boing", *BOING_BUSH, coll)
    # Hook Rock Lagoon: the swing route, pads on the shore
    m("spot:lagoon", *LAGOON, coll, y=-2)
    m("spot:west pad", *WEST_PAD, coll)
    m("spot:east pad", *EAST_PAD, coll)
    for name, (dx, dz, radius, top) in PILLARS.items():
        rock_marker(name, LAGOON[0] + dx, LAGOON[1] + dz, coll, radius=radius, top=top)
    for name in ("second pillar", "side pillar"):  # a bone on each
        dx, dz, _, top = PILLARS[name]
        m("pickup", LAGOON[0] + dx, LAGOON[1] + dz, coll, y=top + 0.2)
    # Lookout Hill: a bone on the top
    lx, lz = LOOKOUT
    m("pickup", lx, lz, coll)
    # Crabby Cove: a buried bone
    m("dig", COVE[0] + 3, COVE[1] + 3, coll)
    m("spot:pool", COVE[0] + 2, COVE[1] - 2, coll, y=-0.05)
    m("spot:pool", COVE[0] - 2.5, COVE[1] + 2.5, coll, y=-0.05)
    # the places
    for name, (x, z), radius in [
        ("Ahoy Beach", (0, 36), 12),
        ("Stretchy Grove", GROVE, 10),
        ("Cookie Mesa", MESA, 9),
        ("Hook Rock Lagoon", LAGOON, 16),
        ("Lookout Hill", LOOKOUT, 10),
        ("Crabby Cove", COVE, 9),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    for name, (x, z), arrows in [
        ("Ahoy Beach", (5, 32), "Hook Rock Lagoon, Cookie Mesa, Stretchy Grove, Lookout Hill, Crabby Cove"),
        ("Stretchy Grove", (-19, 20), ""),
        ("Cookie Mesa", (-27, -9), ""),
        ("Lookout Hill", (17, -16), ""),
        ("Crabby Cove", (30, 18), ""),
    ]:
        sign = m(f"sign:{name}", x, z, coll)
        sign.rotation_euler = (0, 0, math.atan2(0 - x, 6 - z))  # facing the middle
        if arrows:
            sign["arrows"] = arrows
    # palms round the beach (not on the dock path or in the cove), and a few inland
    for i in range(30):
        angle = i / 30 * math.tau + 0.1
        if abs(angle - math.pi / 2) < 0.25:
            continue
        r = shore_radius(angle) - 7 - (i % 3) * 2.5
        x, z = math.cos(angle) * r, math.sin(angle) * r
        if math.hypot(x - COVE[0], z - COVE[1]) < 9 or math.hypot(x - MESA[0], z - MESA[1]) < 7:
            continue
        m("palm", x, z, coll)
    for x, z in [(-14, 22), (14, 26), (-12, -26), (18, 4), (-4, 8)]:
        m("palm", x, z, coll)
    for x, z, radius, tall in [(22, 34, 1.1, 0.8), (-38, 10, 1.3, 1.0), (40, -6, 1.2, 0.9),
                               (-8, -38, 1.4, 1.1), (12, 40, 0.9, 0.6)]:
        L.marker("rock", x, z, coll, scale=(radius, radius, tall))
    for x, z in [(6, 30), (-20, 30)]:
        m("ball", x, z, coll)
    for x, z in [(-20, 34), (30, 0), (-30, -24), (14, -34)]:
        m("birds", x, z, coll)
    for x, z in [(-24, 14), (10, 22), (-14, -10), (24, -18)]:
        m("butterflies", x, z, coll)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS)
    build_scenery(collection("Scenery"))
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
