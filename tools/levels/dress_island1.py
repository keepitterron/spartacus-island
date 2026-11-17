# Dresses levels/island1.blend so it looks like real things, not grey boxes (docs/island1.md):
#   1. a Library collection with the Quaternius models (library.py) and a clump of reeds;
#   2. the grey-box shapes made invisible, keeping their colliders exactly as they were (so nothing
#      about playing changes), each with a "look" on top: lumpy stone for the cave, the ruins and
#      the grove's ledges, reeds round the islet, crates and a barrel for the lost-and-found pile,
#      a real rowing boat and tent;
#   3. a Dressing collection of models placed round each place.
# Re-runnable: it replaces the Library, Looks and Dressing collections and leaves the rest alone.
#
#   blender -b levels/island1.blend --python tools/levels/dress_island1.py
#
# Positions are the game's island-local (x, z), as in make_island1.py.
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import colour  # noqa: E402
from library import MODELS, ground_height, import_model, replace_collection  # noqa: E402
from library import place as place_model  # noqa: E402

REED = 0x5AA84A
REED_LIGHT = 0x7CC86A
CATTAIL = 0x8A5A32
MOSS = 0x7CC86A
SANDSTONE = 0xC9A27A
DRY = 0.3  # ground lower than this is sand at the water's edge or water: no land models there
placed_with_colliders = []  # (name, x, z), checked against the markers at the end


def place(name, x, z, **options):
    if options.get("y") is None and ground_height(x, z) < DRY and not options.get("wet"):
        print(f"  skipping {name} at ({x}, {z}): in the water")
        return None
    options.pop("wet", None)
    obj = place_model(name, x, z, into=DRESSING, **options)
    if options.get("collider"):
        placed_with_colliders.append((name, x, z))
    return obj


# ---------- looks over the grey boxes ----------


def grey_boxes(name):
    """The Scenery objects called `name` (Blender's .001 copies included)."""
    return [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] == name]


def hide(obj):
    """Keep it as an invisible collider (docs/levels.md: custom property invisible = 1)."""
    obj["invisible"] = 1
    obj.hide_viewport = False  # still shown in Blender, so it can be edited
    obj.display_type = "WIRE"


def lumpy(obj, *, strength=0.28, levels=2, colour_hex=None):
    """A lumpy stone copy of a box or cylinder: subdivided and pushed inwards by a noise texture,
    so it never sticks out of the collider (Displace with mid-level 1 only pushes in). The
    modifiers stay live in Blender; export.py applies them."""
    look = obj.copy()
    look.data = obj.data.copy()
    look.name = f"{obj.name.split('.')[0]} look"
    for key in list(look.keys()):
        del look[key]
    if colour_hex is not None:
        look.data.materials.clear()
        look.data.materials.append(colour(colour_hex))
    subdivide = look.modifiers.new("lumps", "SUBSURF")
    subdivide.subdivision_type = "SIMPLE"
    subdivide.levels = subdivide.render_levels = levels
    displace = look.modifiers.new("dents", "DISPLACE")
    displace.texture = noise_texture()
    displace.texture_coords = "GLOBAL"  # every stone gets different dents
    displace.mid_level = 1
    displace.strength = strength
    LOOKS.objects.link(look)
    look.display_type = "SOLID"
    return look


def noise_texture():
    texture = bpy.data.textures.get("stone dents") or bpy.data.textures.new("stone dents", "CLOUDS")
    texture.noise_scale = 0.9
    texture.noise_depth = 1
    return texture


def cap(obj, *, colour_hex=MOSS, inset=0.06, thick=0.14):
    """A flat mossy cap exactly at the top of a collider, so Spartacus stands on something that's
    really there (the lumpy stone under it is pushed in a little)."""
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    top = max(c.z for c in corners)
    xs, ys = [c.x for c in corners], [c.y for c in corners]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, d = max(xs) - min(xs), max(ys) - min(ys)
    round_top = abs(w - d) < 0.05 and len(obj.data.vertices) > 8
    if round_top:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8, radius=w / 2 - inset, depth=thick, location=(cx, cy, top - thick / 2)
        )
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, top - thick / 2))
        bpy.context.object.scale = (w - inset * 2, d - inset * 2, thick)
        bpy.ops.object.transform_apply(scale=True)
    moss = bpy.context.object
    moss.name = f"{obj.name.split('.')[0]} moss"
    moss.data.materials.append(colour(colour_hex))
    for coll in list(moss.users_collection):
        coll.objects.unlink(moss)
    LOOKS.objects.link(moss)
    return moss


