"""Render matching night and day previews from the saved homepage room."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path("/Users/nnnnzs/project/react.nnnnzs.cn")
PREVIEW_DIR = PROJECT_ROOT / "docs/plans/images/cyberpunk-homepage-layout"
DAY_PATH = PREVIEW_DIR / "blender-room-preview-v1.png"
NIGHT_PATH = PREVIEW_DIR / "blender-room-preview-night-v1.png"

DAY_MATERIAL_COLORS = {
    "M_Wall_Matte": "#d9dde2",
    "M_Wall_Panel": "#cbd1d9",
    "M_Floor_DarkMetal": "#8b6845",
    "M_Floor_Groove": "#6e5139",
    "M_Floor_Inlay": "#a47a50",
    "M_GraphiteMetal": "#3d424b",
    "M_BlackMetal": "#181b22",
    "M_DarkWood": "#c89b6a",
    "M_Fabric_Charcoal": "#b9ad9d",
    "M_Fabric_Secondary": "#d8cdbc",
    "M_Bedding_Navy": "#d9c7b4",
    "M_Bedding_Light": "#f5ede0",
    "M_Ceramic": "#e3e0d8",
    "M_Plant_Green": "#4f7657",
    "M_Plant_Dark": "#335640",
}


def linear_rgba(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]

    def linear(channel: float) -> float:
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    return tuple(linear(channel) for channel in channels) + (1.0,)


def principled(material: bpy.types.Material) -> bpy.types.Node | None:
    if not material.use_nodes or not material.node_tree:
        return None
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


def set_day_materials() -> None:
    for name, color in DAY_MATERIAL_COLORS.items():
        material = bpy.data.materials.get(name)
        if not material:
            continue
        rgba = linear_rgba(color)
        material.diffuse_color = rgba
        shader = principled(material)
        if shader:
            shader.inputs["Base Color"].default_value = rgba
            shader.inputs["Metallic"].default_value *= 0.48
            shader.inputs["Roughness"].default_value = min(1.0, shader.inputs["Roughness"].default_value + 0.12)

    for material in bpy.data.materials:
        if not material.name.startswith("M_Emit_"):
            continue
        shader = principled(material)
        if shader and shader.inputs.get("Emission Strength"):
            shader.inputs["Emission Strength"].default_value *= 0.18


def aim_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location: tuple[float, float, float], target: tuple[float, float, float], energy: float, color: str, size: float) -> bpy.types.Object:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = linear_rgba(color)[:3]
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    aim_at(obj, target)
    return obj


def add_sun() -> bpy.types.Object:
    data = bpy.data.lights.new(name="PreviewDay_Sun", type="SUN")
    data.energy = 2.2
    data.color = linear_rgba("#fff0d2")[:3]
    data.angle = math.radians(18)
    obj = bpy.data.objects.new("PreviewDay_Sun", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(32), math.radians(-28), math.radians(-38))
    return obj


def configure_day_scene() -> None:
    scene = bpy.context.scene
    scene.view_settings.exposure = 0.55
    if scene.world and scene.world.use_nodes:
        background = next((node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND"), None)
        if background:
            background.inputs["Color"].default_value = linear_rgba("#d9e8f2")
            background.inputs["Strength"].default_value = 0.42

    light_settings = {
        "Light_Global_Softbox": (720, "#fff1d2"),
        "Light_Work_Cyan": (260, "#d9f3ff"),
        "Light_Bookshelf_Cyan": (210, "#e1f6ff"),
        "Light_East_Magenta": (180, "#ffe1ea"),
        "Light_Bedside_Warm": (95, "#ffd698"),
        "Light_Terminal_Green": (42, "#c9ffe0"),
    }
    for name, (energy, color) in light_settings.items():
        obj = bpy.data.objects.get(name)
        if obj and obj.type == "LIGHT":
            obj.data.energy = energy
            obj.data.color = linear_rgba(color)[:3]

    add_area("PreviewDay_Window", (-3.8, -4.6, 5.8), (0.0, 0.2, 1.0), 1100, "#fff0ce", 4.5)
    add_area("PreviewDay_Fill", (4.2, -1.8, 4.6), (0.4, 0.2, 1.1), 680, "#d9edff", 4.0)
    add_sun()
    set_day_materials()


def render(path: Path) -> None:
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def main() -> dict[str, object]:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    render(NIGHT_PATH)
    configure_day_scene()
    render(DAY_PATH)
    return {
        "status": "ok",
        "day_preview": str(DAY_PATH),
        "night_preview": str(NIGHT_PATH),
        "objects": len(bpy.data.objects),
        "materials": len(bpy.data.materials),
    }


RENDER_RESULT = main()
print("CODEX_PREVIEW_RESULT=" + json.dumps(RENDER_RESULT))
