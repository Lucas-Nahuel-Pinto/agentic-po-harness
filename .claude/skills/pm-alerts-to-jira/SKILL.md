---
name: pm-alerts-to-jira
description: >
  Turn traceability structure alerts (orphan stories, empty epics, bugs
  without story, open blockers) into Jira actions: comments, follow-up issues
  or transitions, executed with /acli after explicit confirmation. Use for
  "act on alerts", "comentar las alertas", "push alerts to Jira", "create
  tickets from alerts", "arreglar alertas de trazabilidad", "alerts to Jira".
  This is the ONLY skill in this repo that WRITES to Jira.
---

# pm-alerts-to-jira

The dashboard's Alertas tab DETECTS structure problems; this skill ACTS on
them through the Atlassian CLI. Every Jira write requires an explicit,
itemized confirmation — no bulk writes on trust.

## Inputs

| Input | Source |
| --- | --- |
| Alert list | `bun scripts/pm.ts alerts --json` (mirrors the dashboard Alertas tab exactly) |
| Actions | User's request: comment / create follow-up / transition — default is COMMENT only |
| Jira access | `/acli` — LOAD the acli skill before any command; credentials from `.env` |

## Steps

1. **Load context.** Load the `/acli` skill first (syntax, auth, error
   handling). Load `.env` rules from AGENTS.md — credentials never inline.
2. **Fetch alerts.** `bun scripts/pm.ts alerts --json` — grouped:
   `orphan-story`, `empty-epic`, `bug-without-story`, `open-block`.
3. **Propose a plan (DRY-RUN).** Build an itemized table: alert → issue key →
   proposed action → exact command that will run. Defaults:
   - `orphan-story` → comment on the story: ask for the missing epic link.
   - `empty-epic` → comment on the epic: no children linked.
   - `bug-without-story` → comment on the bug: link a story or justify.
   - `open-block` → comment on the BLOCKED issue: blocker still open.
   Create-new-issues or status transitions only when the user explicitly asks;
   list them as separate plan lines.
4. **WAIT for confirmation.** Show the plan and stop. Run nothing until the
   user confirms (all of it, or a subset by key). Re-confirm if the plan
   changes materially.
5. **Execute.** Run the confirmed `/acli` commands. One comment per issue,
   message content shown in the plan (minor wording tweaks allowed; new
   actions not allowed).
6. **Report.** Per-issue result table (OK / failed + reason). Failures do not
   roll back successes — report both halves honestly.

## Rules

- **Writes only here.** `pm.ts` itself is read-only; all mutations go through
  `/acli` after step 4's confirmation.
- Never delete issues, never bulk-transition, never touch fields beyond the
  confirmed action.
- Credentials from `.env` only; on auth failure STOP and name the env var —
  no workarounds (AGENTS.md critical rule).
- Message language: Spanish (matches the project's Jira usage) unless the user
  asks otherwise; issue keys and statuses verbatim.
- If an alert looks wrong (data entry issue in Jira, e.g. links added
  backwards), flag it for human fix instead of commenting — comments on
  healthy issues are noise.
- Keep a run log line per execution in the reply (issue → action → result);
  commit nothing to Jira that was not in the confirmed plan.