def model_over(obj, name, *, fit=True, yaw=0):
    """A Library model standing in a grey box's place, stretched to fill its box exactly (so what
    stands on top of the box, like the toys on the lost-and-found pile, rests on the model)."""
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    model = bpy.data.objects[name]
    size = model.dimensions
    look = model.copy()
    look.name = f"{obj.name.split('.')[0]} look"
    look.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
    look.rotation_euler = (0, 0, math.radians(yaw))
    across = (hi.x - lo.x, hi.y - lo.y) if yaw % 180 == 0 else (hi.y - lo.y, hi.x - lo.x)
    if fit:
        look.scale = (across[0] / size.x, across[1] / size.y, (hi.z - lo.z) / size.z)
    LOOKS.objects.link(look)
    return look


# The cave as a rocky hill, not a stone hut: boulders over its sides and roof. Each is a lumpy
# squashed ball that stays clear of the hollow inside (6 m wide, 2.5 m high, from the back wall to
# the mouth) and of the mouth itself. Game (x, z); middle: its centre's height above the cave
# floor; radius; squash: how flattened it is (its half-height is radius * squash).
CAVE_FLOOR = 1.3
CAVE_BOULDERS = [
    (-8.8, 17.5, 2.0, 2.6, 0.85),  # either side, touching the ground
    (2.8, 17.5, 2.0, 2.6, 0.85),
    (-8.2, 21.6, 1.4, 1.9, 0.8),  # shoulders either side of the mouth
    (2.2, 21.6, 1.4, 1.9, 0.8),
    (-3, 17, 4.9, 3.6, 0.6),  # over the roof: their bottoms stay above the 2.5 m ceiling
    (-6.5, 13.5, 4.8, 3.0, 0.7),
    (1, 13.8, 4.6, 2.8, 0.7),
]


def cave_boulders():
    for i, (x, z, middle, radius, squash) in enumerate(CAVE_BOULDERS):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2, radius=radius, location=(x, -z, CAVE_FLOOR + middle)
        )
        boulder = bpy.context.object
        boulder.name = "cave boulder"
        boulder.scale = (1, 1, squash)
        boulder.rotation_euler = (0, 0, i * 1.3)
        boulder.data.materials.append(colour(0x8f99a6 if i % 2 else 0x9aa3b0))
        for coll in list(boulder.users_collection):
            coll.objects.unlink(boulder)
        LOOKS.objects.link(boulder)
        displace = boulder.modifiers.new("dents", "DISPLACE")
        displace.texture = noise_texture()
        displace.texture_coords = "GLOBAL"
        displace.mid_level = 1
        displace.strength = radius * 0.22
        boulder["collider"] = "cyl"


def make_reeds():
    """One clump of reeds for the Library: six tall stalks and two brown cattails, about 9.8 m
    from the pond bed (the islet's reed wall has to stay taller than a Boing-Boing jump)."""
    rng = random.Random(7)
    mesh = bpy.data.meshes.new("Reeds")
    bm = bmesh.new()
    materials = [colour(REED), colour(REED_LIGHT), colour(CATTAIL)]
    for i in range(6):
        angle, out = rng.uniform(0, math.tau), rng.uniform(0, 0.32)
        x, y = math.cos(angle) * out, math.sin(angle) * out
        tall = rng.uniform(8.6, 9.8)
        geom = bmesh.ops.create_cone(bm, segments=5, radius1=0.09, radius2=0.025, depth=tall)
        verts = geom["verts"]
        lean = Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 0))
        for v in verts:
            v.co += Vector((x, y, tall / 2)) + lean * (v.co.z + tall / 2)
        for face in {f for v in verts for f in v.link_faces}:
            face.material_index = i % 2
        if i < 2:
            head = bmesh.ops.create_cone(bm, segments=6, radius1=0.12, radius2=0.12, depth=0.7)
            for v in head["verts"]:
                v.co += Vector((x, y, tall - 1.1)) + lean * (tall - 1.1)
            for face in {f for v in head["verts"] for f in v.link_faces}:
                face.material_index = 2
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    reeds = bpy.data.objects.new("Reeds", mesh)
    LIBRARY.objects.link(reeds)
    reeds.asset_mark()
    return reeds


