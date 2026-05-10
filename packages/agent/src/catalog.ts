// buildCatalog: lookup indices over the graph and the manifest, built once
// (PERFORMANCE.md agent budget), plus the rail order of UX.md 3.5.
import type { Angle, KnowledgeGraph, Manifest } from '@reels/schemas';
import { RAIL_TOPIC_LABELS } from './config';
import { AgentError } from './errors';

export const ANGLE_ORDER: readonly Angle[] = ['intro', 'example', 'pitfall'];

export interface ItemInfo {
  id: string;
  reelId: string;
  conceptId: string;
  angle: Angle;
  choiceCount: number;
  answerIndex: number;
}

export interface ReelInfo {
  id: string;
  conceptId: string;
  angle: Angle;
  durationMs: number;
  difficulty: number;
  /** Retrieval items in authored order. */
  items: readonly ItemInfo[];
}

/** One rail row (UX.md 3.5 "Order"). */
export interface RailRow {
  conceptId: string;
  /** Indent level; 0 for roots and for concepts with only cross-topic prerequisites. */
  level: number;
  /** The in-topic prerequisite placed last, under which this row sits. */
  parentId: string | null;
  /** "+ needs" lines: other prerequisites that are not ancestors of the parent. */
  needs: readonly string[];
  /** Other prerequisites implied because they are ancestors of the parent. */
  implied: readonly string[];
  /** Level 0 with only cross-topic prerequisites: drawn with a dashed inbound stub. */
  stub: boolean;
}

export interface TopicInfo {
  id: string;
  index: number;
  title: string;
  /** Short name for tight places ("React + TS"); the title when the graph has none. */
  shortTitle: string;
  /** Name in a rail "+ needs" line ("AI" for AI engineering). */
  railLabel: string;
  /** Concept ids in rail order. */
  conceptIds: readonly string[];
  rail: readonly RailRow[];
}

export interface ConceptInfo {
  id: string;
  /** Position among the concepts in graph.json node order. */
  index: number;
  title: string;
  summary: string;
  topicId: string;
  /** Direct prerequisites, node order. */
  prereqs: readonly string[];
  /** Direct dependents, node order. */
  dependents: readonly string[];
  /** RELATED_TO neighbours, de-duplicated, node order. */
  related: readonly string[];
  /** Transitive prerequisites. */
  ancestors: ReadonlySet<string>;
  isRoot: boolean;
  /** Reels present in the manifest, in angle order (intro, example, pitfall). */
  reels: readonly ReelInfo[];
  /** Position in the global rail order (topics in node order, rails within). */
  railIndex: number;
}

export interface Catalog {
  domainId: string;
  topics: readonly TopicInfo[];
  /** Concepts in graph.json node order. */
  concepts: readonly ConceptInfo[];
  topicById: ReadonlyMap<string, TopicInfo>;
  conceptById: ReadonlyMap<string, ConceptInfo>;
  reelById: ReadonlyMap<string, ReelInfo>;
  itemById: ReadonlyMap<string, ItemInfo>;
  /** Reels usable by the agent (manifest reels whose concept is in the graph). */
  reelCount: number;
  /** Manifest entries that were skipped, e.g. a reel of an unknown concept. */
  problems: readonly string[];
}

