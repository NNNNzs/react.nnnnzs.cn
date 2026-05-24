# Project Codex Bridge

This directory stores project-level Codex integration files that should be shared by the team.

Committed files:

- `config.toml`: enables project hooks for Codex builds that require the feature flag.
- `hooks.json`: project hook configuration.
- `hooks/`: local hook scripts and hook documentation.

Ignored generated files:

- `.agents/skills/claude-*/`: Codex skill copies generated from `.claude/skills/`.
- `agents/claude-*.toml`: Codex custom agents generated from `.claude/agents/`.
- `CLAUDE_BRIDGE.md`: generated sync index.
- `claude-sync-manifest.json`: generated sync manifest used for pruning stale outputs.

Run the bridge manually with:

```bash
pnpm codex:sync-claude
```

The project hook is declared in `hooks.json`.
