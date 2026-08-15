# Codex Hooks

This directory contains project-local Codex hook scripts.

## Claude Agent Bridge

`sync-claude-to-codex.mjs` validates the Codex-first skill repository and converts the project's Claude Code agents into local Codex-readable bridge output:

- `.agents/skills/*/SKILL.md` is validated in place; no skill copy is generated.
- `.claude/skills` is a symlink to `../.agents/skills`.
- `.claude/agents/*.md` -> `.codex/agents/*.toml`

Generated agent names match the Claude Code source names.

Only the generated agent output is ignored by git. The skills and the Claude compatibility symlink are committed so every developer gets the same shared skill repository.

Recommended hook command:

```bash
node .codex/hooks/sync-claude-to-codex.mjs
```

The committed project hook declaration is `.codex/hooks.json`. It runs on `SessionStart` and `UserPromptSubmit`.
