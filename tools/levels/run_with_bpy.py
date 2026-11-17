# Runs a Blender level script without Blender installed, using Blender's Python module (bpy).
#
#   python3.13 -m venv .bpy && .bpy/bin/pip install bpy        (once; bpy 5.3 matches the .blends)
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island1.blend tools/levels/dress_island1.py
#   .bpy/bin/python tools/levels/run_with_bpy.py levels/island1.blend tools/levels/export.py
#
# Same as `blender -b <file.blend> --python <script.py>` (docs/levels.md).
import runpy
import sys

import bpy

blend, script, *rest = sys.argv[1:]
bpy.ops.wm.open_mainfile(filepath=blend)
sys.argv = [script, "--", *rest]
runpy.run_path(script, run_name="__main__")
