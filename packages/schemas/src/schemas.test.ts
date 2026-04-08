import { describe, expect, it } from 'vitest';
import graphFixture from '../fixtures/graph.valid.json';
import specFixture from '../fixtures/reel-spec.valid.json';
import {
  KnowledgeGraph,
  LearnerEvent,
  LearnerState,
  Manifest,
  ReelSpec,
  SCHEMA_VERSION,
} from './index';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function issues(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues.map((i) => i.message) ?? []);
}

describe('ReelSpec', () => {
  it('accepts the valid fixture', () => {
    expect(issues(ReelSpec.safeParse(specFixture))).toEqual([]);
  });

  it('rejects an out-of-range answer_index', () => {
    const spec = clone(specFixture);
    spec.retrieval_items[0]!.answer_index = 3;
    expect(issues(ReelSpec.safeParse(spec))).toContain('answer_index is out of range');
  });

  it('rejects duplicate choices', () => {
    const spec = clone(specFixture);
    spec.retrieval_items[0]!.choices = [
      'Toward the normal',
      'toward the normal ',
      'It does not bend',
    ];
    expect(issues(ReelSpec.safeParse(spec))).toContain('choices must be distinct');
  });

  it('rejects a claim citing an unknown source', () => {
    const spec = clone(specFixture);
    spec.key_claims[0]!.source_id = 'nowhere';
    expect(issues(ReelSpec.safeParse(spec))).toContain('unknown source "nowhere"');
  });

  it('rejects a retrieval item testing an unknown claim', () => {
    const spec = clone(specFixture);
    spec.retrieval_items[0]!.claim_ids = ['c9'];
    expect(issues(ReelSpec.safeParse(spec))).toContain('unknown claim "c9"');
  });

  it('rejects a reel_id that does not match concept and angle', () => {
    const spec = clone(specFixture);
    spec.angle = 'pitfall';
    expect(issues(ReelSpec.safeParse(spec))).toContain('reel_id must be <concept_id>--<angle>');
  });

  it('rejects reels longer than 60 seconds', () => {
    const spec = clone(specFixture);
    spec.target_duration_s = 75;
    expect(ReelSpec.safeParse(spec).success).toBe(false);
  });
});

describe('KnowledgeGraph', () => {
  type Edge = (typeof graphFixture.edges)[number];
  const withEdges = (edges: Edge[]) => ({ ...clone(graphFixture), edges });

  it('accepts the valid fixture', () => {
    expect(issues(KnowledgeGraph.safeParse(graphFixture))).toEqual([]);
  });

  it('rejects a prerequisite cycle', () => {
    const graph = withEdges([
      ...graphFixture.edges,
      { from: 'converging-lens', to: 'refractive-index', type: 'PREREQUISITE_OF' },
    ]);
    expect(issues(KnowledgeGraph.safeParse(graph))).toContain(
      'PREREQUISITE_OF edges contain a cycle',
    );
  });

  it('rejects a concept with no topic', () => {
    const graph = withEdges(
      graphFixture.edges.filter((e) => e.from !== 'converging-lens' || e.type !== 'PART_OF'),
    );
    expect(issues(KnowledgeGraph.safeParse(graph))).toContain(
      'concept "converging-lens" must be PART_OF exactly 1 parent, found 0',
    );
  });

  it('rejects a one-way RELATED_TO edge', () => {
    const graph = withEdges(
      graphFixture.edges.filter((e) => !(e.type === 'RELATED_TO' && e.from === 'converging-lens')),
    );
    expect(issues(KnowledgeGraph.safeParse(graph))).toContain(
      'RELATED_TO total-internal-reflection -> converging-lens has no reverse edge',
    );
  });

  it('rejects edges to unknown nodes', () => {
    const graph = withEdges([
      ...graphFixture.edges,
      { from: 'snells-law', to: 'ghost', type: 'PREREQUISITE_OF' },
    ]);
    expect(issues(KnowledgeGraph.safeParse(graph))).toContain(
      'edge snells-law -PREREQUISITE_OF-> ghost references an unknown node',
    );
  });
});

