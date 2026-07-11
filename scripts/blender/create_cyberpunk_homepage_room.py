"""Build the modular cyberpunk homepage room in a fresh Blender file.

Coordinate convention in Blender:
    +X east, +Y north, +Z up.

The glTF exporter maps this to the homepage convention:
    +X east, -Z north, +Y up.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path("/Users/nnnnzs/project/react.nnnnzs.cn")
BLEND_PATH = PROJECT_ROOT / "assets/blender/cyberpunk-homepage-room.blend"
PREVIEW_PATH = (
    PROJECT_ROOT
    / "docs/plans/images/cyberpunk-homepage-layout/blender-room-preview-v1.png"
)
REFERENCE_PATH = (
    PROJECT_ROOT
    / "docs/plans/images/cyberpunk-homepage-layout/threejs-realtime-reference-v1.png"
)

ROOM_WIDTH = 7.2
ROOM_DEPTH = 7.3
ROOM_HEIGHT = 4.85


COLLECTION_NAMES = (
    "ARCHITECTURE",
    "WORKSTATION",
    "BOOKSHELF_ZONE",
    "LIVING_ZONE",
    "SLEEP_ZONE",
    "LIGHT_FIXTURES",
    "SCENE_LIGHTS",
    "COLLIDERS",
)

COLLECTIONS: dict[str, bpy.types.Collection] = {}
MATERIALS: dict[str, bpy.types.Material] = {}


def rgb(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    srgb = tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4))

    def to_linear(channel: float) -> float:
        if channel <= 0.04045:
            return channel / 12.92
        return ((channel + 0.055) / 1.055) ** 2.4

    return tuple(to_linear(channel) for channel in srgb) + (1.0,)


def reset_scene() -> None:
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    scene = bpy.context.scene
    scene.name = "CyberpunkHomepageRoom"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.engine = "BLENDER_EEVEE"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 64
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.85
    scene["coordinate_convention"] = "+X east, +Y north, +Z up"
    scene["threejs_mapping"] = "Blender (x,y,z) -> Three.js (x,z,-y)"
    scene["room_dimensions_m"] = [ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT]
    scene["reference_image"] = str(REFERENCE_PATH)
    scene["modeling_route"] = str(
        PROJECT_ROOT / "docs/plans/cyberpunk-blender-modeling-route.md"
    )

    world = bpy.data.worlds.new("World_CyberpunkRoom")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is None:
        background = world.node_tree.nodes.new("ShaderNodeBackground")
    output = world.node_tree.nodes.get("World Output")
    if output is None:
        output = world.node_tree.nodes.new("ShaderNodeOutputWorld")
    if not background.outputs["Background"].is_linked:
        world.node_tree.links.new(background.outputs["Background"], output.inputs["Surface"])
    background.inputs["Color"].default_value = rgb("#03040a")
    background.inputs["Strength"].default_value = 0.055
    scene.world = world

    for name in COLLECTION_NAMES:
        collection = bpy.data.collections.new(name)
        scene.collection.children.link(collection)
        COLLECTIONS[name] = collection


def make_material(
    name: str,
    color: str,
    *,
    roughness: float = 0.6,
    metallic: float = 0.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = rgb(color)
    # Blender localizes default node names, so looking them up by English labels
    # can create a second, disconnected shader. Build one deterministic graph.
    material.node_tree.nodes.clear()
    bsdf = material.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    output = material.node_tree.nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = rgb(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = rgb(emission)
        strength_input = bsdf.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = emission_strength
    MATERIALS[name] = material
    return material


def build_materials() -> None:
    make_material("M_Floor_DarkMetal", "#111724", roughness=0.58, metallic=0.34)
    make_material("M_Floor_Inlay", "#202b3c", roughness=0.48, metallic=0.48)
    make_material("M_Floor_Groove", "#05070d", roughness=0.9)
    make_material("M_Wall_Matte", "#0c101b", roughness=0.78, metallic=0.05)
    make_material("M_Wall_Panel", "#151b29", roughness=0.67, metallic=0.12)
    make_material("M_GraphiteMetal", "#202735", roughness=0.43, metallic=0.66)
    make_material("M_BlackMetal", "#090c12", roughness=0.38, metallic=0.75)
    make_material("M_DarkWood", "#2b1f22", roughness=0.62, metallic=0.03)
    make_material("M_Fabric_Charcoal", "#252936", roughness=0.93)
    make_material("M_Fabric_Secondary", "#35384a", roughness=0.9)
    make_material("M_Bedding_Navy", "#18223f", roughness=0.88)
    make_material("M_Bedding_Light", "#a8a2b4", roughness=0.95)
    make_material("M_Screen_Dark", "#06111b", roughness=0.2, metallic=0.22)
    make_material("M_Glass_Dark", "#12233a", roughness=0.12, metallic=0.2)
    make_material("M_Ceramic", "#434556", roughness=0.4)
    make_material("M_Plant_Green", "#174b32", roughness=0.82)
    make_material("M_Plant_Dark", "#0b2f25", roughness=0.86)
    make_material("M_Book_Blue", "#173a64", roughness=0.76)
    make_material("M_Book_Cyan", "#15546a", roughness=0.72)
    make_material("M_Book_Purple", "#4b2f65", roughness=0.76)
    make_material("M_Book_Magenta", "#6d244e", roughness=0.76)
    make_material("M_Book_Grey", "#3b4353", roughness=0.82)
    make_material(
        "M_Emit_Cyan", "#092934", roughness=0.26, emission="#25e6ff", emission_strength=9.0
    )
    make_material(
        "M_Emit_Magenta", "#351026", roughness=0.26, emission="#ff3fae", emission_strength=9.0
    )
    make_material(
        "M_Emit_Green", "#08291c", roughness=0.26, emission="#25f07a", emission_strength=7.0
    )
    make_material(
        "M_Emit_Warm", "#392510", roughness=0.3, emission="#ffb44f", emission_strength=6.0
    )


def move_to_collection(obj: bpy.types.Object, collection_name: str) -> None:
    collection = COLLECTIONS[collection_name]
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def parent_keep_world(obj: bpy.types.Object, parent: bpy.types.Object | None) -> None:
    if parent is None:
        return
    world_matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world_matrix


def root_empty(
    name: str,
    location: tuple[float, float, float],
    collection_name: str,
    *,
    interactive: bool = False,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.18
    obj.location = location
    obj["asset_root"] = True
    obj["interactive"] = interactive
    COLLECTIONS[collection_name].objects.link(obj)
    return obj


def box(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: str | None,
    collection_name: str,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.025,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(MATERIALS[material])
    if bevel > 0:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.3)
        modifier.segments = 2
    move_to_collection(obj, collection_name)
    parent_keep_world(obj, parent)
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: str,
    collection_name: str,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 24,
    bevel: float = 0.015,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.materials.append(MATERIALS[material])
    if bevel > 0:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    move_to_collection(obj, collection_name)
    parent_keep_world(obj, parent)
    return obj


def add_collider(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    collider = box(
        name,
        dimensions,
        location,
        None,
        "COLLIDERS",
        bevel=0,
        parent=parent,
    )
    collider.display_type = "WIRE"
    collider.hide_render = True
    collider["collider"] = True
    collider["raycast_target"] = True
    return collider


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    color: str,
    energy: float,
    size: float,
    *,
    shape: str = "RECTANGLE",
    size_y: float | None = None,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.color = rgb(color)[:3]
    data.energy = energy
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    COLLECTIONS["SCENE_LIGHTS"].objects.link(obj)
    return obj


def add_point_light(
    name: str,
    location: tuple[float, float, float],
    color: str,
    energy: float,
    radius: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = rgb(color)[:3]
    data.energy = energy
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    COLLECTIONS["SCENE_LIGHTS"].objects.link(obj)
    return obj


def add_camera() -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("Camera_HomepageOverview")
    camera = bpy.data.objects.new("Camera_HomepageOverview", camera_data)
    camera.location = (-5.8, -6.45, 4.7)
    target = Vector((0.25, 0.35, 1.25))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 35
    camera_data.sensor_width = 36
    camera_data.dof.use_dof = False
    COLLECTIONS["ARCHITECTURE"].objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def build_architecture() -> None:
    root = root_empty("room_root", (0.0, 0.0, 0.0), "ARCHITECTURE")
    box(
        "floor_base",
        (ROOM_WIDTH, ROOM_DEPTH, 0.12),
        (0.0, 0.0, -0.06),
        "M_Floor_DarkMetal",
        "ARCHITECTURE",
        bevel=0.01,
        parent=root,
    )

    tile_size_x = ROOM_WIDTH / 9
    tile_size_y = ROOM_DEPTH / 9
    for index in range(1, 9):
        x = -ROOM_WIDTH / 2 + index * tile_size_x
        box(
            f"floor_groove_x_{index:02d}",
            (0.018, ROOM_DEPTH - 0.08, 0.009),
            (x, 0.0, 0.003),
            "M_Floor_Groove",
            "ARCHITECTURE",
            bevel=0,
            parent=root,
        )
        y = -ROOM_DEPTH / 2 + index * tile_size_y
        box(
            f"floor_groove_y_{index:02d}",
            (ROOM_WIDTH - 0.08, 0.018, 0.009),
            (0.0, y, 0.003),
            "M_Floor_Groove",
            "ARCHITECTURE",
            bevel=0,
            parent=root,
        )

    box(
        "north_wall",
        (ROOM_WIDTH, 0.14, ROOM_HEIGHT),
        (0.0, ROOM_DEPTH / 2, ROOM_HEIGHT / 2),
        "M_Wall_Matte",
        "ARCHITECTURE",
        bevel=0.02,
        parent=root,
    )
    box(
        "east_wall",
        (0.14, ROOM_DEPTH, ROOM_HEIGHT),
        (ROOM_WIDTH / 2, 0.0, ROOM_HEIGHT / 2),
        "M_Wall_Matte",
        "ARCHITECTURE",
        bevel=0.02,
        parent=root,
    )

    for index, x in enumerate((-2.65, -1.65, -0.65, 0.55, 1.65, 2.65), start=1):
        box(
            f"north_wall_panel_trim_{index:02d}",
            (0.026, 0.025, ROOM_HEIGHT - 0.32),
            (x, ROOM_DEPTH / 2 - 0.081, ROOM_HEIGHT / 2),
            "M_Wall_Panel",
            "ARCHITECTURE",
            bevel=0.004,
            parent=root,
        )
    for index, y in enumerate((-2.7, -1.65, -0.55, 0.55, 1.65, 2.7), start=1):
        box(
            f"east_wall_panel_trim_{index:02d}",
            (0.025, 0.026, ROOM_HEIGHT - 0.32),
            (ROOM_WIDTH / 2 - 0.081, y, ROOM_HEIGHT / 2),
            "M_Wall_Panel",
            "ARCHITECTURE",
            bevel=0.004,
            parent=root,
        )

    box(
        "north_baseboard",
        (ROOM_WIDTH, 0.09, 0.18),
        (0.0, ROOM_DEPTH / 2 - 0.1, 0.09),
        "M_BlackMetal",
        "ARCHITECTURE",
        bevel=0.015,
        parent=root,
    )
    box(
        "east_baseboard",
        (0.09, ROOM_DEPTH, 0.18),
        (ROOM_WIDTH / 2 - 0.1, 0.0, 0.09),
        "M_BlackMetal",
        "ARCHITECTURE",
        bevel=0.015,
        parent=root,
    )
    box(
        "ceiling_beam_north",
        (ROOM_WIDTH, 0.34, 0.3),
        (0.0, ROOM_DEPTH / 2 - 0.18, ROOM_HEIGHT - 0.15),
        "M_BlackMetal",
        "ARCHITECTURE",
        bevel=0.025,
        parent=root,
    )
    box(
        "ceiling_beam_east",
        (0.34, ROOM_DEPTH, 0.3),
        (ROOM_WIDTH / 2 - 0.18, 0.0, ROOM_HEIGHT - 0.15),
        "M_BlackMetal",
        "ARCHITECTURE",
        bevel=0.025,
        parent=root,
    )


def build_workstation() -> None:
    desk_root = root_empty("desk_root", (-2.16, 2.08, 0.0), "WORKSTATION", interactive=True)
    box("desk_top", (2.78, 0.86, 0.09), (-2.16, 2.08, 0.79), "M_DarkWood", "WORKSTATION", bevel=0.04, parent=desk_root)
    for side, x in (("left", -3.22), ("right", -1.1)):
        box(f"desk_drawer_cabinet_{side}", (0.5, 0.7, 0.72), (x, 2.1, 0.36), "M_GraphiteMetal", "WORKSTATION", bevel=0.025, parent=desk_root)
        for drawer_index in range(3):
            box(
                f"desk_drawer_{side}_{drawer_index + 1:02d}",
                (0.41, 0.035, 0.17),
                (x, 1.733, 0.19 + drawer_index * 0.22),
                "M_BlackMetal",
                "WORKSTATION",
                bevel=0.012,
                parent=desk_root,
            )
            box(
                f"desk_handle_{side}_{drawer_index + 1:02d}",
                (0.13, 0.025, 0.018),
                (x, 1.708, 0.19 + drawer_index * 0.22),
                "M_Emit_Cyan" if drawer_index == 0 else "M_GraphiteMetal",
                "WORKSTATION",
                bevel=0.006,
                parent=desk_root,
            )
    box("desk_crossbar", (1.6, 0.08, 0.1), (-2.16, 2.39, 0.25), "M_BlackMetal", "WORKSTATION", bevel=0.018, parent=desk_root)
    add_collider("collider_desk", (2.8, 0.9, 0.82), (-2.16, 2.08, 0.41), desk_root)

    monitor_root = root_empty("monitor_group_root", (-2.16, 2.2, 0.0), "WORKSTATION", interactive=True)
    monitor_specs = (
        ("left", -2.98, 2.28, 1.23, -0.16, "M_Emit_Cyan"),
        ("center", -2.16, 2.34, 1.26, 0.0, "M_Emit_Magenta"),
        ("right", -1.34, 2.28, 1.23, 0.16, "M_Emit_Cyan"),
    )
    for label, x, y, z, yaw, accent in monitor_specs:
        box(f"monitor_{label}_frame", (0.8, 0.12, 0.58), (x, y, z), "M_BlackMetal", "WORKSTATION", rotation=(0, 0, yaw), bevel=0.035, parent=monitor_root)
        front_y = y - 0.067
        box(f"monitor_{label}_screen", (0.7, 0.018, 0.46), (x, front_y, z), "M_Screen_Dark", "WORKSTATION", rotation=(0, 0, yaw), bevel=0.018, parent=monitor_root)
        for line_index in range(4):
            width = 0.38 if line_index % 2 == 0 else 0.23
            line_x = x - 0.08 + (0.07 if line_index % 2 else 0)
            line_z = z + 0.14 - line_index * 0.09
            box(f"monitor_{label}_ui_line_{line_index + 1:02d}", (width, 0.012, 0.025), (line_x, front_y - 0.012, line_z), accent if line_index == 1 else "M_Emit_Cyan", "WORKSTATION", rotation=(0, 0, yaw), bevel=0.006, parent=monitor_root)
        box(f"monitor_{label}_stand", (0.07, 0.08, 0.28), (x, y + 0.01, 0.91), "M_GraphiteMetal", "WORKSTATION", bevel=0.018, parent=monitor_root)
        box(f"monitor_{label}_foot", (0.34, 0.24, 0.035), (x, y - 0.01, 0.82), "M_GraphiteMetal", "WORKSTATION", bevel=0.018, parent=monitor_root)

    keyboard_root = root_empty("keyboard_root", (-2.16, 1.76, 0.82), "WORKSTATION", interactive=True)
    box("keyboard_body", (0.69, 0.25, 0.045), (-2.16, 1.76, 0.83), "M_BlackMetal", "WORKSTATION", rotation=(math.radians(-3), 0, 0), bevel=0.018, parent=keyboard_root)
    for row in range(4):
        for column in range(11):
            key_material = "M_Emit_Cyan" if (row == 0 and column in (1, 7)) else "M_GraphiteMetal"
            box(
                f"key_{row + 1:02d}_{column + 1:02d}",
                (0.045, 0.04, 0.014),
                (-2.43 + column * 0.052, 1.675 + row * 0.052, 0.86),
                key_material,
                "WORKSTATION",
                bevel=0.005,
                parent=keyboard_root,
            )
    box("mouse", (0.09, 0.14, 0.045), (-1.57, 1.73, 0.85), "M_GraphiteMetal", "WORKSTATION", bevel=0.03, parent=keyboard_root)

    chair_root = root_empty("chair_root", (-2.1, 0.96, 0.0), "WORKSTATION", interactive=True)
    cylinder("chair_gas_lift", 0.055, 0.5, (-2.1, 0.96, 0.29), "M_BlackMetal", "WORKSTATION", parent=chair_root)
    cylinder("chair_hub", 0.12, 0.08, (-2.1, 0.96, 0.08), "M_GraphiteMetal", "WORKSTATION", parent=chair_root)
    for index in range(5):
        angle = math.radians(index * 72)
        end_x = -2.1 + math.cos(angle) * 0.31
        end_y = 0.96 + math.sin(angle) * 0.31
        box(f"chair_star_leg_{index + 1:02d}", (0.42, 0.055, 0.045), ((-2.1 + end_x) / 2, (-2.1 * 0 + 0.96 + end_y) / 2, 0.075), "M_BlackMetal", "WORKSTATION", rotation=(0, 0, angle), bevel=0.018, parent=chair_root)
        cylinder(f"chair_caster_{index + 1:02d}", 0.045, 0.045, (end_x, end_y, 0.045), "M_BlackMetal", "WORKSTATION", parent=chair_root)
    box("chair_seat", (0.58, 0.58, 0.16), (-2.1, 0.96, 0.62), "M_Fabric_Charcoal", "WORKSTATION", bevel=0.075, parent=chair_root)
    box("chair_back", (0.54, 0.16, 0.74), (-2.1, 0.67, 1.05), "M_Fabric_Charcoal", "WORKSTATION", rotation=(math.radians(-8), 0, 0), bevel=0.07, parent=chair_root)
    box("chair_headrest", (0.4, 0.14, 0.18), (-2.1, 0.61, 1.45), "M_Fabric_Secondary", "WORKSTATION", rotation=(math.radians(-8), 0, 0), bevel=0.06, parent=chair_root)
    for side, x in (("left", -2.43), ("right", -1.77)):
        box(f"chair_arm_{side}", (0.08, 0.42, 0.08), (x, 0.98, 0.86), "M_GraphiteMetal", "WORKSTATION", bevel=0.025, parent=chair_root)
    add_collider("collider_chair", (0.7, 0.8, 1.5), (-2.1, 0.94, 0.75), chair_root)

    server_root = root_empty("server_rack_root", (-0.42, 2.04, 0.0), "WORKSTATION", interactive=True)
    box("server_rack_shell", (0.6, 0.5, 1.86), (-0.42, 2.04, 0.93), "M_GraphiteMetal", "WORKSTATION", bevel=0.04, parent=server_root)
    box("server_rack_front_recess", (0.5, 0.03, 1.66), (-0.42, 1.773, 0.93), "M_BlackMetal", "WORKSTATION", bevel=0.02, parent=server_root)
    status_materials = ("M_Emit_Cyan", "M_Emit_Cyan", "M_Emit_Green", "M_Emit_Magenta")
    for index in range(8):
        z = 0.19 + index * 0.2
        box(f"server_drawer_{index + 1:02d}", (0.46, 0.055, 0.155), (-0.42, 1.744, z), "M_GraphiteMetal", "WORKSTATION", bevel=0.012, parent=server_root)
        box(f"server_vent_{index + 1:02d}", (0.24, 0.012, 0.035), (-0.47, 1.708, z), "M_BlackMetal", "WORKSTATION", bevel=0.003, parent=server_root)
        for led_index in range(2):
            box(
                f"server_led_{index + 1:02d}_{led_index + 1:02d}",
                (0.025, 0.012, 0.025),
                (-0.23 + led_index * 0.05, 1.705, z),
                status_materials[(index + led_index) % len(status_materials)],
                "WORKSTATION",
                bevel=0.005,
                parent=server_root,
            )
    add_collider("collider_server_rack", (0.62, 0.54, 1.88), (-0.42, 2.04, 0.94), server_root)

    mug_root = root_empty("desk_mug_root", (-1.18, 1.96, 0.0), "WORKSTATION")
    cylinder("desk_mug", 0.055, 0.1, (-1.18, 1.96, 0.88), "M_Ceramic", "WORKSTATION", parent=mug_root)
    cylinder("desk_mug_rim", 0.061, 0.014, (-1.18, 1.96, 0.935), "M_Emit_Cyan", "WORKSTATION", parent=mug_root)


def build_bookshelf_zone() -> None:
    root = root_empty("bookshelf_root", (3.32, 2.05, 0.0), "BOOKSHELF_ZONE", interactive=True)
    shelf_x = 3.28
    shelf_y = 2.05
    shelf_width_y = 2.25
    shelf_height = 2.55
    box("bookshelf_back", (0.12, shelf_width_y, shelf_height), (3.46, shelf_y, shelf_height / 2), "M_Wall_Panel", "BOOKSHELF_ZONE", bevel=0.025, parent=root)
    for side, y in (("south", shelf_y - shelf_width_y / 2), ("north", shelf_y + shelf_width_y / 2)):
        box(f"bookshelf_side_{side}", (0.38, 0.1, shelf_height), (shelf_x, y, shelf_height / 2), "M_GraphiteMetal", "BOOKSHELF_ZONE", bevel=0.025, parent=root)
    for level in range(6):
        z = 0.08 + level * 0.48
        box(f"bookshelf_shelf_{level + 1:02d}", (0.42, shelf_width_y, 0.09), (shelf_x, shelf_y, z), "M_GraphiteMetal", "BOOKSHELF_ZONE", bevel=0.018, parent=root)

    book_materials = ("M_Book_Blue", "M_Book_Cyan", "M_Book_Purple", "M_Book_Magenta", "M_Book_Grey")
    book_counter = 0
    for level in range(5):
        z_base = 0.15 + level * 0.48
        y_cursor = shelf_y - 0.95
        for item in range(7):
            book_counter += 1
            width = 0.11 + (item % 3) * 0.025
            height = 0.27 + ((item + level) % 3) * 0.035
            y_center = y_cursor + width / 2
            box(
                f"book_unit_{book_counter:02d}",
                (0.25, width, height),
                (3.045, y_center, z_base + height / 2),
                book_materials[(item + level) % len(book_materials)],
                "BOOKSHELF_ZONE",
                rotation=(0, 0, math.radians(-2 + ((item + level) % 3) * 2)),
                bevel=0.012,
                parent=root,
            )
            y_cursor += width + 0.035

    for index, z in enumerate((0.58, 1.54), start=1):
        box(f"bookshelf_task_light_{index:02d}", (0.025, 0.78, 0.045), (3.035, shelf_y - 0.2, z), "M_Emit_Cyan", "LIGHT_FIXTURES", bevel=0.01, parent=root)

    plant_root = root_empty("bookshelf_plant_root", (3.1, 2.1, 2.62), "BOOKSHELF_ZONE")
    box("plant_pot", (0.24, 0.24, 0.22), (3.05, 2.1, 2.69), "M_Ceramic", "BOOKSHELF_ZONE", bevel=0.035, parent=plant_root)
    for index in range(7):
        angle = math.radians(index * 51)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.16, location=(3.03 + math.cos(angle) * 0.11, 2.1 + math.sin(angle) * 0.11, 2.9 + (index % 3) * 0.06))
        leaf = bpy.context.view_layer.objects.active
        leaf.name = f"plant_leaf_{index + 1:02d}"
        leaf.scale = (0.35, 0.75, 1.5)
        leaf.rotation_euler = (math.radians(20), math.radians(-12 + index * 4), angle)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        leaf.data.materials.append(MATERIALS["M_Plant_Green" if index % 2 == 0 else "M_Plant_Dark"])
        move_to_collection(leaf, "BOOKSHELF_ZONE")
        parent_keep_world(leaf, plant_root)
    add_collider("collider_bookshelf", (0.52, 2.32, 2.6), (3.3, shelf_y, 1.3), root)


def build_living_zone() -> None:
    sofa_root = root_empty("sofa_root", (-0.48, -2.35, 0.0), "LIVING_ZONE", interactive=True)
    box("sofa_base", (2.3, 0.76, 0.34), (-0.48, -2.35, 0.27), "M_Fabric_Charcoal", "LIVING_ZONE", bevel=0.1, parent=sofa_root)
    box("sofa_backrest", (2.18, 0.24, 0.64), (-0.48, -2.65, 0.7), "M_Fabric_Charcoal", "LIVING_ZONE", rotation=(math.radians(-5), 0, 0), bevel=0.09, parent=sofa_root)
    for side, x in (("left", -1.53), ("right", 0.57)):
        box(f"sofa_armrest_{side}", (0.22, 0.76, 0.5), (x, -2.35, 0.48), "M_Fabric_Secondary", "LIVING_ZONE", bevel=0.085, parent=sofa_root)
    for label, x in (("left", -0.99), ("right", 0.03)):
        box(f"sofa_cushion_{label}", (0.92, 0.58, 0.2), (x, -2.28, 0.52), "M_Fabric_Secondary", "LIVING_ZONE", bevel=0.09, parent=sofa_root)
    for index, x in enumerate((-1.35, 0.39), start=1):
        for y_index, y in enumerate((-2.58, -2.12), start=1):
            cylinder(f"sofa_foot_{index:02d}_{y_index:02d}", 0.055, 0.18, (x, y, 0.09), "M_BlackMetal", "LIVING_ZONE", parent=sofa_root)
    add_collider("collider_sofa", (2.36, 0.86, 0.98), (-0.48, -2.39, 0.49), sofa_root)

    rug_root = root_empty("rug_root", (-0.25, -1.05, 0.0), "LIVING_ZONE")
    box("rug_surface", (2.7, 1.9, 0.035), (-0.25, -1.05, 0.03), "M_Bedding_Navy", "LIVING_ZONE", bevel=0.04, parent=rug_root)
    box("rug_border", (2.82, 2.02, 0.018), (-0.25, -1.05, 0.014), "M_Floor_Inlay", "LIVING_ZONE", bevel=0.035, parent=rug_root)

    table_root = root_empty("coffee_table_root", (-0.28, -1.18, 0.0), "LIVING_ZONE", interactive=True)
    box("coffee_table_top", (1.3, 0.7, 0.09), (-0.28, -1.18, 0.42), "M_DarkWood", "LIVING_ZONE", bevel=0.04, parent=table_root)
    box("coffee_table_lower_shelf", (1.12, 0.54, 0.055), (-0.28, -1.18, 0.18), "M_GraphiteMetal", "LIVING_ZONE", bevel=0.025, parent=table_root)
    for x_index, x in enumerate((-0.82, 0.26), start=1):
        for y_index, y in enumerate((-1.45, -0.91), start=1):
            box(f"coffee_table_leg_{x_index:02d}_{y_index:02d}", (0.08, 0.08, 0.36), (x, y, 0.22), "M_BlackMetal", "LIVING_ZONE", bevel=0.018, parent=table_root)
    box("coffee_table_book", (0.36, 0.24, 0.035), (-0.48, -1.14, 0.49), "M_Book_Magenta", "LIVING_ZONE", rotation=(0, 0, math.radians(8)), bevel=0.012, parent=table_root)
    cylinder("coffee_table_mug", 0.055, 0.1, (0.12, -1.11, 0.51), "M_Ceramic", "LIVING_ZONE", parent=table_root)

    terminal_root = root_empty("article_terminal_root", (-0.28, -0.25, 0.0), "LIVING_ZONE", interactive=True)
    box("article_terminal_base", (0.72, 0.58, 0.72), (-0.28, -0.25, 0.37), "M_GraphiteMetal", "LIVING_ZONE", bevel=0.055, parent=terminal_root)
    box("article_terminal_neck", (0.64, 0.42, 0.5), (-0.28, -0.16, 0.8), "M_BlackMetal", "LIVING_ZONE", rotation=(math.radians(-12), 0, 0), bevel=0.045, parent=terminal_root)
    box("article_terminal_frame", (0.72, 0.07, 0.82), (-0.28, -0.27, 1.06), "M_GraphiteMetal", "LIVING_ZONE", rotation=(math.radians(-12), 0, 0), bevel=0.04, parent=terminal_root)
    box("article_terminal_screen", (0.61, 0.018, 0.7), (-0.28, -0.311, 1.06), "M_Screen_Dark", "LIVING_ZONE", rotation=(math.radians(-12), 0, 0), bevel=0.018, parent=terminal_root)
    for index in range(5):
        box(f"article_terminal_ui_{index + 1:02d}", (0.34 if index % 2 == 0 else 0.22, 0.011, 0.035), (-0.36 + (0.07 if index % 2 else 0), -0.327, 1.27 - index * 0.11), "M_Emit_Cyan" if index != 1 else "M_Emit_Magenta", "LIGHT_FIXTURES", rotation=(math.radians(-12), 0, 0), bevel=0.006, parent=terminal_root)
    box("article_terminal_status", (0.58, 0.035, 0.055), (-0.28, -0.55, 0.13), "M_Emit_Green", "LIGHT_FIXTURES", bevel=0.012, parent=terminal_root)
    add_collider("collider_article_terminal", (0.8, 0.7, 1.55), (-0.28, -0.25, 0.78), terminal_root)


def build_sleep_zone() -> None:
    bed_root = root_empty("bed_root", (2.56, -0.66, 0.0), "SLEEP_ZONE", interactive=True)
    box("bed_frame", (1.9, 1.28, 0.24), (2.5, -0.66, 0.21), "M_DarkWood", "SLEEP_ZONE", bevel=0.06, parent=bed_root)
    box("bed_mattress", (1.72, 1.16, 0.25), (2.42, -0.66, 0.43), "M_Bedding_Light", "SLEEP_ZONE", bevel=0.09, parent=bed_root)
    box("bed_blanket", (1.05, 1.12, 0.18), (2.12, -0.66, 0.62), "M_Bedding_Navy", "SLEEP_ZONE", bevel=0.08, parent=bed_root)
    box("bed_headboard", (0.14, 1.35, 0.92), (3.43, -0.66, 0.61), "M_DarkWood", "SLEEP_ZONE", bevel=0.055, parent=bed_root)
    for label, y in (("north", -0.92), ("south", -0.4)):
        box(f"bed_pillow_{label}", (0.42, 0.43, 0.14), (3.05, y, 0.69), "M_Bedding_Light", "SLEEP_ZONE", rotation=(0, math.radians(-5), 0), bevel=0.075, parent=bed_root)
    for x_index, x in enumerate((1.7, 3.32), start=1):
        for y_index, y in enumerate((-1.16, -0.16), start=1):
            box(f"bed_foot_{x_index:02d}_{y_index:02d}", (0.11, 0.11, 0.2), (x, y, 0.1), "M_BlackMetal", "SLEEP_ZONE", bevel=0.018, parent=bed_root)
    add_collider("collider_bed", (2.0, 1.38, 1.0), (2.5, -0.66, 0.5), bed_root)

    nightstand_root = root_empty("nightstand_root", (3.05, 0.12, 0.0), "SLEEP_ZONE", interactive=True)
    box("nightstand_body", (0.48, 0.42, 0.55), (3.05, 0.12, 0.29), "M_DarkWood", "SLEEP_ZONE", bevel=0.045, parent=nightstand_root)
    for index in range(2):
        z = 0.22 + index * 0.22
        box(f"nightstand_drawer_{index + 1:02d}", (0.38, 0.035, 0.17), (3.05, -0.108, z), "M_GraphiteMetal", "SLEEP_ZONE", bevel=0.015, parent=nightstand_root)
        box(f"nightstand_handle_{index + 1:02d}", (0.12, 0.02, 0.018), (3.05, -0.134, z), "M_BlackMetal", "SLEEP_ZONE", bevel=0.006, parent=nightstand_root)
    box("bedside_lamp_base", (0.16, 0.16, 0.08), (3.05, 0.12, 0.61), "M_GraphiteMetal", "SLEEP_ZONE", bevel=0.03, parent=nightstand_root)
    box("bedside_lamp_diffuser", (0.12, 0.12, 0.18), (3.05, 0.12, 0.73), "M_Emit_Warm", "LIGHT_FIXTURES", bevel=0.035, parent=nightstand_root)

    wardrobe_root = root_empty("wardrobe_root", (3.32, -2.08, 0.0), "SLEEP_ZONE", interactive=True)
    box("wardrobe_shell", (0.5, 1.18, 2.28), (3.31, -2.08, 1.14), "M_GraphiteMetal", "SLEEP_ZONE", bevel=0.045, parent=wardrobe_root)
    for label, y in (("north", -1.79), ("south", -2.37)):
        box(f"wardrobe_door_{label}", (0.045, 0.53, 1.92), (3.035, y, 1.08), "M_Wall_Panel", "SLEEP_ZONE", bevel=0.025, parent=wardrobe_root)
        box(f"wardrobe_handle_{label}", (0.035, 0.035, 0.34), (3.002, y + (-0.19 if label == "north" else 0.19), 1.08), "M_BlackMetal", "SLEEP_ZONE", bevel=0.012, parent=wardrobe_root)
    box("wardrobe_status_light", (0.03, 0.72, 0.07), (3.0, -2.08, 2.1), "M_Emit_Cyan", "LIGHT_FIXTURES", bevel=0.015, parent=wardrobe_root)
    add_collider("collider_wardrobe", (0.58, 1.25, 2.34), (3.31, -2.08, 1.17), wardrobe_root)

    wall_art_root = root_empty("wall_art_root", (3.5, -0.65, 1.78), "SLEEP_ZONE")
    box("wall_art_frame", (0.06, 0.9, 0.72), (3.515, -0.65, 1.78), "M_BlackMetal", "SLEEP_ZONE", bevel=0.028, parent=wall_art_root)
    box("wall_art_panel", (0.025, 0.76, 0.58), (3.477, -0.65, 1.78), "M_Screen_Dark", "SLEEP_ZONE", bevel=0.018, parent=wall_art_root)
    box("wall_art_magenta", (0.015, 0.28, 0.22), (3.46, -0.84, 1.88), "M_Emit_Magenta", "LIGHT_FIXTURES", bevel=0.012, parent=wall_art_root)
    box("wall_art_cyan", (0.015, 0.3, 0.18), (3.46, -0.49, 1.68), "M_Emit_Cyan", "LIGHT_FIXTURES", bevel=0.012, parent=wall_art_root)


def build_light_fixtures_and_lights() -> None:
    box("work_area_cyan_fixture", (1.15, 0.12, 0.1), (-2.1, 3.48, 3.18), "M_Emit_Cyan", "LIGHT_FIXTURES", bevel=0.025)
    box("east_wall_magenta_fixture", (0.06, 1.15, 0.11), (3.49, -0.35, 2.95), "M_Emit_Magenta", "LIGHT_FIXTURES", bevel=0.025)
    box("bookshelf_cyan_fixture", (0.06, 0.95, 0.09), (3.48, 2.08, 3.02), "M_Emit_Cyan", "LIGHT_FIXTURES", bevel=0.02)

    add_area_light("Light_Global_Softbox", (-2.8, -3.0, 4.35), (0.2, 0.3, 1.0), "#5f7cae", 150, 4.0, shape="RECTANGLE", size_y=2.5)
    add_area_light("Light_Work_Cyan", (-2.1, 3.0, 3.35), (-2.1, 1.7, 0.8), "#38dfff", 210, 2.2, shape="RECTANGLE", size_y=1.2)
    add_area_light("Light_Bookshelf_Cyan", (3.0, 2.1, 3.25), (2.9, 2.05, 1.2), "#2cdfff", 105, 1.4, shape="RECTANGLE", size_y=1.0)
    add_area_light("Light_East_Magenta", (3.2, -0.5, 3.05), (2.25, -0.8, 1.25), "#ff3fae", 145, 1.8, shape="RECTANGLE", size_y=0.7)
    add_point_light("Light_Bedside_Warm", (3.0, 0.1, 0.95), "#ffb85a", 65, 0.32)
    add_point_light("Light_Terminal_Green", (-0.28, -0.45, 0.48), "#25f07a", 32, 0.28)


def configure_render_and_save() -> dict[str, object]:
    os.makedirs(BLEND_PATH.parent, exist_ok=True)
    os.makedirs(PREVIEW_PATH.parent, exist_ok=True)
    add_camera()
    scene = bpy.context.scene
    scene.render.filepath = str(PREVIEW_PATH)

    file_preferences = bpy.context.preferences.filepaths
    original_save_version = file_preferences.save_version
    file_preferences.save_version = 0
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
        bpy.ops.render.render(write_still=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    finally:
        file_preferences.save_version = original_save_version

    collection_counts = {
        name: len(collection.all_objects) for name, collection in COLLECTIONS.items()
    }
    roots = sorted(obj.name for obj in bpy.data.objects if obj.get("asset_root"))
    colliders = sorted(obj.name for obj in bpy.data.objects if obj.get("collider"))
    return {
        "status": "ok",
        "blend_path": str(BLEND_PATH),
        "preview_path": str(PREVIEW_PATH),
        "object_count": len(bpy.data.objects),
        "material_count": len(bpy.data.materials),
        "collection_counts": collection_counts,
        "asset_roots": roots,
        "colliders": colliders,
        "camera": scene.camera.name if scene.camera else None,
        "render_engine": scene.render.engine,
    }


def main() -> dict[str, object]:
    reset_scene()
    build_materials()
    build_architecture()
    build_workstation()
    build_bookshelf_zone()
    build_living_zone()
    build_sleep_zone()
    build_light_fixtures_and_lights()
    return configure_render_and_save()


BUILD_RESULT = main()
