import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Angle, KnowledgeGraph, type GraphNode } from '@reels/schemas';
import { PATHS, REPO_ROOT } from './config';

export interface SourceCard {
  id: string;
  title: string;
  /** Repo-relative path, used in spec `sources[].ref`. */
  ref: string;
  text: string;
  facts: { n: number; text: string }[];
}

export interface Concept {
  node: GraphNode;
  topic: GraphNode;
  prerequisites: GraphNode[];
  card: SourceCard;
}

export interface Job {
  reelId: string;
  concept: Concept;
  angle: Angle;
}

export interface Content {
  graph: KnowledgeGraph;
  graphSha256: string;
  domainId: string;
  /** Concepts that have a source card, in prerequisite order. Only these get reels. */
  concepts: Concept[];
  /** Concept ids still waiting for a source card. */
  missingCards: string[];
}

export function parseSourceCard(conceptId: string, markdown: string, ref: string): SourceCard {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? conceptId;
  const facts = [...markdown.matchAll(/^(\d+)\.\s+(.+)$/gm)].map((m) => ({
    n: Number(m[1]),
    text: m[2]!.trim(),
  }));
  return {
    id: `card-${conceptId}`,
    title: `Source card: ${title}`,
    ref,
    text: markdown.trim(),
    facts,
  };
}

export function loadContent(dir: string = PATHS.content): Content {
  const raw = fs.readFileSync(path.join(dir, 'graph.json'), 'utf8');
  const graph = KnowledgeGraph.parse(JSON.parse(raw));
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const domainId = graph.nodes.find((n) => n.kind === 'domain')!.id;

  // Topological order over prerequisites, so foundational concepts come first.
  const concepts = graph.nodes.filter((n) => n.kind === 'concept');
  const prereqs = (id: string) =>
    graph.edges.filter((e) => e.type === 'PREREQUISITE_OF' && e.to === id).map((e) => e.from);
  const ordered: GraphNode[] = [];
  const placed = new Set<string>();
  while (ordered.length < concepts.length) {
    for (const c of concepts) {
      if (!placed.has(c.id) && prereqs(c.id).every((p) => placed.has(p))) {
        ordered.push(c);
        placed.add(c.id);
      }
    }
  }

  const withCards: Concept[] = [];
  const missingCards: string[] = [];
  for (const node of ordered) {
    const topicId = graph.edges.find((e) => e.type === 'PART_OF' && e.from === node.id)!.to;
    const file = path.join(dir, 'sources', `${node.id}.md`);
    if (!fs.existsSync(file)) {
      missingCards.push(node.id);
      continue;
    }
    withCards.push({
      node,
      topic: byId.get(topicId)!,
      prerequisites: prereqs(node.id).map((id) => byId.get(id)!),
      card: parseSourceCard(node.id, fs.readFileSync(file, 'utf8'), path.relative(REPO_ROOT, file)),
    });
  }

  return {
    graph,
    graphSha256: createHash('sha256').update(raw).digest('hex'),
    domainId,
    concepts: withCards,
    missingCards,
  };
}

/** Angle-major order: every concept's intro first, so `--limit 5` gives five different concepts. */
export function jobsFor(content: Content, filter?: { only?: string[]; limit?: number }): Job[] {
  let jobs = Angle.options.flatMap((angle) =>
    content.concepts.map((concept) => ({ reelId: `${concept.node.id}--${angle}`, concept, angle })),
  );
  if (filter?.only?.length)
    jobs = jobs.filter(
      (j) => filter.only!.includes(j.reelId) || filter.only!.includes(j.concept.node.id),
    );
  if (filter?.limit !== undefined) jobs = jobs.slice(0, filter.limit);
  return jobs;
}
