# The model Library shared by the level-dressing scripts (dress_test_island.py, dress_island1.py):
# Quaternius models (levels/assets/quaternius, CC0) imported into a level's Library collection,
# scaled to the game and recoloured to its palette, and `place()` to put linked copies round the
# island. Run inside Blender (docs/levels.md).
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, "levels", "assets", "quaternius")

# model: how much to scale it so it fits a dog who is about 1.1 m tall
MODELS = {
    "Bags": 4,
    "Barrel": 5,
    "Bench_1": 3,
    "Boat": 6,
    "Bonfire_Lit": 4,
    "BushBerries_1": 1.2,
    "CommonTree_1": 2.4,
    "CommonTree_2": 2.4,
    "CommonTree_3": 2.4,
    "Crate": 6,
    "Flowers": 1.6,
    "Grass": 1.3,
    "Lifeboat": 3.5,
    "Lilypad": 1.4,
    "Plant_3": 1.3,
    "Rock_Moss_1": 2.2,
    "Rock_Moss_4": 2,
    "Tent": 0.2,
    "Tree1": 1.8,
    "TreeStump_Moss": 1.5,
    "Well": 2.4,
    "Willow_2": 2.6,
    "WoodLog_Moss": 1.5,
}

# Quaternius colours are muted; the game's are bright. Each original colour -> the game's.
PALETTE = {
    0x4B623E: 0x4CB956,  # leaves
    0x3A4C30: 0x3A9E48,  # dark leaves
    0x62433E: 0xA8723F,  # bark
    0x624226: 0xB57B46,  # wood
    0x4B321D: 0x8A5A32,  # dark wood
    0x4F5157: 0x7D8794,  # metal bands
    0x84765A: 0xE3CC96,  # sacking
    0x9A8A61: 0xE3CC96,
    0x636B76: 0x9AA3B0,  # stones
    0x757F84: 0xB3BCC6,
    0x7A7D87: 0xA3ACB8,  # rock (the game's rock grey)
    0xE7E7E7: 0xFFA63D,  # campfire flames
    0xA52831: 0xFF5A6E,  # berries
    0x78543B: 0xB57B46,  # rowing boat
    0x8D6446: 0xC48A54,
    0xD14850: 0xFF6B6B,  # lifeboat
    0x903137: 0xD9485A,
    0xD1B49B: 0xFFE0B5,
    0x494949: 0x5A6070,
    0x007B7C: 0xFF9FB2,  # flower petals: the game's pink
    0xA19155: 0xFFD84D,  # flower centres: the game's yellow
    0xA55582: 0xFF9FB2,  # water lily
    0x5F4B35: 0xF3E6C8,  # tent canvas, like the ship's sail
    0x524D32: 0xE0524A,
    0x3E3921: 0xC48A54,
    0x2D2D2D: 0x7A4A2A,
    0xBFD176: 0x9BE07A,  # light leaves
    0x7B5536: 0xA8723F,
    0x60281D: 0xE0524A,  # well roof
    0x62544F: 0x8A6A52,
    0x958078: 0xC9A27A,
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_of(rgba):
    r, g, b = (round(linear_to_srgb(c) * 255) for c in rgba[:3])
    return (r << 16) | (g << 8) | b


def recolour(material):
    """Swap a Quaternius colour for the game's (nearest palette entry, so slight drift still maps)."""
    bsdf = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
    if not bsdf:
        return
    base = bsdf.inputs["Base Color"]
    old = hex_of(base.default_value)

    def distance(key):
        return sum((((key >> s) & 255) - ((old >> s) & 255)) ** 2 for s in (16, 8, 0))

    nearest = min(PALETTE, key=distance)
    if distance(nearest) > 30**2:
        print(f"  keeping #{old:06x} in {material.name}")
        return
    new = PALETTE[nearest]
    rgb = [srgb_to_linear(((new >> s) & 255) / 255) for s in (16, 8, 0)]
    base.default_value = (*rgb, 1)
    material.diffuse_color = (*rgb, 1)
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = 0.85


def replace_collection(name):
    old = bpy.data.collections.get(name)
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def import_model(name, scale, library):
    """One mesh object per model: imported, joined, scaled, recoloured, in the Library."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, f"{name}.glb"))
    new = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in new if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    # bake each part's own transform (the files carry a scale on their parent node) before joining
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for obj in new:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    model = bpy.context.view_layer.objects.active
    model.name = name
    model.data.name = name
    model.location = (0, 0, 0)
    model.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # smooth in the file (corners shared, a much smaller .glb); the game draws it flat-shaded anyway
    bpy.ops.object.shade_smooth()
    for material in model.data.materials:
        recolour(material)
    for coll in list(model.users_collection):
        coll.objects.unlink(model)
    library.objects.link(model)
    model.asset_mark()
    return model


def ground_height(x, z):
    ground = bpy.data.objects["ground"]
    hit, location, _, _ = ground.ray_cast(Vector((x, -z, 200)), Vector((0, 0, -1)))
    return location.z if hit else 0


def place(name, x, z, *, into, yaw=0, y=None, collider=None, radius=None, sink=0.05, scale=1):
    """A linked copy of a Library model at game (x, z), standing on the ground (or at y), turned
    yaw degrees, in the collection `into`. collider/radius become custom properties (docs/levels.md);
    scale is on top of the Library's (a number, or (x, y, z) in Blender's axes)."""
    obj = bpy.data.objects[name].copy()  # shares the mesh, so the .glb stores it once
    height = ground_height(x, z) - sink if y is None else y
    obj.location = (x, -z, height)
    obj.rotation_euler = (0, 0, math.radians(yaw))
    if collider:
        obj["collider"] = collider
    if radius:
        obj["radius"] = radius
    obj.scale = scale if isinstance(scale, tuple) else (scale, scale, scale)
    into.objects.link(obj)
    return obj
