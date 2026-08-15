# Project Codex Integration

This directory stores project-level Codex integration files that should be shared by the team. Codex is the primary skills host for this project.

Committed files:

- `config.toml`: enables project hooks for Codex builds that require the feature flag.
- `hooks.json`: project hook configuration.
- `hooks/`: local hook scripts and hook documentation.
- `../.agents/skills/`: Codex-first Agent Skills source of truth.
- `../.claude/skills`: symlink to `../.agents/skills` for Claude Code compatibility.

Ignored generated files:

- `agents/*.toml`: Codex custom agents generated from `../.claude/agents/`.
- `claude-sync-manifest.json`: generated manifest used for pruning stale agent outputs.

Skills are shared directly and do not need synchronization. Run the agent bridge manually with:

```bash
pnpm codex:sync-claude
```

The project hook is declared in `hooks.json` and runs on `SessionStart` and `UserPromptSubmit`. It validates `.agents/skills/*/SKILL.md` and only synchronizes Claude project agents into `.codex/agents/`.
