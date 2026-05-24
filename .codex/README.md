# Project Codex Bridge

This directory stores project-level Codex integration files that should be shared by the team.

Committed files:

- `config.toml`: enables project hooks for Codex builds that require the feature flag.
- `hooks.json`: project hook configuration.
- `hooks/`: local hook scripts and hook documentation.

Ignored generated files:

- `.agents/skills/`: Codex skill copies generated from `.claude/skills/`.
- `.agents/CLAUDE_BRIDGE.md`: generated sync index.
- `.agents/claude-sync-manifest.json`: generated sync manifest used for pruning stale outputs.
- `agents/*.toml`: Codex custom agents generated from `.claude/agents/`.

Run the bridge manually with:

```bash
pnpm codex:sync-claude
```

The project hook is declared in `hooks.json` and runs on `SessionStart` and `UserPromptSubmit`.
