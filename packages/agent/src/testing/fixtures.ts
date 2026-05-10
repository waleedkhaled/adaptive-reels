// Test fixtures (docs/PLAN.md "Test plan"). Pure data builders: no Node APIs.
import {
  KnowledgeGraph,
  Manifest,
  SCHEMA_VERSION,
  type Angle,
  type ManifestReel,
} from '@reels/schemas';
import realGraphJson from '../../../../content/software-engineering/graph.json';
import { buildCatalog, type Catalog } from '../catalog';

const SHA = '0'.repeat(64);
const ANGLES: readonly Angle[] = ['intro', 'example', 'pitfall'];

type Edge = { from: string; to: string; type: 'PREREQUISITE_OF' | 'PART_OF' | 'RELATED_TO' };

/**
 * 12 concepts in 3 topics:
 * - alpha: a1 -> a2 -> a3 -> a4 (a depth-3 chain), a1 -> a5
 * - beta: the diamond b1 -> b2, b1 -> b3, b2 + b3 -> b4
 * - gamma: g1 (isolated root: no edge but PART_OF), g2 -> g3, plus a cross-topic a2 -> g3
 * - RELATED_TO across topics: a1-b2 (b2 locked: bridge b1), a3-g2, b4-g3, a5-b1
 */
export function fixtureGraph(): KnowledgeGraph {
  const topics = ['alpha', 'beta', 'gamma'];
  const concepts: [string, string][] = [
    ['a1', 'alpha'],
    ['a2', 'alpha'],
    ['a3', 'alpha'],
    ['a4', 'alpha'],
    ['a5', 'alpha'],
    ['b1', 'beta'],
    ['b2', 'beta'],
    ['b3', 'beta'],
    ['b4', 'beta'],
    ['g1', 'gamma'],
    ['g2', 'gamma'],
    ['g3', 'gamma'],
  ];
  const prereq: [string, string][] = [
    ['a1', 'a2'],
    ['a2', 'a3'],
    ['a3', 'a4'],
    ['a1', 'a5'],
    ['b1', 'b2'],
    ['b1', 'b3'],
    ['b2', 'b4'],
    ['b3', 'b4'],
    ['g2', 'g3'],
    ['a2', 'g3'],
  ];
  const related: [string, string][] = [
    ['a1', 'b2'],
    ['a3', 'g2'],
    ['b4', 'g3'],
    ['a5', 'b1'],
  ];
  const edges: Edge[] = [
    ...topics.map((t) => ({ from: t, to: 'fixture', type: 'PART_OF' as const })),
    ...concepts.map(([c, t]) => ({ from: c, to: t, type: 'PART_OF' as const })),
    ...prereq.map(([from, to]) => ({ from, to, type: 'PREREQUISITE_OF' as const })),
    ...related.flatMap(([a, b]) => [
      { from: a, to: b, type: 'RELATED_TO' as const },
      { from: b, to: a, type: 'RELATED_TO' as const },
    ]),
  ];
  return KnowledgeGraph.parse({
    schema_version: SCHEMA_VERSION,
    nodes: [
      { id: 'fixture', kind: 'domain', title: 'Fixture', summary: 'Fixture domain.' },
      ...topics.map((t) => ({
        id: t,
        kind: 'topic',
        title: `Topic ${t}`,
        short_title: t[0]?.toUpperCase() + t.slice(1),
        summary: `Topic ${t}.`,
      })),
      ...concepts.map(([c]) => ({
        id: c,
        kind: 'concept',
        title: `Concept ${c.toUpperCase()}`,
        summary: `Concept ${c}.`,
      })),
    ],
    edges,
  });
}

function reel(
  conceptId: string,
  angle: Angle,
  durationS: number,
  itemsPerReel: number,
): ManifestReel {
  const reelId = `${conceptId}--${angle}`;
  return {
    reel_id: reelId,
    concept_id: conceptId,
    angle,
    difficulty: 1,
    url: `reels/${reelId}.mp4`,
    duration_s: durationS,
    bytes: 1_000_000,
    sha256: SHA,
    captions: [],
    retrieval_items: Array.from({ length: itemsPerReel }, (_, i) => ({
      id: `${reelId}--q${i + 1}`,
      type: 'mcq' as const,
      prompt: `Question ${i + 1} on ${reelId}?`,
      choices: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'],
      answer_index: 0,
      explanation: 'Because.',
      claim_ids: ['c1'],
    })),
  };
}

export interface ManifestOptions {
  itemsPerReel?: number;
  /** Seconds per reel id; default 30. */
  durations?: Readonly<Record<string, number>>;
  /** Reel ids to leave out (e.g. the one rejected reel of the real library). */
  missing?: readonly string[];
}

/** 3 reels per concept (intro, example, pitfall), 4 choices per item, answer A. */
export function manifestFor(graph: KnowledgeGraph, opts: ManifestOptions = {}): Manifest {
  const missing = new Set(opts.missing ?? []);
  const reels = graph.nodes
    .filter((n) => n.kind === 'concept')
    .flatMap((n) =>
      ANGLES.map((a) =>
        reel(n.id, a, opts.durations?.[`${n.id}--${a}`] ?? 30, opts.itemsPerReel ?? 1),
      ),
    )
    .filter((r) => !missing.has(r.reel_id));
  return Manifest.parse({
    schema_version: SCHEMA_VERSION,
    generated_at: 1_790_000_000_000,
    domain_id: graph.nodes.find((n) => n.kind === 'domain')?.id ?? 'domain',
    graph_sha256: SHA,
    reels,
  });
}

/** Fixture graph + manifest with 3 reels and 3 retrieval items per concept (PLAN "Test plan"). */
export function fixtureCatalog(opts: ManifestOptions = {}): Catalog {
  const graph = fixtureGraph();
  return buildCatalog(graph, manifestFor(graph, opts));
}

export function realGraph(): KnowledgeGraph {
  return KnowledgeGraph.parse(realGraphJson);
}

/** The demo's four reel durations (UX.md section 7). */
export const DEMO_DURATIONS: Readonly<Record<string, number>> = {
  'rn-core-components--intro': 28.8,
  'react-components-props--intro': 30.4,
  'tokens-context-windows--intro': 31.0,
  'caching--intro': 29.8,
};

/** The real curriculum with a synthetic manifest: 119 reels, 2 items per reel, like the library. */
export function realCatalog(opts: ManifestOptions = {}): Catalog {
  const graph = realGraph();
  return buildCatalog(
    graph,
    manifestFor(graph, {
      itemsPerReel: 2,
      durations: DEMO_DURATIONS,
      missing: ['llm-unreliable-dependency--example'],
      ...opts,
    }),
  );
}
