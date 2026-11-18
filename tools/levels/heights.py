# Bakes a level's `ground` mesh into the height grid the game uses for terrain, and writes it as
# heights.bin next to level.glb, so the ground mesh itself needn't be in the download (it was
# half of island 1's level file). Same grid as world/level.js used to bake at load: half a metre
# apart, the top surface wins, island-local game coordinates.
#
# heights.bin, little-endian:
#   7 float32: minX, minZ, cell, cols, rows, low, high
#   cols * rows uint16, row by row (rows go along game +z): 65535 = no ground there, otherwise
#   low + value / 65534 * (high - low)
# Used by export.py; run inside Blender.
import math
import struct

import bpy
import numpy as np

CELL = 0.5  # m between grid points, as in world/level.js
NO_GROUND = 65535


def ground_objects():
    return [
        obj
        for obj in bpy.context.view_layer.objects
        if obj.type == "MESH" and obj.name.split(".")[0].strip().lower() == "ground"
    ]


# every ground triangle in game coordinates (Blender x, y, z is game x, -z, y), with modifiers applied
def ground_triangles(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    chunks = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        matrix = np.array(obj.matrix_world)
        verts = np.empty(len(mesh.vertices) * 3)
        mesh.vertices.foreach_get("co", verts)
        verts = verts.reshape(-1, 3)
        world = verts @ matrix[:3, :3].T + matrix[:3, 3]
        game = np.stack([world[:, 0], world[:, 2], -world[:, 1]], axis=1)  # x, height, z
        tris = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int64)
        mesh.loop_triangles.foreach_get("vertices", tris)
        chunks.append(game[tris.reshape(-1, 3)])
        evaluated.to_mesh_clear()
    return np.concatenate(chunks)


def bake(triangles, cell=CELL):
    xs, zs = triangles[:, :, 0], triangles[:, :, 2]
    min_x, min_z = math.floor(xs.min()), math.floor(zs.min())
    cols = math.ceil((xs.max() - min_x) / cell) + 1
    rows = math.ceil((zs.max() - min_z) / cell) + 1
    heights = np.full((rows, cols), -np.inf)
    edge = -1e-6  # points exactly on a shared edge belong to both triangles
    for (ax, ay, az), (bx, by, bz), (cx, cy, cz) in triangles:
        area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az)
        if abs(area) < 1e-9:
            continue
        col0 = max(0, math.ceil((min(ax, bx, cx) - min_x) / cell))
        col1 = min(cols - 1, math.floor((max(ax, bx, cx) - min_x) / cell))
        row0 = max(0, math.ceil((min(az, bz, cz) - min_z) / cell))
        row1 = min(rows - 1, math.floor((max(az, bz, cz) - min_z) / cell))
        if col0 > col1 or row0 > row1:
            continue
        x = min_x + np.arange(col0, col1 + 1) * cell
        z = min_z + np.arange(row0, row1 + 1) * cell
        gx, gz = np.meshgrid(x, z)
        wb = ((gx - ax) * (cz - az) - (cx - ax) * (gz - az)) / area
        wc = ((bx - ax) * (gz - az) - (gx - ax) * (bz - az)) / area
        wa = 1 - wb - wc
        inside = (wa >= edge) & (wb >= edge) & (wc >= edge)
        if not inside.any():
            continue
        h = np.where(inside, wa * ay + wb * by + wc * cy, -np.inf)
        block = heights[row0 : row1 + 1, col0 : col1 + 1]
        np.maximum(block, h, out=block)
    return {"min_x": min_x, "min_z": min_z, "cell": cell, "cols": cols, "rows": rows, "heights": heights}


def write(grid, path):
    heights = grid["heights"]
    known = np.isfinite(heights)
    low, high = float(heights[known].min()), float(heights[known].max())
    span = max(high - low, 1e-6)
    values = np.full(heights.shape, NO_GROUND, dtype="<u2")
    values[known] = np.round((heights[known] - low) / span * (NO_GROUND - 1)).astype("<u2")
    header = struct.pack(
        "<7f", grid["min_x"], grid["min_z"], grid["cell"], grid["cols"], grid["rows"], low, high
    )
    with open(path, "wb") as file:
        file.write(header)
        file.write(values.tobytes())


def export_heights(path):
    objects = ground_objects()
    if not objects:
        raise SystemExit('the level has no mesh named "ground"')
    grid = bake(ground_triangles(objects))
    write(grid, path)
    return objects, grid
