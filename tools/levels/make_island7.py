# Builds levels/island7.blend: Jamboree Island's terrain moved to Blender as it was (Nov 2026,
# see docs/island7.md): the nearly flat fairground, its beach ring, the cannon's mound and
# Bullseye Rock out at sea. Nothing about the layout changes (the rides and stalls are built by
# src/islands/island7/ at the places in layout.js); this adds the named places, a signpost and a
# beach ball for the skittles. dress_island7.py dresses it. A one-off: don't re-run once edited.
#
#   .bpy/bin/python tools/levels/make_island7.py
#
# Coordinates are the game's island-local (x, z), y up; the same height function as the old code.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, lerp, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island7.blend")

GROUND_SIZE = 224
GROUND_CUTS = 448  # half a metre apart, the same as the game's height grid (so nothing moves)
GROUND = 1.6
SHORE = 60
SEA_FLOOR = -4.6
MOUNDS = [(30, 38, 4.5, 1.4)]  # x, z, radius, height: the cannon stands on one
ISLET = (80, -20, 9, 1.5)  # Bullseye Rock: x, z, radius, height


def islet_height(x, z):
    ix, iz, radius, top = ISLET
    dist = math.hypot(x - ix, z - iz)
    h = lerp(top, 0.35, smoothstep(radius - 5, radius - 1.5, dist))
    return lerp(h, SEA_FLOOR, smoothstep(radius, radius + 2.5, dist))


def height(x, z):
    r = math.hypot(x, z)
    angle = math.atan2(z, x)
    shore = SHORE + 3 * math.sin(angle * 3 + 1) + 2 * math.sin(angle * 5)
    h = GROUND + 0.18 * math.sin(x * 0.21) * math.cos(z * 0.19)
    for mx, mz, radius, tall in MOUNDS:
        dist = math.hypot(x - mx, z - mz)
        h += tall * math.exp(-(dist * dist) / (2 * radius * radius))
    h = lerp(h, 0.35, smoothstep(shore - 6, shore - 2.5, r))
    h = lerp(h, SEA_FLOOR, smoothstep(shore, shore + 3, r))
    return max(h, islet_height(x, z))


L = Level(height)


def build_markers(coll):
    m = L.marker
    for name, (x, z), radius in [
        ("Welcome Arch", (0, 47), 8),
        ("The Plaza", (0, 18), 10),
        ("Jelly Jumps", (-32, 16), 10),
        ("Kaboom Cannon", (28, 37), 7),
        ("Bullseye Rock", (80, -20), 9),
        ("Secret Garden", (40, -4), 10),
        ("The Big Wheel", (-32, -26), 12),
        ("Loop-de-Woof", (20, -36), 9),
        ("The Big Top", (-6, -45), 10),
        ("Skittles Alley", (-6, -12), 6),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    sign = m("sign:The Plaza", 4, 24, coll)
    sign.rotation_euler = (0, 0, math.atan2(0 - 4, 50 - 24))  # facing the way in
    sign["arrows"] = "Jelly Jumps, Kaboom Cannon, The Big Wheel, Secret Garden, The Big Top"
    m("spot:skittles", -6, -12, coll)
    m("ball", -6, -5, coll)  # roll it into the skittles


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS, color=0x7ED56F)
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
