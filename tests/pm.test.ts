import { describe, expect, test } from 'bun:test';
import type { PmEdge, PmNode, PmSnapshot } from '../scripts/pm.ts';
import { alerts, bugAging, epicProgress, listSprints, loadByAssignee, openBlockers, reportMarkdown, sprintHealth, throughput } from '../scripts/pm.ts';

const now = new Date('2026-10-06T12:00:00.000Z');

function node(partial: Partial<PmNode> & { key: string }): PmNode {
  return { kind: 'issue', ...partial };
}

const nodes: PmNode[] = [
  node({ key: 'EPIC-1', issueType: 'Epic', status: 'In Progress', statusCategory: 'indeterminate' }),
  node({ key: 'ST-1', issueType: 'Story', parent: 'EPIC-1', statusCategory: 'done', assignee: 'Ana', points: 3, sprint: 'Sprint 9', resolutionDate: '2026-10-01T10:00:00.000Z' }),
  node({ key: 'ST-2', issueType: 'Story', parent: 'EPIC-1', status: 'In Progress', statusCategory: 'indeterminate', assignee: 'Ana', points: 5, sprint: 'Sprint 9' }),
  node({ key: 'TASK-1', issueType: 'Task', parent: 'ST-1', status: 'To Do', statusCategory: 'new', sprint: 'Sprint 9' }),
  node({ key: 'EPIC-2', issueType: 'Epic', status: 'To Do', statusCategory: 'new' }),
  node({ key: 'ST-3', issueType: 'Story', status: 'To Do', statusCategory: 'new' }),
  node({ key: 'BUG-1', issueType: 'Bug', status: 'Open', statusCategory: 'new', assignee: 'Beto', createdAt: '2026-06-27T10:00:00.000Z', sprint: 'Sprint 9' }),
];

const edges: PmEdge[] = [
  { from: 'BUG-1', to: 'ST-2', kind: 'link:blocks' },
  { from: 'EPIC-1', to: 'ST-1', kind: 'hierarchy' },
];

const snapshot: PmSnapshot = {
  meta: { projectKey: 'BK', generatedAt: '2026-10-06T12:00:00.000Z', counts: { nodes: nodes.length, edges: edges.length } },
  nodes,
  edges,
};

describe('epicProgress', () => {
  test('counts all descendants and sorts worst first', () => {
    const rows = epicProgress(nodes);
    expect(rows.map(row => row.key)).toEqual(['EPIC-2', 'EPIC-1']);
    const epic1 = rows.find(row => row.key === 'EPIC-1');
    expect(epic1?.total).toBe(3);
    expect(epic1?.done).toBe(1);
    expect(epic1?.pct).toBe(33);
    expect(rows.find(row => row.key === 'EPIC-2')?.pct).toBe(0);
  });
});

describe('throughput', () => {
  test('only includes resolutions inside the window', () => {
    expect(throughput(nodes, 7, now).map(row => row.key)).toEqual(['ST-1']);
    expect(throughput(nodes, 1, now)).toEqual([]);
  });
});

describe('loadByAssignee', () => {
  test('excludes epics and done issues, buckets unassigned', () => {
    const rows = loadByAssignee(nodes);
    const ana = rows.find(row => row.assignee === 'Ana');
    expect(ana?.open).toBe(1);
    expect(ana?.points).toBe(5);
    expect(rows.some(row => row.assignee === 'Beto' && row.open === 1)).toBe(true);
    expect(rows.some(row => row.assignee === '(sin asignar)' && row.open === 2)).toBe(true);
  });
});

describe('bugAging', () => {
  test('buckets open bugs by age', () => {
    const buckets = bugAging(nodes, now);
    expect(buckets[0].count).toBe(0);
    expect(buckets[1].count).toBe(0);
    expect(buckets[2].count).toBe(1);
    expect(buckets[2].keys).toEqual(['BUG-1']);
  });
});

describe('openBlockers', () => {
  test('reports blocks edges whose target is still open', () => {
    const rows = openBlockers(nodes, edges);
    expect(rows).toHaveLength(1);
    expect(rows[0].blocker).toBe('BUG-1');
    expect(rows[0].blocked).toBe('ST-2');
  });
});

describe('alerts', () => {
  test('mirrors dashboard alert rules', () => {
    const rows = alerts(nodes, edges);
    const byType = (type: string) => rows.filter(row => row.type === type).map(row => row.key);
    expect(byType('orphan-story')).toEqual(['ST-3']);
    expect(byType('bug-without-story')).toEqual(['BUG-1']);
    expect(byType('empty-epic')).toEqual(['EPIC-2']);
    expect(byType('open-block')).toEqual(['ST-2']);
  });
});

describe('sprintHealth', () => {
  test('aggregates members of the requested sprint', () => {
    const report = sprintHealth(snapshot, 'Sprint 9');
    expect(report.total).toBe(4);
    expect(report.open).toBe(3);
    expect(report.done).toBe(1);
    expect(report.blocked.map(row => row.blocked)).toEqual(['ST-2']);
    expect(report.openStories.map(row => row.key)).toEqual(['ST-2']);
  });

  test('auto-picks the sprint with most open issues', () => {
    const report = sprintHealth(snapshot);
    expect(report.sprint).toBe('Sprint 9');
  });

  test('fails with a clear message on unknown sprint', () => {
    expect(() => sprintHealth(snapshot, 'Sprint 99')).toThrow('no aparece en el snapshot');
  });
});

describe('listSprints', () => {
  test('lists sprints with open and total counts', () => {
    const rows = listSprints(snapshot);
    expect(rows).toEqual([{ sprint: 'Sprint 9', open: 3, total: 4 }]);
  });
});

describe('reportMarkdown', () => {
  test('renders all sections with escaped pipes', () => {
    const markdown = reportMarkdown(snapshot, now);
    expect(markdown).toContain('# Reporte de trazabilidad — BK');
    expect(markdown).toContain('## Épicas (progreso, peor primero)');
    expect(markdown).toContain('## Throughput');
    expect(markdown).toContain('## Carga abierta por responsable');
    expect(markdown).toContain('## Aging de bugs abiertos');
    expect(markdown).toContain('## Bloqueos abiertos');
    expect(markdown).toContain('## Alertas de estructura');
  });
});
