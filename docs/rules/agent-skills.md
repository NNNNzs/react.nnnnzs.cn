# Agent Skills 管理规范

## 目录职责

本项目以 Codex 为主要编码 Agent，`.agents/skills/` 是 Agent Skills 的唯一源目录。每个技能必须至少包含一个 `SKILL.md`，并遵循技能目录自身的 frontmatter 和资源组织规范。

`.claude/skills` 是提交到 Git 的相对软链接，目标为 `../.agents/skills`。Claude Code 通过该链接读取与 Codex 相同的技能，不创建第二份技能副本。

```text
.agents/skills/<skill-name>/SKILL.md  # 唯一源文件
.claude/skills -> ../.agents/skills   # Claude Code 兼容入口
```

## 编辑规则

- 新增或修改技能时，直接编辑 `.agents/skills/<skill-name>/`。
- 不要在 `.claude/skills/` 下创建独立副本。
- `agents/openai.yaml` 可以作为 Codex 专属 UI、调用策略和 MCP 依赖配置；跨 Agent 的核心流程必须写在 `SKILL.md` 中。
- `.claude/agents/` 仍是 Claude 项目 Agent 的源目录，由 `pnpm codex:sync-claude` 生成被忽略的 `.codex/agents/*.toml` 兼容文件。

## Hook 行为

项目 Hook 在 Codex 的 `SessionStart` 和 `UserPromptSubmit` 阶段运行：

1. 检查 `.agents/skills/*/SKILL.md` 是否存在。
2. 将 `.claude/agents/*.md` 同步到 `.codex/agents/*.toml`。
3. 清理已不存在的旧 Agent 生成文件。

技能本身不经过 Hook 复制，避免源目录和生成目录解析到同一路径时发生覆盖或删除。

手动运行：

```bash
pnpm codex:sync-claude
```

## 平台约束

当前仓库采用 macOS/Linux 友好的 Git 符号链接方案。Windows 用户可能需要启用 Developer Mode 或让 Git 使用 `core.symlinks=true`，否则 `.claude/skills` 可能被检出为包含链接文本的普通文件。
