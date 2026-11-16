# Shared helpers for scripts that build levels in Blender (run with Blender's Python, see
# docs/levels.md). Positions are the GAME's island-local (x, y, z) with y up; Blender is z-up with
# -y towards the game's +z, so a game spot (x, y, z) is Blender (x, -z, y).
import bpy


def blender_xyz(x, y, z):
    return (x, -z, y)


def smoothstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


_materials = {}


def colour(hex_rgb):
    """A plain material; the game turns it into its own flat-shaded one."""
    if hex_rgb in _materials:
        return _materials[hex_rgb]
    mat = bpy.data.materials.new(f"#{hex_rgb:06x}")
    rgb = [srgb_to_linear(((hex_rgb >> s) & 255) / 255) for s in (16, 8, 0)]
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
    _materials[hex_rgb] = mat
    return mat


def collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def link(obj, coll):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


class Level:
    """Builds objects for one island, standing them on its height(x, z)."""

    def __init__(self, height):
        self.height = height

    def ground(self, coll, *, size, cuts, color=0x6CCB5F):
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=cuts, y_subdivisions=cuts, size=size)
        ground = bpy.context.object
        ground.name = "ground"
        for v in ground.data.vertices:
            v.co.z = self.height(v.co.x, -v.co.y)
        ground.data.materials.append(colour(color))
        # smooth: a flat-shaded mesh exports every face's corners separately (4x the file size)
        bpy.ops.object.shade_smooth()
        return link(ground, coll)

    def marker(self, name, x, z, coll, y=None, scale=None, **props):
        """An empty: its name says what it becomes in the game (docs/levels.md)."""
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "SPHERE" if scale else "PLAIN_AXES"
        empty.empty_display_size = 1 if scale else 0.8
        empty.location = blender_xyz(x, self.height(x, z) if y is None else y, z)
        if scale:
            empty.scale = scale
        for key, value in props.items():
            empty[key] = value
        coll.objects.link(empty)
        return empty

    def box(self, name, x, z, size, coll, color, *, bottom=None, collider="box", sink=0.3):
        """A box at (x, z), standing on the ground unless bottom is given; size = (x, y, z) widths."""
        bottom = self.height(x, z) - sink if bottom is None else bottom
        w, h, d = size
        bpy.ops.mesh.primitive_cube_add(size=1, location=blender_xyz(x, bottom + h / 2, z))
        obj = bpy.context.object
        obj.name = name
        obj.scale = (w, d, h)
        bpy.ops.object.transform_apply(scale=True)
        obj.data.materials.append(colour(color))
        if collider:
            obj["collider"] = collider
        return link(obj, coll)

    def cylinder(self, name, x, z, coll, *, radius, tall, color, bottom=None, collider="cyl",
                 sides=10, sink=0.3):
        bottom = self.height(x, z) - sink if bottom is None else bottom
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=sides, radius=radius, depth=tall, location=blender_xyz(x, bottom + tall / 2, z)
        )
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(colour(color))
        if collider:
            obj["collider"] = collider
        return link(obj, coll)

    def cone(self, name, x, z, coll, *, radius, tall, color, bottom, sides=10):
        bpy.ops.mesh.primitive_cone_add(
            vertices=sides, radius1=radius, depth=tall, location=blender_xyz(x, bottom + tall / 2, z)
        )
        obj = bpy.context.object
        obj.name = name
        obj.data.materials.append(colour(color))
        return link(obj, coll)
