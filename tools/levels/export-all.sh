#!/bin/sh
# Re-exports every levels/islandN.blend to src/islands/islandN/level.glb (see docs/levels.md).
# Set BLENDER to Blender's path if `blender` isn't on your PATH, e.g. on a Mac:
#   BLENDER=/Applications/Blender.app/Contents/MacOS/Blender npm run levels
set -e
for blend in levels/island*.blend; do
  "${BLENDER:-blender}" -b "$blend" --python tools/levels/export.py
done
