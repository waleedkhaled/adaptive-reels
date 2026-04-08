import * as z from 'zod';
import { NodeId, SchemaVersion } from './common';

export const NodeKind = z.enum(['domain', 'topic', 'concept']);
export type NodeKind = z.infer<typeof NodeKind>;

export const GraphNode = z.object({
  id: NodeId,
  kind: NodeKind,
  title: z.string().min(1),
  /** Short name for tight places (topics only): "React + TS", "Systems design". */
  short_title: z.string().min(1).max(16).optional(),
  summary: z.string().min(1),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const EdgeType = z.enum(['PREREQUISITE_OF', 'PART_OF', 'RELATED_TO']);
export type EdgeType = z.infer<typeof EdgeType>;

/** PREREQUISITE_OF: from must be learned before to. PART_OF: child -> parent. RELATED_TO: stored both ways. */
export const GraphEdge = z.object({ from: NodeId, to: NodeId, type: EdgeType });
export type GraphEdge = z.infer<typeof GraphEdge>;

const RawGraph = z.object({
  schema_version: SchemaVersion,
  nodes: z.array(GraphNode).min(1),
  edges: z.array(GraphEdge),
});

/** Structural problems with a graph; empty when valid. */
export function graphProblems(graph: z.infer<typeof RawGraph>): string[] {
  const problems: string[] = [];
  const kindById = new Map<string, NodeKind>();
  for (const node of graph.nodes) {
    if (kindById.has(node.id)) problems.push(`duplicate node id "${node.id}"`);
    kindById.set(node.id, node.kind);
  }
  const domains = graph.nodes.filter((n) => n.kind === 'domain');
  if (domains.length !== 1)
    problems.push(`expected exactly 1 domain node, found ${domains.length}`);

  const parentsOf = new Map<string, string[]>();
  const prereqOut = new Map<string, string[]>();
  const related = new Set<string>();

  for (const { from, to, type } of graph.edges) {
    const fromKind = kindById.get(from);
    const toKind = kindById.get(to);
    if (!fromKind || !toKind) {
      problems.push(`edge ${from} -${type}-> ${to} references an unknown node`);
      continue;
    }
    if (from === to) {
      problems.push(`self-edge on "${from}"`);
      continue;
    }
    if (type === 'PART_OF') {
      const ok =
        (fromKind === 'concept' && toKind === 'topic') ||
        (fromKind === 'topic' && toKind === 'domain');
      if (!ok) problems.push(`PART_OF ${from} -> ${to} must be concept->topic or topic->domain`);
      parentsOf.set(from, [...(parentsOf.get(from) ?? []), to]);
    } else {
      if (fromKind !== 'concept' || toKind !== 'concept') {
        problems.push(`${type} ${from} -> ${to} must connect two concepts`);
      }
      if (type === 'PREREQUISITE_OF') prereqOut.set(from, [...(prereqOut.get(from) ?? []), to]);
      else related.add(`${from}|${to}`);
    }
  }

  for (const node of graph.nodes) {
    if (node.kind === 'domain') continue;
    const count = parentsOf.get(node.id)?.length ?? 0;
    if (count !== 1)
      problems.push(`${node.kind} "${node.id}" must be PART_OF exactly 1 parent, found ${count}`);
  }

  for (const pair of related) {
    const [a, b] = pair.split('|');
    if (!related.has(`${b}|${a}`)) problems.push(`RELATED_TO ${a} -> ${b} has no reverse edge`);
  }

  // Kahn's algorithm: whatever cannot be removed sits on a prerequisite cycle.
  const indegree = new Map<string, number>();
  for (const targets of prereqOut.values()) {
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  }
  const queue = graph.nodes
    .filter((n) => n.kind === 'concept' && !indegree.get(n.id))
    .map((n) => n.id);
  let removed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    removed++;
    for (const t of prereqOut.get(id) ?? []) {
      const left = (indegree.get(t) ?? 0) - 1;
      indegree.set(t, left);
      if (left === 0) queue.push(t);
    }
  }
  const concepts = graph.nodes.filter((n) => n.kind === 'concept').length;
  if (removed < concepts) problems.push('PREREQUISITE_OF edges contain a cycle');

  return problems;
}

/** The curriculum: concepts -> topics -> one domain. */
export const KnowledgeGraph = RawGraph.superRefine((graph, ctx) => {
  for (const message of graphProblems(graph)) ctx.addIssue({ code: 'custom', message });
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraph>;
