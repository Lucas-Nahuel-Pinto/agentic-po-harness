# AGENTS.md — jira-traceability-harness

Agent toolbox for Jira traceability work: skills + MCPs + CLI wrappers. The dashboard and data pipeline live in the sibling repo `jira-traceability-manager`.

## Critical rules

1. **CREDENTIALS**: ALWAYS read from `.env` (see `.env.example`). NEVER hardcode or guess secrets. Example keys: `ATLASSIAN_API_TOKEN`, `TAVILY_API_KEY`.
2. **MCP / AUTH FAILURE = STOP IMMEDIATELY**: if an MCP fails auth or an env var is missing (`.mcp.json` uses `${VAR}` for Claude Code; `opencode.jsonc` uses `{env:VAR}` for OpenCode — OpenCode substitutes empty silently, so a 401/403 is the signal), do NOT work around it. STOP, name the exact env variable, point at `.env` / `.env.example`, and ask the user to fix `.env` + restart the agent session (env is cached at MCP spawn time).
3. **GIT / PR WORK**: follow `.claude/skills/git-flow-master/` — semantic commit prefixes (`feat:` / `fix:` / `docs:` / `test:` / `refactor:` / `chore:`), no AI attribution in commits, confirm before push, never rewrite pushed history.
4. **DEFAULT VOICE**: caveman mode is the default conversational register (`.claude/skills/caveman/`). Code, commits, PR bodies, and security warnings are ALWAYS written in normal English — that boundary is built into the skill. Revert to normal mode only when the user says "stop caveman" / "normal mode" or the semantic equivalent.
5. **NO PUSH without explicit user confirmation.**

## Skills

| Skill | Purpose |
|---|---|
| `.claude/skills/acli/` | Atlassian CLI for Jira Cloud issues, comments, transitions |
| `.claude/skills/xray-cli/` | Xray Cloud test management via `bun xray` |
| `.claude/skills/git-flow-master/` | End-to-end git operator (branch, commit, PR, conflicts) |
| `.claude/skills/caveman/` | Terse conversational voice (vendored, Apache-2.0) |

## MCPs

| MCP | Use |
|---|---|
| `engram` | Persistent memory across sessions |
| `tavily` | Web search (community fixes, troubleshooting) |

## Relationship to `jira-traceability-manager`

- `bun run trace:pull` — refresh the BK snapshot (`data/trace.json`)
- `bun run trace:refresh` — pull + rebuild `dist/index.html`
- `bun test` → `bun run types:check` → `bun run lint` — quality order, never skip
- `data/trace.json` and `dist/` are generated artifacts: never hand-edit
