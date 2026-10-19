import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PoNode {
  key: string
  kind: string
  url?: string
  summary?: string
  issueType?: string
  status?: string
  statusCategory?: string
  assignee?: string
  points?: number
  sprint?: string
  createdAt?: string
  updatedAt?: string
  resolutionDate?: string
  parent?: string
}

export interface PoEdge {
  from: string
  to: string
  kind: string
}

export interface PoSnapshot {
  meta: { projectKey: string, generatedAt: string, counts?: { nodes: number, edges: number } }
  nodes: PoNode[]
  edges: PoEdge[]
}

export interface EpicRow {
  key: string
  summary?: string
  status?: string
  total: number
  done: number
  pct: number
}

export interface DoneRow {
  key: string
  summary?: string
  issueType?: string
  resolutionDate: string
}

export interface LoadRow {
  assignee: string
  open: number
  points: number
}

export interface AgingBucket {
  label: string
  count: number
  keys: string[]
}

export interface BlockRow {
  blocker: string
  blockerSummary?: string
  blocked: string
  blockedSummary?: string
  blockedStatus?: string
}

export interface AlertRow {
  type: 'orphan-story' | 'bug-without-story' | 'empty-epic' | 'open-block'
  key: string
  detail: string
  summary?: string
}

export interface SprintReport {
  sprint: string
  total: number
  open: number
  done: number
  byStatus: Record<string, number>
  load: LoadRow[]
  blocked: BlockRow[]
  openStories: { key: string, summary?: string, assignee?: string, status?: string }[]
}

const DEFAULT_TRACE = resolve(import.meta.dir, '../../jira-traceability-manager/data/trace.json');
const DAY_MS = 86_400_000;

export function loadSnapshot(explicit?: string): PoSnapshot {
  const path = explicit ?? process.env.TRACE_PATH ?? DEFAULT_TRACE;
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as PoSnapshot;
  if (!Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) {
    throw new Error(`snapshot inválido o vacío en ${path} — corré "bun run trace:pull" en jira-traceability-manager`);
  }
  return snapshot;
}

export function isOpen(node: PoNode): boolean {
  return node.statusCategory !== 'done';
}

function issueNodes(snapshot: PoSnapshot): PoNode[] {
  return snapshot.nodes.filter(node => node.kind === 'issue');
}

function childrenMap(nodes: PoNode[]): Map<string, PoNode[]> {
  const map = new Map<string, PoNode[]>();
  for (const node of nodes) {
    if (!node.parent) { continue; }
    const bucket = map.get(node.parent) ?? [];
    bucket.push(node);
    map.set(node.parent, bucket);
  }
  return map;
}

function collectDescendants(key: string, children: Map<string, PoNode[]>): PoNode[] {
  const out: PoNode[] = [];
  const stack = [...(children.get(key) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) { continue; }
    out.push(node);
    stack.push(...(children.get(node.key) ?? []));
  }
  return out;
}

export function epicProgress(nodes: PoNode[]): EpicRow[] {
  const children = childrenMap(nodes);
  return nodes
    .filter(node => node.issueType === 'Epic')
    .map((epic) => {
      const all = collectDescendants(epic.key, children);
      const done = all.filter(node => node.statusCategory === 'done').length;
      return {
        key: epic.key,
        summary: epic.summary,
        status: epic.status,
        total: all.length,
        done,
        pct: all.length === 0 ? 0 : Math.round((done / all.length) * 100),
      };
    })
    .sort((a, b) => a.pct - b.pct || a.key.localeCompare(b.key));
}

export function throughput(nodes: PoNode[], days: number, now: Date): DoneRow[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return nodes
    .filter(node => node.resolutionDate && Date.parse(node.resolutionDate) >= cutoff)
    .map(node => ({
      key: node.key,
      summary: node.summary,
      issueType: node.issueType,
      resolutionDate: node.resolutionDate ?? '',
    }))
    .sort((a, b) => Date.parse(b.resolutionDate) - Date.parse(a.resolutionDate));
}

