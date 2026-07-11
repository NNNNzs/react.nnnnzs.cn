import bpy
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

collection = bpy.data.collections.new('Sofa')
bpy.context.scene.collection.children.link(collection)

def mat(name, color, roughness=0.55):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf is None:
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    return m

fabric = mat('Warm Green Fabric', (0.12, 0.32, 0.22), 0.8)
wood = mat('Dark Walnut Feet', (0.12, 0.055, 0.025), 0.5)

def cube(name, loc, scale, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    for c in list(o.users_collection):
        c.objects.unlink(o)
    collection.objects.link(o)
    return o

cube('Sofa_Base', (0, 0.45, 0), (2.5, 0.85, 0.35), fabric, 0.16)
for x in (-1.55, 0, 1.55):
    cube(f'Seat_Cushion_{x:+.2f}', (x, 0.42, 0.46), (0.72, 0.72, 0.18), fabric, 0.14)
cube('Back_Cushion', (0, 1.05, 1.18), (2.35, 0.22, 0.7), fabric, 0.16)
for x in (-2.25, 2.25):
    cube(f'Armrest_{x:+.2f}', (x, 0.45, 0.9), (0.28, 0.88, 0.7), fabric, 0.14)
for x in (-2.0, 2.0):
    for y in (0.0, 0.85):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.11, depth=0.42, location=(x, y, -0.38))
        o = bpy.context.object
        o.name = f'Leg_{x:+.1f}_{y:.1f}'
        o.data.materials.append(wood)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)

bpy.context.scene.world.color = (0.025, 0.025, 0.025)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/codex-sofa.blend')
