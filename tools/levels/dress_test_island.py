# Dresses levels/island8.blend with Quaternius models (levels/assets/quaternius, CC0):
#   1. a Library collection with one copy of each model, scaled to the game and recoloured to its
#      palette, marked as Blender assets (drag them in from the Asset Browser, "Current File");
#   2. a Dressing collection with linked copies placed round the island in small groups.
# Re-runnable: it replaces both collections and leaves everything else in the .blend alone.
#
#   blender -b levels/island8.blend --python tools/levels/dress_test_island.py
#
# Positions are the game's island-local (x, z), as in make_test_island.py; heights come from
# casting a ray down onto the `ground` mesh, so they follow any sculpting done since.
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from library import MODELS, ground_height, import_model, replace_collection  # noqa: E402
from library import place as place_model  # noqa: E402


def place(name, x, z, **options):
    return place_model(name, x, z, into=DRESSING, **options)


def place_all():
    # the pirate camp by the landing beach: a tent, a campfire with benches, supplies by the dock
    place("Tent", -14, 49, yaw=-70, collider="box")
    place("Bonfire_Lit", -8.5, 51, collider="cyl")
    place("Bench_1", -8.5, 47.6, collider="box")
    place("Bench_1", -5.2, 51.5, yaw=90, collider="box")
    place("Barrel", 2.7, 57.6, collider="cyl")
    place("Barrel", 3.6, 56.5, yaw=40, collider="cyl")
    place("Bags", 3.8, 58.6, yaw=20)
    place("Crate", -2.9, 57.4, collider="box")
    place("Crate", -3.2, 56.2, yaw=90, collider="box")
    place("Crate", -2.9, 57.4, y=ground_height(-2.9, 57.4) + 0.9, yaw=15, collider="box")
    # boats pulled up on the sand
    place("Boat", -17, 61.5, yaw=35, collider="box")
    place("Lifeboat", 19, 59.5, yaw=-25, collider="box")
    # shade trees round the big hill, and by the fort
    for name, x, z, yaw in [
        ("CommonTree_1", -40, -30, 0),
        ("CommonTree_2", -11, -33, 70),
        ("CommonTree_3", -42, -8, 140),
        ("CommonTree_1", -12, -6, 200),
        ("CommonTree_2", -14, 38, 30),
        ("CommonTree_3", 36, 15, 100),
    ]:
        place(name, x, z, yaw=yaw, collider="cyl", radius=0.45)
    # a small grove in the open middle, on the way from the beach to the hill
    place("CommonTree_2", 4, -14, yaw=10, collider="cyl", radius=0.45)
    place("CommonTree_3", 9, -19, yaw=200, collider="cyl", radius=0.45)
    place("Tree1", 1, -21, yaw=80, collider="cyl", radius=0.35)
    place("TreeStump_Moss", 7, -11, yaw=40, collider="cyl")
    place("WoodLog_Moss", -1, -16, yaw=-20, collider="box")
    place("Tree1", -25, 11, yaw=20, collider="cyl", radius=0.35)
    place("Tree1", -51, 27, yaw=160, collider="cyl", radius=0.35)
    # the lagoon: willows on the shore, water lilies, reeds round the rim
    place("Willow_2", 17, -25, yaw=-30, collider="cyl", radius=0.5)
    place("Willow_2", 44, -5, yaw=110, collider="cyl", radius=0.5)
    for x, z, yaw in [(28, -12, 0), (35, -10, 50), (37, -22, 120), (27, -17, 200), (31, -20, 300)]:
        place("Lilypad", x, z, yaw=yaw, y=0.02)
    for x, z, yaw in [(21, -11, 0), (20, -20, 60), (43, -27, 120), (36, -31, 200)]:
        place("Grass", x, z, yaw=yaw)
    # a mossy glade on the little hill by the east beach
    place("TreeStump_Moss", 27, 22, collider="cyl")
    place("WoodLog_Moss", 32.5, 21, yaw=60, collider="box")
    place("Rock_Moss_4", 38, 25, yaw=30, collider="cyl")
    place("Rock_Moss_1", 25, 28, collider="cyl")
    place("BushBerries_1", 31, 32, yaw=10)
    place("Flowers", 29, 25.5)
    place("Flowers", 36, 28, yaw=90)
    # the fort: supplies inside, a well outside the gate
    place("Barrel", -33.2, 13.2, collider="cyl")
    place("Barrel", -33.4, 14.4, yaw=70, collider="cyl")
    place("Crate", -33, 22.6, yaw=10, collider="box")
    place("Bags", -41.5, 21.5, yaw=-30)
    place("Well", -28, 27, yaw=30, collider="cyl")
    # a bench by the summit flag, for the view
    place("Bench_1", -22, -16.5, yaw=-40, collider="box")
    # the lighthouse keeper's barrels
    place("Barrel", 2.5, -57.8, collider="cyl")
    place("Barrel", 3.4, -56.8, yaw=30, collider="cyl")
    place("Crate", 9.8, -61.2, yaw=20, collider="box")
    # a few bushes, flowers and plants along the way
    for x, z, yaw in [(-6, 36, 0), (18, 8, 80), (-48, -2, 160), (0, -30, 240), (-30, 46, 300)]:
        place("BushBerries_1", x, z, yaw=yaw)
    for x, z, yaw in [(-3, 40, 0), (5, 30, 70), (-20, 8, 140), (10, 0, 210), (-45, 40, 280), (26, -40, 330)]:
        place("Flowers", x, z, yaw=yaw)
    place("Plant_3", -10, 12, yaw=45)
    place("Plant_3", 15, 18, yaw=200)
    place("Rock_Moss_4", -55, 10, yaw=80, collider="cyl")
    place("Rock_Moss_1", 45, -35, yaw=10, collider="cyl")


def main():
    global DRESSING
    library = replace_collection("Library")
    DRESSING = replace_collection("Dressing")
    for name, scale in MODELS.items():
        import_model(name, scale, library)
    place_all()
    # the Library is a palette to copy from, not part of the island: keep it out of the scene
    # (export.py skips it too)
    bpy.context.view_layer.layer_collection.children["Library"].exclude = True
    bpy.ops.wm.save_mainfile()
    print(f"dressed {bpy.data.filepath}: {len(DRESSING.objects)} models placed")


main()
if bpy.app.background:
    sys.exit(0)