/** Build the lookup indices once per graph and manifest. */
export function buildCatalog(graph: KnowledgeGraph, manifest: Manifest): Catalog {
  const problems: string[] = [];
  const domain = graph.nodes.find((n) => n.kind === 'domain');
  const topicNodes = graph.nodes.filter((n) => n.kind === 'topic');
  const conceptNodes = graph.nodes.filter((n) => n.kind === 'concept');
  const conceptIndex = new Map(conceptNodes.map((n, i) => [n.id, i]));
  const byNodeOrder = (a: string, b: string) =>
    (conceptIndex.get(a) ?? 0) - (conceptIndex.get(b) ?? 0);

  const parentOf = new Map<string, string>();
  const prereqs = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const related = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(value);
  };
  for (const edge of graph.edges) {
    if (edge.type === 'PART_OF') parentOf.set(edge.from, edge.to);
    else if (edge.type === 'PREREQUISITE_OF') {
      add(prereqs, edge.to, edge.from);
      add(dependents, edge.from, edge.to);
    } else {
      add(related, edge.from, edge.to);
      add(related, edge.to, edge.from);
    }
  }
  const sorted = (set: Set<string> | undefined) => [...(set ?? [])].sort(byNodeOrder);

  const ancestorCache = new Map<string, Set<string>>();
  const ancestorsOf = (id: string, stack: Set<string> = new Set()): Set<string> => {
    const cached = ancestorCache.get(id);
    if (cached) return cached;
    if (stack.has(id)) throw new AgentError(`prerequisite cycle at "${id}"`);
    stack.add(id);
    const out = new Set<string>();
    for (const p of prereqs.get(id) ?? []) {
      out.add(p);
      for (const a of ancestorsOf(p, stack)) out.add(a);
    }
    stack.delete(id);
    ancestorCache.set(id, out);
    return out;
  };

  // Reels and items from the manifest, grouped by concept.
  const reelById = new Map<string, ReelInfo>();
  const itemById = new Map<string, ItemInfo>();
  const reelsOf = new Map<string, ReelInfo[]>();
  for (const reel of manifest.reels) {
    if (!conceptIndex.has(reel.concept_id)) {
      problems.push(`reel "${reel.reel_id}" has unknown concept "${reel.concept_id}"`);
      continue;
    }
    const items = reel.retrieval_items.map((item) => ({
      id: item.id,
      reelId: reel.reel_id,
      conceptId: reel.concept_id,
      angle: reel.angle,
      choiceCount: item.choices.length,
      answerIndex: item.answer_index,
    }));
    const info: ReelInfo = {
      id: reel.reel_id,
      conceptId: reel.concept_id,
      angle: reel.angle,
      durationMs: Math.round(reel.duration_s * 1000),
      difficulty: reel.difficulty,
      items,
    };
    reelById.set(info.id, info);
    for (const item of items) itemById.set(item.id, item);
    const list = reelsOf.get(reel.concept_id) ?? [];
    list.push(info);
    reelsOf.set(reel.concept_id, list);
  }

  const concepts: ConceptInfo[] = conceptNodes.map((node, index) => ({
    id: node.id,
    index,
    title: node.title,
    summary: node.summary,
    topicId: parentOf.get(node.id) ?? '',
    prereqs: sorted(prereqs.get(node.id)),
    dependents: sorted(dependents.get(node.id)),
    related: sorted(related.get(node.id)),
    ancestors: ancestorsOf(node.id),
    isRoot: (prereqs.get(node.id)?.size ?? 0) === 0,
    reels: (reelsOf.get(node.id) ?? []).sort(
      (a, b) => ANGLE_ORDER.indexOf(a.angle) - ANGLE_ORDER.indexOf(b.angle),
    ),
    railIndex: 0,
  }));
  const conceptById = new Map(concepts.map((c) => [c.id, c]));

  let railIndex = 0;
  const topics: TopicInfo[] = topicNodes.map((node, index) => {
    const members = concepts.filter((c) => c.topicId === node.id);
    const rail = buildRail(members, conceptById);
    for (const row of rail) {
      const concept = conceptById.get(row.conceptId);
      if (concept) concept.railIndex = railIndex++;
    }
    const shortTitle = node.short_title ?? node.title;
    return {
      id: node.id,
      index,
      title: node.title,
      shortTitle,
      railLabel: RAIL_TOPIC_LABELS[node.id] ?? shortTitle,
      conceptIds: rail.map((r) => r.conceptId),
      rail,
    };
  });

  return {
    domainId: domain?.id ?? manifest.domain_id,
    topics,
    concepts,
    topicById: new Map(topics.map((t) => [t.id, t])),
    conceptById,
    reelById,
    itemById,
    reelCount: reelById.size,
    problems,
  };
}

/**
 * UX.md 3.5 "Order": depth-first pre-order from the topic's roots, roots and
 * children in graph.json node order. A concept goes under whichever of its
 * in-topic prerequisites is placed last; a concept with only cross-topic
 * prerequisites goes last at level 0.
 */
function buildRail(
  members: readonly ConceptInfo[],
  byId: ReadonlyMap<string, ConceptInfo>,
): RailRow[] {
  const inTopic = new Set(members.map((c) => c.id));
  const placed = new Set<string>();
  const rows: { conceptId: string; level: number; parentId: string | null }[] = [];
  const visit = (id: string, level: number, parentId: string | null) => {
    placed.add(id);
    rows.push({ conceptId: id, level, parentId });
    for (const child of byId.get(id)?.dependents ?? []) {
      if (!inTopic.has(child) || placed.has(child)) continue;
      const inTopicPrereqs = (byId.get(child)?.prereqs ?? []).filter((p) => inTopic.has(p));
      if (inTopicPrereqs.every((p) => placed.has(p))) visit(child, level + 1, id);
    }
  };
  for (const c of members) if (c.prereqs.length === 0 && !placed.has(c.id)) visit(c.id, 0, null);
  for (const c of members) {
    if (!placed.has(c.id) && c.prereqs.every((p) => !inTopic.has(p))) visit(c.id, 0, null);
  }
  // Unreachable for a valid DAG; kept so a bad graph still lists every concept.
  for (const c of members) if (!placed.has(c.id)) visit(c.id, 0, null);

  return rows.map(({ conceptId, level, parentId }) => {
    const concept = byId.get(conceptId);
    const others = (concept?.prereqs ?? []).filter((p) => p !== parentId);
    const parentAncestors = parentId ? (byId.get(parentId)?.ancestors ?? new Set()) : new Set();
    return {
      conceptId,
      level,
      parentId,
      needs: others.filter((p) => !parentAncestors.has(p)),
      implied: others.filter((p) => parentAncestors.has(p)),
      stub: parentId === null && (concept?.prereqs.length ?? 0) > 0,
    };
  });
}

/** Rail rows of a topic (UX.md 3.5): tile n is row n. */
export function railOrder(topicId: string, catalog: Catalog): readonly RailRow[] {
  return topicOf(catalog, topicId).rail;
}

export function conceptOf(catalog: Catalog, id: string): ConceptInfo {
  const concept = catalog.conceptById.get(id);
  if (!concept) throw new AgentError(`unknown concept "${id}"`);
  return concept;
}

export function topicOf(catalog: Catalog, id: string): TopicInfo {
  const topic = catalog.topicById.get(id);
  if (!topic) throw new AgentError(`unknown topic "${id}"`);
  return topic;
}
