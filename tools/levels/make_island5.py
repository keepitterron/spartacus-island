# Builds levels/island5.blend: Rainbow Reef's terrain moved to Blender as it was (Nov 2026, see
# docs/island5.md): the hub and four islets in a shallow lagoon, the sandbar to the kelp garden,
# the rock pools, the pond and Crab Cove's bay. Nothing about the layout changes (the islets'
# puzzles are built by src/islands/island5/ at the same places); this adds the named places and
# signposts. dress_island5.py dresses it. A one-off: don't re-run once the .blend is edited by hand.
#
#   .bpy/bin/python tools/levels/make_island5.py
#
# Coordinates are the game's island-local (x, z), y up; the same height function as the old code.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island5.blend")

GROUND_SIZE = 230
GROUND_CUTS = 460  # half a metre apart, the same as the game's height grid (so nothing moves)

# the ring of islands: x, z, radius, the top of its gentle hill
ISLETS = {
    "hub": (0, 0, 17, 2.2),
    "stack": (34, -40, 11, 1.6),  # orange: the tall sea stack
    "tide": (-40, -32, 13, 0.7),  # yellow: flat, with rock pools
    "cove": (-42, 30, 12, 2.8),  # red: a cliffy islet with a bay
    "kelp": (40, 32, 15, 1.3),  # blue: a garden ring around a pond
}
REEF_RADIUS = 78
LAGOON_DEPTH = -1.8
SANDBAR_DEPTH = -0.35
# dips carved into the land: x, z, radius, depth
HOLLOWS = [(-44, -30, 2.2, -0.7), (-37, -36, 2.4, -0.7), (-38, -26, 2, -0.7), (40, 32, 5, -1.6),
           (-50, 34, 5.5, LAGOON_DEPTH)]


def dist_to_segment(x, z, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    return math.hypot(x - (ax + dx * t), z - (az + dz * t))


def islet_height(islet, x, z):
    ix, iz, radius, top = islet
    dx, dz = x - ix, z - iz
    r = math.hypot(dx, dz)
    angle = math.atan2(dz, dx)
    shore = radius + math.sin(angle * 3 + ix) * 1.2 + math.sin(angle * 5 + iz)
    h = top * (1 - 0.6 * smoothstep(0, shore - 3, r))
    h += 0.25 * math.sin(x * 0.5) * math.cos(z * 0.45)
    h = lerp(h, 0.35, smoothstep(shore - 4, shore - 1.5, r))
    return lerp(h, -4, smoothstep(shore, shore + 2.5, r))


def height(x, z):
    r = math.hypot(x, z)
    h = lerp(LAGOON_DEPTH, -4.5, smoothstep(REEF_RADIUS, REEF_RADIUS + 12, r))
    h += 0.3 * math.sin(x * 0.13) * math.cos(z * 0.11)
    hub, kelp = ISLETS["hub"], ISLETS["kelp"]
    sandbar = dist_to_segment(x, z, hub[:2], kelp[:2])
    if sandbar < 3:
        h = max(h, lerp(SANDBAR_DEPTH, h, smoothstep(1.6, 3, sandbar)))
    for islet in ISLETS.values():
        h = max(h, islet_height(islet, x, z))
    for hx, hz, radius, depth in HOLLOWS:
        d = math.hypot(x - hx, z - hz)
        if d < radius + 1.5:
            h = min(h, lerp(depth, h, smoothstep(radius, radius + 1.5, d)))
    return h


L = Level(height)


def build_markers(coll):
    m = L.marker
    for name, (x, z), radius in [
        ("Unicorn's Arch", (0, -2), 12),
        ("Crab Cove", (-42, 30), 12),
        ("The Sea Stack", (34, -40), 11),
        ("Moon Rock Pools", (-40, -32), 13),
        ("Kelp Garden", (40, 32), 15),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    # the hub's signpost points at every islet, by the path up from the dock
    sign = m("sign:Unicorn's Arch", -3.5, 8, coll)
    sign.rotation_euler = (0, 0, math.atan2(0 - -3.5, 0 - 8))
    sign["arrows"] = "Crab Cove, The Sea Stack, Moon Rock Pools, Kelp Garden"


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS, color=0x7FD36A)
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
