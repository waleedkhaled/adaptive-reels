import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './common';
import { FeedItem, LearnerState } from './learner-state';

const T = 1_790_000_000_000;

function fresh() {
  return {
    schema_version: SCHEMA_VERSION,
    profile_id: 'local',
    created_at: T,
    seed: 14,
    sample: null,
    settings: { mode: 'light', clock: 'real', mode_before_demo: null },
    onboarding: { topic_ids: [], skipped: true },
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
      started_at: T,
      last_active_at: T,
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
}

const reel = {
  kind: 'reel',
  key: 'r0:caching--intro',
  conceptId: 'caching',
  reelId: 'caching--intro',
  angle: 'intro',
  ordinal: 0,
  durationMs: 29_800,
  pool: 'explore',
  reason: { code: 'EXPLORE_NEW', params: { topic: 'systems-design', seen: '0' } },
  source: 'feed',
  gap: null,
};

describe('LearnerState schema', () => {
  it('accepts a fresh profile and one with mastery, exposure and a queue', () => {
    expect(LearnerState.safeParse(fresh()).success).toBe(true);
    const state = {
      ...fresh(),
      mastery: {
        caching: {
          box: 1,
          due_at: T + 60_000,
          scheduled_at: T,
          retry: false,
          last_answered_at: T,
          correct_count: 1,
          wrong_count: 0,
          last_item_id: 'caching--intro--q1',
        },
      },
      exposure: { caching: { first_at: T, at_reel: 1, finished: ['caching--intro'] } },
      queue: {
        active: reel,
        committed: {
          ...reel,
          key: 'r1:caching--example',
          reelId: 'caching--example',
          angle: 'example',
          ordinal: 1,
        },
        upcoming: [],
      },
    };
    expect(LearnerState.safeParse(state).success).toBe(true);
  });

  it('rejects out-of-range values', () => {
    const bad = (patch: object) => LearnerState.safeParse({ ...fresh(), ...patch }).success;
    expect(bad({ settings: { mode: 'turbo', clock: 'real', mode_before_demo: null } })).toBe(false);
    expect(
      bad({
        interest: { topic: { 'ai-engineering': 1.2 }, concept_offset: {}, engaged_topics: [] },
      }),
    ).toBe(false);
    expect(bad({ counters: { reels: -1, cards: 0, summaries: 0 } })).toBe(false);
    expect(bad({ seed: 1.5 })).toBe(false);
  });
});

describe('FeedItem schema', () => {
  it('accepts reels, cards with 3 or 4 options, and summaries without a reason', () => {
    expect(FeedItem.safeParse(reel).success).toBe(true);
    const card = {
      kind: 'card',
      key: 'c0:caching--intro--q1',
      conceptId: 'caching',
      itemId: 'caching--intro--q1',
      reelId: 'caching--intro',
      ordinal: 0,
      box: 0,
      options: [2, 0, 3],
      proveIt: false,
      retry: false,
      pool: null,
      reason: { code: 'FIRST_CHECK', params: { concept: 'caching', reels_ago: '2' } },
      source: 'feed',
      gap: null,
    };
    expect(FeedItem.safeParse(card).success).toBe(true);
    expect(FeedItem.safeParse({ ...card, options: [0, 1] }).success).toBe(false);
    expect(FeedItem.safeParse({ ...card, reason: { code: 'NOPE', params: {} } }).success).toBe(
      false,
    );
    const summary = {
      kind: 'summary',
      key: 's0',
      conceptId: null,
      pool: null,
      reason: null,
      source: 'feed',
      ordinal: 0,
      trigger: 'count',
      summary: {
        reelsWatched: 9,
        questionsAnswered: 3,
        correct: 2,
        checkedIds: [],
        learnedIds: [],
        nextReviewAt: null,
      },
    };
    expect(FeedItem.safeParse(summary).success).toBe(true);
  });
});
