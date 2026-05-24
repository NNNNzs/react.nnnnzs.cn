# Codex Hooks

This directory contains project-local Codex hook scripts.

## Claude Bridge

`sync-claude-to-codex.mjs` converts the project's Claude Code assets into local Codex-readable bridge output:

- `.claude/skills/*` -> `.agents/skills/*`
- `.claude/agents/*.md` -> `.codex/agents/*.toml`

The generated output is ignored by git. The hook script itself is committed so every developer gets the same local setup behavior.

Recommended hook command:

```bash
node .codex/hooks/sync-claude-to-codex.mjs
```

The committed project hook declaration is `.codex/hooks.json`.
