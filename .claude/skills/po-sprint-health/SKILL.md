---
name: po-sprint-health
description: >
  Health check of the active sprint from the traceability snapshot: open vs
  done, workload per person, blocked items and stories at risk before the
  sprint closes. Use for "sprint health", "salud del sprint", "how is the
  sprint going", "cómo va el sprint", "sprint status", "riesgo de sprint",
  "qué falta en el sprint". Read-only — never writes to Jira.
---

# po-sprint-health

Assess sprint delivery risk: is the sprint going to close clean, and if not,
what is in the way. Data comes from the snapshot's `sprint` field; sprint
dates (start/end) come from Jira via `/acli`.

## Inputs

| Input | Source |
| --- | --- |
| Sprint name | User-provided, or auto-picked by the script (sprint with most open issues), or list first with `--list-sprints` |
| Snapshot | `../jira-traceability-manager/data/trace.json` |
| Sprint end date | `/acli` (load the acli skill first) — snapshot does not carry dates |

## Steps

1. **Identify the sprint.** If the user did not name one:
   `bun scripts/po.ts sprint-health --list-sprints` and either pick the one
   with open issues or ask the user to choose. Warn if auto-picked.
2. **Compute.** `bun scripts/po.ts sprint-health --sprint "<name>" --json` —
   totals, open/done, status breakdown, load per assignee, blocked items,
   open stories. Fallback to non-JSON output for a quick read.
3. **Get the deadline.** Query sprint start/end via `/acli` (board/sprint
   commands — see the acli skill references). Compute working days left
   (honest about weekends/holidays if unknown).
4. **Judge.** Compare open work + throughput pace against days left:
   - **VERDE** — remaining open work fits the observed 7-day throughput.
   - **ÁMBAR** — tight; name exactly which stories must close and who owns them.
   - **ROJO** — will not close; escalate: blocked items first, then load
     imbalances, then scope to move out of the sprint.
   Every verdict cites its numbers (open count, days left, throughput).
5. **Present.** Headline verdict + blocked/at-risk items table + recommendation
   (reassign / escalate blocker / descope). Save to
   `reports/sprint-health-<sprint-slug>-YYYY-MM-DD.md` only if the user wants
   a file; chat output is the default.

## Rules

- Read-only: never transition issues or comment on Jira from this skill.
- The snapshot's `sprint` field reflects the issue's latest non-closed sprint;
  if numbers look stale versus Jira, say so and offer `trace:pull`.
- Blocked items are the first-class risk — always list them before load or
  scope commentary.
- Load rows use points when present; say "sin puntos" rather than implying
  precision the data does not have.
- PO voice for the verdict; technical register for issue keys, statuses and
  commands.
