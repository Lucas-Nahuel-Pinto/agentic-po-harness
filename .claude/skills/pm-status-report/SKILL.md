---
name: pm-status-report
description: >
  PM status report from the Jira traceability snapshot: epic progress,
  throughput, workload, bug aging, blockers and structure alerts, written as a
  stakeholder-ready markdown. Use for "status report", "reporte de estado",
  "weekly report", "informe semanal", "estado del proyecto", "reporte de
  trazabilidad", "how is delivery going". Read-only — never writes to Jira.
---

# pm-status-report

Produce a PM-voice status report from the snapshot in the sibling repo
`jira-traceability-manager`. The dashboard visualizes; this skill narrates for
humans (stakeholders, PMO, planning meetings).

## Inputs

| Input | Source |
| --- | --- |
| Snapshot | `../jira-traceability-manager/data/trace.json` (default; override with `--trace` or `TRACE_PATH`) |
| Snapshot freshness | `meta.generatedAt` — if older than 48h, offer to refresh first |
| Optional Jira enrich | `/acli` for sprint dates or recent transitions (load the acli skill first) |

## Steps

1. **Freshness check.** Read `meta.generatedAt` from the snapshot (or run
   `bun scripts/pm.ts report --json | head` to see it). If older than 48 hours,
   ask the user whether to refresh: `cd ../jira-traceability-manager && bun run trace:pull`
   (read-only against Jira; safe to run). Never hand-edit `data/trace.json`.
2. **Compute.** `bun scripts/pm.ts report --json` — gives epics (progress,
   worst first), throughput windows (7/14/30 days), load per assignee, bug
   aging, open blockers, structure alerts. Use the markdown output
   (`bun scripts/pm.ts report`) as the draft skeleton.
3. **Enrich (optional).** If a sprint deadline matters, get active sprint dates
   via `/acli` and compute days remaining. Note data caveats (stale snapshot,
   Xray off) honestly.
4. **Write the report.** Save to `reports/status-YYYY-MM-DD.md` in this repo.
   Structure:
   - Headline: one sentence of delivery reality (value/risk, not actions).
   - `## Riesgos y bloqueos` — first, before progress. Empty blockers is a win, say it.
   - `## Progreso por épica` — worst-first table; call out epics at 0% with
     children planned or empty epics.
   - `## Throughput` — windows + recent closures trend sentence.
   - `## Carga del equipo` — imbalances (one person over-loaded).
   - `## Aging de bugs` — anything 60+ days gets named explicitly.
   - `## Alertas de estructura` — counts with keys; reference the dashboard
     Alertas tab for triage.
5. **Present.** Headline + top 3 risks in chat; point at the saved file.

## Rules

- PM voice: headlines carry delivery meaning, never tool actions. Spanish for
  conversation output unless the user writes in English; the report file follows
  the user's requested language (default Spanish).
- Read-only: this skill NEVER writes, transitions or comments on Jira issues —
  action items discovered here go through `/pm-alerts-to-jira` (its own
  confirmation flow) or are listed as recommendations.
- Data honesty: report from the snapshot as-is; if freshness is questionable,
  mark the report with the snapshot date.
- Numbers come from the script, prose from you. Do not hand-recompute metrics.
- Every section must render even when empty (say "sin bloqueos", not silence).
