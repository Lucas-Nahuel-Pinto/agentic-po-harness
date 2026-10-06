# AGENTS.md — agentic-pm-harness

PM console for the Jira traceability project: status reports, sprint health, and turning traceability alerts into Jira actions. The dashboard and data pipeline live in the sibling repo `jira-traceability-manager`.

## Critical rules

1. **CREDENTIALS**: ALWAYS read from `.env` (see `.env.example`). NEVER hardcode or guess secrets. Example keys: `ATLASSIAN_API_TOKEN`, `TAVILY_API_KEY`.
2. **MCP / AUTH FAILURE = STOP IMMEDIATELY**: if an MCP fails auth or an env var is missing (`.mcp.json` uses `${VAR}` for Claude Code; `opencode.jsonc` uses `{env:VAR}` for OpenCode — OpenCode substitutes empty silently, so a 401/403 is the signal), do NOT work around it. STOP, name the exact env variable, point at `.env` / `.env.example`, and ask the user to fix `.env` + restart the agent session (env is cached at MCP spawn time).
3. **JIRA WRITES = CONFIRMATION REQUIRED**: `scripts/pm.ts` and the `pm-status-report` / `pm-sprint-health` skills are READ-ONLY. Every comment, transition or issue creation goes through `/pm-alerts-to-jira`, whose plan must be confirmed by the user before any `/acli` write runs.
4. **GIT / PR WORK**: follow `.claude/skills/git-flow-master/` — semantic commit prefixes (`feat:` / `fix:` / `docs:` / `test:` / `refactor:` / `chore:`), no AI attribution in commits, confirm before push, never rewrite pushed history.
5. **DEFAULT VOICE**: caveman mode is the default conversational register (`.claude/skills/caveman/`). Code, commits, PR bodies, reports files, and security warnings are ALWAYS written in normal English (or Spanish when the user asks for the report in Spanish) — that boundary is built into the skill. Revert to normal mode only when the user says "stop caveman" / "normal mode" or the semantic equivalent.
6. **PM REGISTER for artifacts**: status reports and sprint verdicts lead with delivery value and risk (PM voice), never with tool actions.

## Commands

| Command | Effect |
| --- | --- |
| `bun scripts/pm.ts report [--json]` | Status report: epic progress, throughput, load, aging, blockers, alerts |
| `bun scripts/pm.ts sprint-health [--sprint "<name>"] [--json]` | Sprint health: open/done, load, blocked, open stories |
| `bun scripts/pm.ts sprint-health --list-sprints` | List sprints with open/total counts |
| `bun scripts/pm.ts alerts [--json]` | Structure alerts (mirror of the dashboard Alertas tab) |
| `bun test` | Quality gate for the PM CLI (run before committing changes) |

Snapshot path: `../jira-traceability-manager/data/trace.json` (override with `--trace` or `TRACE_PATH`).

## Skills

| Skill | Purpose |
|---|---|
| `.claude/skills/pm-status-report/` | Stakeholder-ready status report from the snapshot (read-only) |
| `.claude/skills/pm-sprint-health/` | Sprint verdict (verde/ámbar/rojo) with blocked + load analysis (read-only) |
| `.claude/skills/pm-alerts-to-jira/` | Alerts → Jira actions via `/acli`, confirmed plan before any write |
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

- `../jira-traceability-manager/data/trace.json` — READ-ONLY input for every `pm.ts` command.
- Refresh when stale: `cd ../jira-traceability-manager && bun run trace:pull` (read-only against Jira, writes the snapshot itself).
- `data/trace.json` and `dist/` in the manager repo are generated artifacts: never hand-edit.
- Manager quality order when touching that repo: `bun test` → `bun run types:check` → `bun run lint` — never skip steps.
