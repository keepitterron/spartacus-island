# Builds levels/island4.blend: the bigger Bubbly Ocean sea floor (Nov 2026, see docs/island4.md).
# The puzzle in the middle stays exactly where it was (the seaweed lane, the octopus, the vent
# canyon, the high places, the crabs; positions in src/islands/island4/geo.js and index.js); the
# basin round it is wider (its walls start at 44 m from the middle, were 28 m) with new places to
# explore: the Sunken Boat, the Coral Garden and Starfish Flats. Ground and markers only;
# dress_island4.py dresses it. A one-off: don't re-run once the .blend is edited by hand.
#
#   .bpy/bin/python tools/levels/make_island4.py
#
# Coordinates are the game's island-local (x, z), y up. The sea floor is 20 m down.
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection, smoothstep  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island4.blend")

GROUND_SIZE = 124
GROUND_CUTS = 140
SEA_BED_Y = -20
WALL_FROM, WALL_TO = 44, 56  # the basin's walls rise 16 m between these distances

SUNKEN_BOAT = (-27, 4)
CORAL_GARDEN = (26, 14)
STARFISH_FLATS = (6, 32)


def height(x, z):
    """The rippled sea bed as before, curving up into the basin's walls further out."""
    r = math.hypot(x, z)
    return (
        SEA_BED_Y
        + 0.4 * math.sin(x * 0.3) * math.cos(z * 0.25)
        + 0.25 * math.sin(x * 0.7 + z * 0.5)
        + smoothstep(WALL_FROM, WALL_TO, r) * 16
    )


L = Level(height)


def build_markers(coll):
    m = L.marker
    for name, (x, z), radius in [
        ("Bubble Landing", (-6, 14), 8),
        ("Seaweed Lane", (-5, -9), 7),
        ("Octopus's Bed", (-12, -25), 6),
        ("Vent Canyon", (11, -11), 7),
        ("Sunken Boat", SUNKEN_BOAT, 9),
        ("Coral Garden", CORAL_GARDEN, 10),
        ("Starfish Flats", STARFISH_FLATS, 9),
    ]:
        place = m(f"place:{name}", x, z, coll)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)
    for name, (x, z) in [("Sunken Boat", (-20, 8)), ("Coral Garden", (19, 14)), ("Starfish Flats", (4, 25))]:
        sign = m(f"sign:{name}", x, z, coll)
        sign.rotation_euler = (0, 0, math.atan2(0 - x, 8 - z))
    # big boulders round the basin's edge, and a few out on the floor
    for i in range(14):
        angle = i / 14 * math.tau + 0.2
        r = WALL_FROM - 3 + (i % 3) * 2
        x, z = math.cos(angle) * r, math.sin(angle) * r
        L.marker("rock", x, z, coll, scale=(1.6 + (i % 3) * 0.6, 1.6 + (i % 3) * 0.6, 1.8 + (i % 4) * 0.7),
                 color="#8fa0b4")
    for x, z, radius, tall in [(-34, -14, 1.4, 1.6), (34, -8, 1.6, 2.0), (-14, 34, 1.3, 1.2),
                               (30, 28, 1.2, 1.4)]:
        L.marker("rock", x, z, coll, scale=(radius, radius, tall), color="#9fb3c6")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L.ground(collection("Ground"), size=GROUND_SIZE, cuts=GROUND_CUTS, color=0xE8D9A8)
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
