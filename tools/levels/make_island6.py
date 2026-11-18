# Builds levels/island6.blend: Cottoncrest Islets, the sky island, moved to Blender as it was
# (Nov 2026, see docs/island6.md). There's no ground: the clouds are the level, each a `cloud`
# marker (a sphere empty: its size is the radius, its height the cloud's flat top). Clouds the
# puzzles hang off are named (cloud:spawn, cloud:palace…); the island's code builds the palace,
# the tunnel walls, the crystal walls, the fence, the picnic and Leo's nest on them. Feathers are
# `pickup` markers, fruit bushes `fruit:` markers. dress_island6.py dresses it.
# A one-off: don't re-run once the .blend is edited by hand.
#
#   .bpy/bin/python tools/levels/make_island6.py
#
# Coordinates are the game's island-local (x, z), y up (0 is the spawn cloud's top).
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Level, collection  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, "levels", "island6.blend")

# clouds as (x, z, radius, top), as in the old code
NAMED = {
    "spawn": (0, 15, 7, 0),  # the ship moors alongside it
    "palace": (0, -56, 10, 7),
    "tunnel 1": (-23, -58, 7, 8),  # the Tickle Tunnels: a wall across each, a Mini-Me hole
    "tunnel 2": (-38, -62, 6, 9),
    "smash": (-46, -75, 6, 10),  # the Smash-Smash bush (and a Mini-Me one for the way back)
    "cracked": (-36, -92, 8, 12),  # the Crystal Wall to learn smashing
    "picnic": (-4, -112, 11, 14),  # inside the crystal fence: the cubby with the fork
}
PLAIN = [
    # the Windy Steps up to the palace, to learn floating
    (-3, 2, 3.5, 1), (3, -8, 3, 2.2), (-2, -18, 3, 3.5), (5, -27, 2.6, 4.5), (-1, -37, 3, 6),
    (-22, -103, 5, 13),  # the step to the picnic
    # the way back: level hops high above the palace, then one big drop onto it
    (-1, -97, 3, 15), (1, -86, 3, 15), (0, -76, 3, 15),
    # two little clouds off to the side, just for feathers
    (-11, -22, 2.5, 4), (13, -42, 2.5, 8),
]
FEATHERS = [(-11, -22, 4), (13, -42, 8), (-5, 19, 0), (-27, -61, 8), (-49, -73, 10), (-41, -97, 12),
            (1, -86, 15), (52, -99, 13)]
SMASH, PICNIC = NAMED["smash"], NAMED["picnic"]
BUSHES = [
    ("mini", -6, -50, NAMED["palace"][3]),
    ("smash", SMASH[0] - 1.5, SMASH[1] - 1, SMASH[3]),
    ("mini", SMASH[0] + 2.5, SMASH[1] + 1.5, SMASH[3]),
    ("mini", PICNIC[0] + 2.5, PICNIC[1] + 3, PICNIC[3]),
]

L = Level(lambda x, z: 0)


def cloud(name, x, z, radius, top, coll):
    empty = L.marker(name, x, z, coll, y=top, scale=(radius, radius, radius))
    empty.empty_display_type = "SPHERE"
    return empty


def build_markers(coll):
    m = L.marker
    for name, (x, z, radius, top) in NAMED.items():
        cloud(f"cloud:{name}", x, z, radius, top, coll)
    for x, z, radius, top in PLAIN:
        cloud("cloud", x, z, radius, top, coll)
    m("spawn", 0, 12, coll, y=0)
    m("spot:ship", 9, 16, coll, y=0)
    for x, z, y in FEATHERS:
        m("pickup", x, z, coll, y=y + 0.2)
    for kind, x, z, y in BUSHES:
        m(f"fruit:{kind}", x, z, coll, y=y + 0.2)
    for name, (x, z, top), radius in [
        ("Spawn Cloud", (0, 15, 0), 7),
        ("The Windy Steps", (0, -18, 3), 12),
        ("Lina's Palace", (0, -56, 7), 10),
        ("Tickle Tunnels", (-30, -60, 8), 11),
        ("The Crystal Wall", (-36, -92, 12), 8),
        ("Picnic in the Sky", (-4, -112, 14), 11),
    ]:
        place = m(f"place:{name}", x, z, coll, y=top)
        place.empty_display_type = "SPHERE"
        place.scale = (radius, radius, radius)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_markers(collection("Markers"))
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