def dress_grey_boxes():
    # the cave, the ruins and the grove's ledges: lumpy stone, mossy where you stand
    for name in ("cave back", "cave wall", "cave roof"):
        for obj in grey_boxes(name):
            hide(obj)
            lumpy(obj, strength=0.45, levels=3)
    for name in ("ruin wall", "arch pillar", "arch top"):
        for obj in grey_boxes(name):
            hide(obj)
            lumpy(obj, levels=3 if max(obj.dimensions) > 6 else 2)
    for obj in grey_boxes("cave rock"):
        hide(obj)
        lumpy(obj, strength=0.5)
    cave_boulders()
    for obj in grey_boxes("ruin wall") + grey_boxes("arch top"):
        cap(obj, inset=0.08, thick=0.1)
    for i in (1, 2, 3):
        for obj in grey_boxes(f"grove ledge {i}"):
            hide(obj)
            lumpy(obj, strength=0.35, colour_hex=SANDSTONE)
            cap(obj)
    # the reed wall round the islet: a clump of real reeds at each reed
    for i, obj in enumerate(grey_boxes("reed")):
        hide(obj)
        clump = bpy.data.objects["Reeds"].copy()
        clump.name = "reeds look"
        bottom = min((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)
        clump.location = (*box_centre(obj), bottom)
        clump.rotation_euler = (0, 0, i * 2.4)
        clump.scale = (1.4, 1.4, 1)
        LOOKS.objects.link(clump)
    # Chris's lost and found: crates and a barrel exactly where the boxes were (toys sit on them)
    pile = sorted(grey_boxes("lost and found"), key=lambda o: o.name)
    for obj, model in zip(pile, ["Crate", "Crate", "Barrel", "Crate"]):
        hide(obj)
        model_over(obj, model)
    # the beached rowing boat (the gull's mast stays as it was)
    for obj in grey_boxes("rowing boat"):
        hide(obj)
        model_over(obj, "Boat", fit=False).scale = (1.05, 1.05, 1.05)
    # the tent: a real one, its collider round the model instead of the old box
    for obj in grey_boxes("tent"):
        hide(obj)
        obj["collider"] = ""  # the tent model below brings its own
        x, y = box_centre(obj)
        tent = place("Tent", x, -y, yaw=90, collider="box", scale=0.8)
        tent.name = "tent look"


def box_centre(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (min(c.x for c in corners) + max(c.x for c in corners)) / 2, (
        min(c.y for c in corners) + max(c.y for c in corners)
    ) / 2


# ---------- models round each place ----------


def dress_places():
    # Hallo Harbour: supplies by the dock, a lifeboat pulled up on the sand
    place("Barrel", 2.7, 55.4, collider="cyl")
    place("Barrel", 3.6, 54.5, yaw=40, collider="cyl")
    place("Crate", 2.6, 53.2, yaw=10, collider="box")
    place("Bags", 3.9, 56.4, yaw=20)
    place("Lifeboat", 13, 58, yaw=-25, collider="box")
    for x, z, yaw in [(-3, 41, 0), (8, 41, 90), (-12, 51, 200)]:
        place("Flowers", x, z, yaw=yaw)
    # Sleepy Gull Beach: a mossy log and rocks above the sand
    place("WoodLog_Moss", -47, 37, yaw=90, collider="box")
    place("Rock_Moss_1", -49.5, 42, yaw=30, collider="cyl")
    for x, z, yaw in [(-30, 40, 0), (-38, 40, 120), (-44, 33, 240)]:
        place("Grass", x, z, yaw=yaw)
    # Boing-Boing Grove: shade trees round the ledges, berries and flowers
    place("CommonTree_1", 51, 26, yaw=40, collider="cyl", radius=0.45)
    place("CommonTree_2", 30, 47, yaw=160, collider="cyl", radius=0.45)  # out of the camera's way
    place("BushBerries_1", 36, 19, yaw=10)
    place("BushBerries_1", 51, 37, yaw=200)
    for x, z, yaw in [(42.5, 25, 0), (36, 33, 90), (48, 31, 180)]:
        place("Flowers", x, z, yaw=yaw)
    # Growly Cave: bushes and plants at the foot of its boulders (cave_boulders)
    place("BushBerries_1", -11, 23.5, yaw=60)
    place("Plant_3", 5.6, 22.5, yaw=200)
    place("Plant_3", -12.5, 15.5, yaw=20)
    # Lost & Found Camp: a campfire with a bench, bags and a barrel by the pile
    place("Bonfire_Lit", -43.5, 4.8, collider="cyl")
    place("Bench_1", -46.5, 7.2, yaw=-30)
    place("Bags", -43.2, -6.5, yaw=-30)
    place("Barrel", -36.4, -4.2, yaw=15, collider="cyl")
    # Lily Pond: willows on the shore, water lilies, grass at the water's edge
    place("Willow_2", 31, -14, yaw=-30, collider="cyl", radius=0.5)
    place("Willow_2", -3, -14, yaw=110, collider="cyl", radius=0.5)
    for angle in (200, 225, 250, 290, 315, 340):
        a = math.radians(angle)
        place("Lilypad", 14 + math.cos(a) * 10.5, -4 + math.sin(a) * 10.5, yaw=angle, y=0.02, wet=True)
    for x, z, yaw in [(-1.5, 7, 0), (27, 6, 60), (30.5, 1, 120), (2, 10.5, 200), (-3, -8, 300)]:
        place("Grass", x, z, yaw=yaw, wet=True)
    # Ding-Dong Point: the keeper's barrels and a bench for the view (clear of the climbing rock)
    place("Barrel", -46, -31, collider="cyl")
    place("Crate", -45.6, -29.7, yaw=20, collider="box")
    place("Bench_1", -34, -43, yaw=-40)
    # Treasure Hill: fallen stones, an old stump, flowers between the walls
    place("Rock_Moss_4", -14.5, -49, yaw=80, collider="cyl")
    place("Rock_Moss_1", 2.5, -46.5, yaw=10, collider="cyl")
    place("TreeStump_Moss", -15, -43, yaw=30, collider="cyl")
    place("CommonTree_3", 5, -56, yaw=200, collider="cyl", radius=0.4)
    for x, z, yaw in [(-9.5, -46, 0), (-2.5, -47.5, 140)]:
        place("Flowers", x, z, yaw=yaw)
    # Bubbly Spring: a ring of mossy rocks round the pool (open where the creek leaves and by the
    # sand mound), plants and grass
    for angle, name in [(200, "Rock_Moss_4"), (245, "Rock_Moss_1"), (290, "Rock_Moss_4"), (335, "Rock_Moss_1")]:
        a = math.radians(angle)
        place(name, 24 + math.cos(a) * 5.8, -40 + math.sin(a) * 5.8, yaw=angle, collider="cyl")
    place("Plant_3", 30.5, -44, yaw=30)
    place("Grass", 19.5, -38, yaw=90, wet=True)
    # shade trees and bushes inland, away from the paths
    place("Tree1", -22, 36, yaw=20, collider="cyl", radius=0.35)
    place("CommonTree_1", 21, 27, yaw=200, collider="cyl", radius=0.45)
    place("CommonTree_2", -28, -14, yaw=70, collider="cyl", radius=0.45)
    place("Tree1", 40, -16, yaw=160, collider="cyl", radius=0.35)
    place("CommonTree_3", 4, -30, yaw=300, collider="cyl", radius=0.4)
    for x, z, yaw in [(-14, 8, 0), (12, 22, 80), (-30, 24, 160), (28, -30, 240)]:
        place("BushBerries_1", x, z, yaw=yaw)
    for x, z, yaw in [(6, 30, 0), (-8, -20, 70), (20, -50, 140), (-24, 0, 210)]:
        place("Flowers", x, z, yaw=yaw)


def check_markers():
    """Nothing solid too close to a marker (a bone, a dig, a spot the code builds at, a palm)."""
    markers = [o for o in bpy.data.objects if o.type == "EMPTY"]
    for name, x, z in placed_with_colliders:
        for m in markers:
            mx, mz = m.location.x, -m.location.y
            if math.hypot(mx - x, mz - z) < 2:
                print(f"  WARNING {name} at ({x}, {z}) is {math.hypot(mx - x, mz - z):.1f} m from {m.name}")


def main():
    global LIBRARY, LOOKS, DRESSING
    LIBRARY = replace_collection("Library")
    LOOKS = replace_collection("Looks")
    DRESSING = replace_collection("Dressing")
    for name, scale in MODELS.items():
        import_model(name, scale, LIBRARY)
    make_reeds()
    dress_grey_boxes()
    dress_places()
    check_markers()
    bpy.context.view_layer.layer_collection.children["Library"].exclude = True
    bpy.ops.wm.save_mainfile()
    print(f"dressed {bpy.data.filepath}: {len(LOOKS.objects)} looks, {len(DRESSING.objects)} models")


main()
if bpy.app.background:
    sys.exit(0)
