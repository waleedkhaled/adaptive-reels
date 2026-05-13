// Small lookups over the bundled curriculum graph, built once.
import type { GraphNode } from '@reels/schemas';
import { graph } from './library';

const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
const topicByConcept = new Map(
  graph.edges
    .filter((e) => e.type === 'PART_OF' && nodes.get(e.from)?.kind === 'concept')
    .map((e) => [e.from, e.to]),
);

export const topics: GraphNode[] = graph.nodes.filter((n) => n.kind === 'topic');

export function topicOf(conceptId: string): GraphNode {
  return nodes.get(topicByConcept.get(conceptId) ?? '') ?? topics[0]!;
}

export function topicShort(topicId: string): string {
  const n = nodes.get(topicId);
  return n?.short_title ?? n?.title ?? topicId;
}

export function conceptTitle(conceptId: string): string {
  return nodes.get(conceptId)?.title ?? conceptId;
}

const byTopic = new Map<string, string[]>();
for (const n of graph.nodes) {
  if (n.kind !== 'concept') continue;
  const t = topicByConcept.get(n.id);
  if (!t) continue;
  byTopic.set(t, [...(byTopic.get(t) ?? []), n.id]);
}

/** A topic's concepts in graph order (the map replaces this with the rail order in M6). */
export function topicConcepts(topicId: string): string[] {
  return byTopic.get(topicId) ?? [];
}

export const allConcepts: string[] = graph.nodes
  .filter((n) => n.kind === 'concept')
  .map((n) => n.id);

const prerequisites = new Map<string, string[]>();
const dependents = new Map<string, string[]>();
for (const e of graph.edges) {
  if (e.type !== 'PREREQUISITE_OF') continue;
  prerequisites.set(e.to, [...(prerequisites.get(e.to) ?? []), e.from]);
  dependents.set(e.from, [...(dependents.get(e.from) ?? []), e.to]);
}

/** Direct prerequisites of a concept (edges A PREREQUISITE_OF B give B's list A). */
export function prerequisitesOf(conceptId: string): string[] {
  return prerequisites.get(conceptId) ?? [];
}

export function dependentsOf(conceptId: string): string[] {
  return dependents.get(conceptId) ?? [];
}

export function conceptSummary(conceptId: string): string {
  return nodes.get(conceptId)?.summary ?? '';
}
