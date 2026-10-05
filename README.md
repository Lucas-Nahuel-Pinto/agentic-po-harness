# jira-traceability-harness

Agent toolbox for the Jira traceability project. Holds the skills, MCPs, and configuration an AI agent needs to operate on Jira/Xray and manage git — the dashboard itself lives in the sibling repo **`jira-traceability-manager`**.

## What's inside

```
.claude/skills/
  acli/             Atlassian CLI skill (Jira Cloud)
  xray-cli/         Xray Cloud skill (bun xray)
  git-flow-master/  Git operator skill
  caveman/          Terse voice skill (vendored from github.com/JuliusBrussee/caveman, Apache-2.0)
opencode.jsonc      OpenCode MCP config (engram + tavily)
.mcp.json           Claude Code MCP config (engram + tavily)
.env.example        Credential template
AGENTS.md           Agent operating rules
```

## Setup

1. `cp .env.example .env` and fill in your credentials (`ATLASSIAN_*`, optional `XRAY_*`, `TAVILY_API_KEY`).
2. Make sure `engram` is on your PATH (it ships its own binary) and `TAVILY_API_KEY` is set before starting the agent session — MCP env vars are read at spawn time.
3. Open the repo in your agent and invoke skills by name (`/acli`, `/xray-cli`, `/git-flow-master`, `/caveman`).

## Rules of the road

- Credentials always from `.env`; never hardcoded.
- MCP or auth failure = STOP and name the missing env var; no workarounds.
- No AI attribution in commits; confirm before push.
- Caveman voice is the default for conversation; code/commits/PRs stay normal English.

## Upstream attribution

- `caveman` skill — © 2026 Julius Brussee, Apache-2.0. See `.claude/skills/caveman/LICENSE-APACHE-2.0` and `NOTICE`.
- `acli`, `xray-cli`, `git-flow-master` — copied from the project QA boilerplate.
