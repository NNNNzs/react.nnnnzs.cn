"""Export the saved homepage room as a browser-ready glTF binary."""

from pathlib import Path

import bpy

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = PROJECT_ROOT / "assets/blender/cyberpunk-homepage-room.blend"
GLB_PATH = PROJECT_ROOT / "public/models/cyberpunk-homepage-room.glb"


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    for obj in bpy.context.scene.objects:
        obj.select_set(
            obj.type in {"MESH", "EMPTY"}
            and not bool(obj.get("collider"))
            and not obj.name.startswith("collider_")
        )

    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print({"status": "ok", "glb_path": str(GLB_PATH), "bytes": GLB_PATH.stat().st_size})


main()
