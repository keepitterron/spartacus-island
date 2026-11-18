# Exports a level from Blender to the .glb the game loads, with the settings the loader expects
# (custom properties on, y up, modifiers applied, no cameras or lights).
#
#   levels/islandN.blend  ->  src/islands/islandN/level.glb
#
# From a terminal (Blender in the background):
#   blender -b levels/island1.blend --python tools/levels/export.py
# Or inside Blender: Scripting tab, open this file, Run Script (save the .blend first).
import os
import re
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def output_path():
    blend = bpy.data.filepath
    match = re.search(r"island(\d+)\.blend$", blend)
    if not match:
        raise SystemExit(f"save the level as levels/islandN.blend first (got {blend!r})")
    return os.path.join(ROOT, "src", "islands", f"island{match.group(1)}", "level.glb")


# everything in the scene except the Library collection (a palette of models to copy from)
def select_level_objects():
    library = bpy.data.collections.get("Library")
    skip = set(library.all_objects) if library else set()
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj not in skip)


def main():
    path = output_path()
    select_level_objects()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_extras=True,  # custom properties: collider, length, look, color…
        export_yup=True,
        export_apply=True,  # apply modifiers (sculpt with a Subdivision or Displace and it still exports)
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_animations=False,
    )
    print(f"exported {path} ({os.path.getsize(path) // 1024} KB)")


main()
if bpy.app.background:
    sys.exit(0)
