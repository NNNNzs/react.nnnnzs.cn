# Codex Instructions

Use @CLAUDE.md as the source of truth for this project.

Production website: `https://www.nnnnzs.cn`. `react.nnnnzs.cn` is the repository and package name; do not infer a public URL from it. For deployment and URL settings, see `docs/rules/project-overview.md` and `docs/rules/environment-variables.md`.

Codex-first Agent Skills live in `.agents/skills/` and are committed as the shared source of truth. `.claude/skills` is a repository symlink to `../.agents/skills`, so edit the files through `.agents/skills/`. Claude project agents in `.claude/agents/` are still bridged into ignored `.codex/agents/*.toml` files by the project hook; edit the Claude source when changing those agents.

## 开发环境与数据库

- [mac] `/Users/nnnnzs/project/react.nnnnzs.cn` 为开发工作区；本项目结构同步使用 `pnpm prisma:push`，无需手写建表 SQL。
- 用户已授权功能实施时，完成必要的开发库同步和最小初始化；先审查差异，遇到数据丢失或范围外变更再核对。
- 项目操作以当前仓库规范为准，不套用其他项目的 SQL 发布流程；云数据库地址不代表生产环境。

## 功能规划

- [全站访客与访问统计](docs/designs/features/visitor-analytics.md)：GA4 累计 PV/UV、访问会话、后台看板、只读凭据与配置初始化。

## Blender MCP

- 当用户明确要求运行 Blender、重试 Blender 建模或连接 Blender MCP 时，允许由 Codex 启动 Blender；这属于用户明确授权的应用启动，不受“不要自动启动服务”约束。
- 优先使用 `/Applications/Blender.app/Contents/MacOS/Blender` 启动桌面应用，并保持前台可见；不要把 Blender 作为隐藏后台服务启动。
- Blender 启动后，等待 MCP 插件监听，再使用 `mcp__blender__execute_blender_code` 检查连接；连接失败时报告真实错误，不要假设建模成功。
- Blender 启动、MCP 连接和模型制作遵循 `/Users/nnnnzs/.codex/skills/blender-official-workflow/SKILL.md` 的官方启动、结构化检查、模块化建模、验证和保存流程。