export function loadByAssignee(nodes: PoNode[]): LoadRow[] {
  const rows = new Map<string, LoadRow>();
  for (const node of nodes) {
    if (node.issueType === 'Epic' || !isOpen(node)) { continue; }
    const assignee = node.assignee ?? '(sin asignar)';
    const row = rows.get(assignee) ?? { assignee, open: 0, points: 0 };
    row.open += 1;
    row.points += node.points ?? 0;
    rows.set(assignee, row);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.open - a.open);
}

export function bugAging(nodes: PoNode[], now: Date): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: '0-30 días', count: 0, keys: [] },
    { label: '31-60 días', count: 0, keys: [] },
    { label: '60+ días', count: 0, keys: [] },
  ];
  for (const node of nodes) {
    if (node.issueType !== 'Bug' || !isOpen(node) || !node.createdAt) { continue; }
    const age = (now.getTime() - Date.parse(node.createdAt)) / DAY_MS;
    const bucket = age <= 30 ? 0 : age <= 60 ? 1 : 2;
    buckets[bucket].count += 1;
    buckets[bucket].keys.push(node.key);
  }
  return buckets;
}

export function openBlockers(nodes: PoNode[], edges: PoEdge[]): BlockRow[] {
  const byKey = new Map(nodes.map(node => [node.key, node] as const));
  const rows: BlockRow[] = [];
  for (const edge of edges) {
    if (edge.kind !== 'link:blocks') { continue; }
    const blocked = byKey.get(edge.to);
    if (!blocked || !isOpen(blocked)) { continue; }
    const blocker = byKey.get(edge.from);
    rows.push({
      blocker: edge.from,
      blockerSummary: blocker?.summary,
      blocked: edge.to,
      blockedSummary: blocked.summary,
      blockedStatus: blocked.status,
    });
  }
  return rows;
}

export function alerts(nodes: PoNode[], edges: PoEdge[]): AlertRow[] {
  const rows: AlertRow[] = [];
  const children = childrenMap(nodes);
  const byKey = new Map(nodes.map(node => [node.key, node] as const));
  for (const node of nodes) {
    if (node.issueType === 'Story' && !node.parent) {
      rows.push({ type: 'orphan-story', key: node.key, detail: 'Story sin épica', summary: node.summary });
    }
    if (node.issueType === 'Bug' && !node.parent) {
      rows.push({ type: 'bug-without-story', key: node.key, detail: 'Bug sin story', summary: node.summary });
    }
    if (node.issueType === 'Epic' && (children.get(node.key) ?? []).length === 0) {
      rows.push({ type: 'empty-epic', key: node.key, detail: 'Épica sin stories', summary: node.summary });
    }
  }
  for (const edge of edges) {
    if (edge.kind !== 'link:blocks') { continue; }
    const blocked = byKey.get(edge.to);
    if (!blocked || !isOpen(blocked)) { continue; }
    rows.push({ type: 'open-block', key: edge.to, detail: `${edge.from} bloquea ${edge.to}`, summary: blocked.summary });
  }
  return rows;
}

