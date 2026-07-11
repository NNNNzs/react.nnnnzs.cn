# Codex Instructions

Use @CLAUDE.md as the source of truth for this project.

Claude Code assets in `.claude/` are mirrored locally for Codex by the project hook. Do not edit generated bridge files; update the `.claude/` source instead.

## Blender MCP

- 当用户明确要求运行 Blender、重试 Blender 建模或连接 Blender MCP 时，允许由 Codex 启动 Blender；这属于用户明确授权的应用启动，不受“不要自动启动服务”约束。
- 优先使用 `/Applications/Blender.app/Contents/MacOS/Blender` 启动桌面应用，并保持前台可见；不要把 Blender 作为隐藏后台服务启动。
- Blender 启动后，等待 MCP 插件监听，再使用 `mcp__blender__execute_blender_code` 检查连接；连接失败时报告真实错误，不要假设建模成功。
- Blender 启动、MCP 连接和模型制作遵循 `/Users/nnnnzs/.codex/skills/blender-official-workflow/SKILL.md` 的官方启动、结构化检查、模块化建模、验证和保存流程。
