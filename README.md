# agentic-po-harness

Agent console for **Product Owner workflows** on the Jira traceability project: backlog and epic visibility, sprint goal health, and turning traceability alerts into confirmed Jira actions. The dashboard itself lives in the sibling repo **`jira-traceability-manager`**.

## What's inside

```
scripts/po.ts               PO CLI: report | sprint-health | alerts (read-only)
tests/po.test.ts            CLI quality gate (bun test)
.claude/skills/
  po-status-report/         Stakeholder-ready backlog/delivery report from the snapshot
  po-sprint-health/         Sprint goal verdict (verde/ámbar/rojo) + blocked/load analysis
  po-alerts-to-jira/        Alerts → Jira actions via acli, plan confirmed first
  acli/                     Atlassian CLI skill (Jira Cloud)
  xray-cli/                 Xray Cloud skill (bun xray)
  git-flow-master/          Git operator skill
  caveman/                  Terse voice skill (vendored from github.com/JuliusBrussee/caveman, Apache-2.0)
opencode.jsonc              OpenCode MCP config (engram + tavily)
.mcp.json                   Claude Code MCP config (engram + tavily)
.env.example                Credential template
AGENTS.md                   Agent operating rules
reports/                    Saved status reports and sprint health snapshots
```

## Setup

1. `cp .env.example .env` and fill in your credentials (`ATLASSIAN_*`, optional `XRAY_*`, `TAVILY_API_KEY`).
2. Make sure `engram` is on your PATH (it ships its own binary) and `TAVILY_API_KEY` is set before starting the agent session — MCP env vars are read at spawn time.
3. Open the repo in your agent and invoke skills by name (`/po-status-report`, `/po-sprint-health`, `/po-alerts-to-jira`, `/acli`, ...).

## Quick start

```bash
bun test                                  # CLI quality gate
bun scripts/po.ts report                  # full status report (markdown)
bun scripts/po.ts report --json           # same data, structured for agents
bun scripts/po.ts sprint-health --list-sprints
bun scripts/po.ts sprint-health --sprint "Bunkai (72) Sprint 4"
bun scripts/po.ts alerts --json           # structure alerts (dashboard mirror)
```

The CLI reads `../jira-traceability-manager/data/trace.json` by default (`--trace` / `TRACE_PATH` to override). Refresh that snapshot with `bun run trace:pull` inside the manager repo.

## Rules of the road

- Credentials always from `.env`; never hardcoded.
- MCP or auth failure = STOP and name the missing env var; no workarounds.
- `scripts/po.ts` is read-only against Jira; writes only via `/po-alerts-to-jira` with explicit plan confirmation.
- No AI attribution in commits; confirm before push.
- Caveman voice is the default for conversation; code/commits/PRs/reports stay normal English or Spanish — that boundary is built into the skill.

## Upstream attribution

- `caveman` skill — © 2026 Julius Brussee, Apache-2.0. See `.claude/skills/caveman/LICENSE-APACHE-2.0` and `NOTICE` in this directory.
- `acli`, `xray-cli`, `git-flow-master` — copied from the project QA boilerplate.