function pickSprint(nodes: PoNode[]): string | undefined {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (!node.sprint || !isOpen(node)) { continue; }
    counts.set(node.sprint, (counts.get(node.sprint) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function sprintHealth(snapshot: PoSnapshot, sprintName?: string): SprintReport {
  const nodes = issueNodes(snapshot);
  const name = sprintName ?? pickSprint(nodes);
  if (!name) {
    throw new Error('el snapshot no tiene sprints — pasá --sprint "<nombre>" o refrescá datos');
  }
  const members = nodes.filter(node => node.sprint === name);
  if (members.length === 0) {
    throw new Error(`el sprint "${name}" no aparece en el snapshot — listá los disponibles con --list-sprints`);
  }
  const memberKeys = new Set(members.map(node => node.key));
  const byStatus: Record<string, number> = {};
  for (const node of members) {
    const status = node.status ?? '(sin estado)';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return {
    sprint: name,
    total: members.length,
    open: members.filter(node => isOpen(node)).length,
    done: members.filter(node => node.statusCategory === 'done').length,
    byStatus,
    load: loadByAssignee(members),
    blocked: openBlockers(snapshot.nodes, snapshot.edges).filter(row => memberKeys.has(row.blocked)),
    openStories: members
      .filter(node => node.issueType === 'Story' && isOpen(node))
      .map(node => ({ key: node.key, summary: node.summary, assignee: node.assignee, status: node.status })),
  };
}

export function listSprints(snapshot: PoSnapshot): { sprint: string, open: number, total: number }[] {
  const map = new Map<string, { sprint: string, open: number, total: number }>();
  for (const node of issueNodes(snapshot)) {
    if (!node.sprint) { continue; }
    const row = map.get(node.sprint) ?? { sprint: node.sprint, open: 0, total: 0 };
    row.total += 1;
    if (isOpen(node)) { row.open += 1; }
    map.set(node.sprint, row);
  }
  return [...map.values()].sort((a, b) => b.open - a.open);
}

export interface ReportData {
  projectKey: string
  generatedAt: string
  counts?: { nodes: number, edges: number }
  epics: EpicRow[]
  throughput: { last7: number, last14: number, last30: number, recent: DoneRow[] }
  load: LoadRow[]
  bugAging: AgingBucket[]
  blockers: BlockRow[]
  alerts: AlertRow[]
}

export function reportJson(snapshot: PoSnapshot, now: Date): ReportData {
  const nodes = issueNodes(snapshot);
  return {
    projectKey: snapshot.meta.projectKey,
    generatedAt: snapshot.meta.generatedAt,
    counts: snapshot.meta.counts,
    epics: epicProgress(nodes),
    throughput: {
      last7: throughput(nodes, 7, now).length,
      last14: throughput(nodes, 14, now).length,
      last30: throughput(nodes, 30, now).length,
      recent: throughput(nodes, 7, now).slice(0, 10),
    },
    load: loadByAssignee(nodes),
    bugAging: bugAging(nodes, now),
    blockers: openBlockers(nodes, snapshot.edges),
    alerts: alerts(nodes, snapshot.edges),
  };
}

function md(text: string | undefined): string {
  return (text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function reportMarkdown(snapshot: PoSnapshot, now: Date): string {
  const data = reportJson(snapshot, now);
  const lines: string[] = [];
  lines.push(`# Reporte de trazabilidad — ${data.projectKey}`);
  lines.push('');
  lines.push(`Snapshot: ${data.generatedAt}${data.counts ? ` · ${data.counts.nodes} nodos / ${data.counts.edges} vínculos` : ''}`);
  lines.push('');
  lines.push('## Épicas (progreso, peor primero)');
  lines.push('| Épica | Estado | Progreso |');
  lines.push('| --- | --- | --- |');
  for (const epic of data.epics) {
    lines.push(`| ${epic.key} ${md(epic.summary)} | ${md(epic.status)} | ${epic.pct}% (${epic.done}/${epic.total}) |`);
  }
  lines.push('');
  lines.push('## Throughput');
  lines.push(`- Últimos 7 días: **${data.throughput.last7}** issues cerrados`);
  lines.push(`- Últimos 14 días: **${data.throughput.last14}**`);
  lines.push(`- Últimos 30 días: **${data.throughput.last30}**`);
  if (data.throughput.recent.length > 0) {
    lines.push('');
    lines.push('Cierres recientes:');
    lines.push('| Issue | Tipo | Cerrado |');
    lines.push('| --- | --- | --- |');
    for (const row of data.throughput.recent) {
      lines.push(`| ${row.key} ${md(row.summary)} | ${md(row.issueType)} | ${row.resolutionDate.slice(0, 10)} |`);
    }
  }
  lines.push('');
  lines.push('## Carga abierta por responsable');
  lines.push('| Responsable | Issues abiertos | Puntos |');
  lines.push('| --- | --- | --- |');
  for (const row of data.load) {
    lines.push(`| ${md(row.assignee)} | ${row.open} | ${row.points} |`);
  }
  lines.push('');
  lines.push('## Aging de bugs abiertos');
  lines.push('| Rango | Cantidad |');
  lines.push('| --- | --- |');
  for (const bucket of data.bugAging) {
    lines.push(`| ${bucket.label} | ${bucket.count} |`);
  }
  const aged = data.bugAging[2];
  if (aged && aged.count > 0) {
    lines.push('');
    lines.push(`Bugs con más de 60 días: ${aged.keys.join(', ')}`);
  }
  lines.push('');
  lines.push('## Bloqueos abiertos');
  if (data.blockers.length === 0) {
    lines.push('- Ninguno');
  }
  else {
    for (const row of data.blockers) {
      lines.push(`- **${row.blocker}** ${md(row.blockerSummary)} bloquea **${row.blocked}** (${md(row.blockedStatus)})`);
    }
  }
  lines.push('');
  lines.push('## Alertas de estructura');
  const groups: AlertRow['type'][] = ['orphan-story', 'empty-epic', 'bug-without-story', 'open-block'];
  const labels: Record<AlertRow['type'], string> = {
    'orphan-story': 'Stories sin épica',
    'empty-epic': 'Épicas vacías',
    'bug-without-story': 'Bugs sin story',
    'open-block': 'Bloqueos abiertos',
  };
  for (const type of groups) {
    const rows = data.alerts.filter(alert => alert.type === type);
    lines.push(`- ${labels[type]}: **${rows.length}**${rows.length > 0 ? ` — ${rows.map(row => row.key).join(', ')}` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

interface CliArgs {
  command: string
  json: boolean
  sprint?: string
  trace?: string
  listSprints: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { command: argv[0] ?? '', json: false, listSprints: false };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') { args.json = true; }
    else if (token === '--list-sprints') { args.listSprints = true; }
    else if (token === '--sprint') {
      i += 1;
      args.sprint = argv[i];
      if (!args.sprint) { throw new Error('--sprint requiere un valor'); }
    }
    else if (token === '--trace') {
      i += 1;
      args.trace = argv[i];
      if (!args.trace) { throw new Error('--trace requiere un valor'); }
    }
    else if (token) { throw new Error(`argumento desconocido: ${token}`); }
  }
  return args;
}

function print(value: unknown, json: boolean, fallback: () => string): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
  }
  else {
    console.log(fallback());
  }
}

function main(argv: string[]): void {
  const args = parseArgs(argv);
  const snapshot = loadSnapshot(args.trace);
  const now = new Date();
  switch (args.command) {
    case 'report':
      print(reportJson(snapshot, now), args.json, () => reportMarkdown(snapshot, now));
      break;
    case 'sprint-health': {
      if (args.listSprints) {
        print(listSprints(snapshot), args.json, () => listSprints(snapshot)
          .map(row => `${row.sprint} — ${row.open} abiertos / ${row.total} total`)
          .join('\n'));
        break;
      }
      const health = sprintHealth(snapshot, args.sprint);
      print(health, args.json, () => {
        const lines = [
          `# Salud de sprint — ${health.sprint}`,
          '',
          `- Issues: ${health.total} · abiertos: **${health.open}** · cerrados: ${health.done}`,
          `- Estados: ${Object.entries(health.byStatus).map(([status, count]) => `${status}: ${count}`).join(' · ')}`,
          '',
          '## Carga',
          ...health.load.map(row => `- ${row.assignee}: ${row.open} abiertos, ${row.points} puntos`),
          '',
          '## Bloqueados en el sprint',
          ...(health.blocked.length === 0 ? ['- Ninguno'] : health.blocked.map(row => `- ${row.blocked} bloqueado por ${row.blocker} (${row.blockedStatus ?? ''})`)),
          '',
          '## Stories abiertas',
          ...health.openStories.map(row => `- ${row.key} ${md(row.summary)} — ${row.assignee ?? '(sin asignar)'} · ${row.status ?? ''}`),
          '',
        ];
        return lines.join('\n');
      });
      break;
    }
    case 'alerts': {
      const rows = alerts(issueNodes(snapshot), snapshot.edges);
      const grouped = {
        'orphan-story': rows.filter(row => row.type === 'orphan-story'),
        'empty-epic': rows.filter(row => row.type === 'empty-epic'),
        'bug-without-story': rows.filter(row => row.type === 'bug-without-story'),
        'open-block': rows.filter(row => row.type === 'open-block'),
      };
      print(grouped, args.json, () => rows.map(row => `[${row.type}] ${row.key} — ${row.detail}`).join('\n'));
      break;
    }
    default:
      throw new Error('uso: bun scripts/po.ts <report|sprint-health|alerts> [--json] [--sprint "<nombre>"] [--list-sprints] [--trace <path>]');
  }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  }
  catch (error) {
    console.error(`[po] ${(error as Error).message}`);
    process.exit(1);
  }
}