describe('Manifest', () => {
  const reel = {
    reel_id: 'snells-law--intro',
    concept_id: 'snells-law',
    angle: 'intro',
    difficulty: 1,
    url: 'reels/snells-law--intro.mp4',
    duration_s: 28.4,
    bytes: 2_400_000,
    sha256: 'a'.repeat(64),
    captions: [{ word: 'Why', start_ms: 0, end_ms: 180 }],
    retrieval_items: specFixture.retrieval_items,
  };
  const manifest = {
    schema_version: SCHEMA_VERSION,
    generated_at: 1_790_000_000_000,
    domain_id: 'optics',
    graph_sha256: 'b'.repeat(64),
    reels: [reel],
  };

  it('accepts a valid manifest', () => {
    expect(issues(Manifest.safeParse(manifest))).toEqual([]);
  });

  it('rejects duplicate reels', () => {
    expect(issues(Manifest.safeParse({ ...manifest, reels: [reel, reel] }))).toContain(
      'duplicate reel "snells-law--intro"',
    );
  });
});

describe('LearnerEvent', () => {
  const base = { id: 'e1', session_id: 's1', at: 1_790_000_000_000 };

  it('accepts a delayed review answer', () => {
    const event = {
      ...base,
      type: 'card_answered',
      item_id: 'snells-law--intro--q1',
      concept_id: 'snells-law',
      choice_index: 0,
      correct: true,
      latency_ms: 2_300,
      box_before: 1,
      box_after: 2,
      scheduled_gap_ms: 60_000,
      actual_gap_ms: 71_500,
      is_delayed: true,
    };
    expect(issues(LearnerEvent.safeParse(event))).toEqual([]);
  });

  it('defaults reason params on an impression', () => {
    const parsed = LearnerEvent.parse({
      ...base,
      type: 'reel_impression',
      reel_id: 'snells-law--intro',
      concept_id: 'snells-law',
      slot: 0,
      pool: 'explore',
      reason: { code: 'EXPLORE_NEW' },
    });
    expect(parsed.type === 'reel_impression' && parsed.reason.params).toEqual({});
  });

  it('rejects unknown event types', () => {
    expect(LearnerEvent.safeParse({ ...base, type: 'reel_liked' }).success).toBe(false);
  });
});

describe('LearnerState', () => {
  // The agent's state (packages/agent); more cases in learner-state.test.ts.
  it('accepts a fresh profile', () => {
    const state = {
      schema_version: SCHEMA_VERSION,
      profile_id: 'local',
      created_at: 1_790_000_000_000,
      seed: 14,
      sample: null,
      settings: { mode: 'focus', clock: 'demo', mode_before_demo: 'light' },
      onboarding: { topic_ids: ['react-native'], skipped: false },
      interest: { topic: {}, concept_offset: {}, engaged_topics: [] },
      mastery: {},
      exposure: {},
      unlocked: {},
      reels: {},
      items: {},
      topic_reels: {},
      counters: { reels: 0, cards: 0, summaries: 0 },
      session: {
        index: 0,
        started_at: 1_790_000_000_000,
        last_active_at: 1_790_000_000_000,
        hidden: [],
        shown_reels: [],
        history: [],
        reels: 0,
        reels_since_card: 0,
        items_since_summary: 0,
        cards_answered: 0,
        cards_correct: 0,
        checked: [],
        learned: [],
        exhausted_summary: false,
        pace_used_key: null,
      },
      pending: {
        reteach: null,
        prove_it: null,
        echo: null,
        pitfall_next: [],
        deferred: [],
        awaiting: [],
      },
      queue: { active: null, committed: null, upcoming: [] },
      undo: null,
      map_seen: null,
      gap: null,
    };
    expect(issues(LearnerState.safeParse(state))).toEqual([]);
  });
});
