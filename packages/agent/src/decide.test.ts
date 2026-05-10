import {
  FeedItem as FeedItemSchema,
  type FeedItem,
  type LearnerState,
  type Pool,
} from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_POOL_WEIGHTS, MODE_CONFIG, POOLS } from './config';
import { computePools, decide, drawPool, guardFires, makeCtx } from './decide';
import { keyedRandom } from './random';
import { shown } from './queue';
import { createProfile, EMPTY_MASTERY } from './state';
import { fixtureCatalog } from './testing/fixtures';
import { persona, simulate } from './simulate';
import { realCatalog } from './testing/fixtures';

const NOW = 1_791_000_000_000;
const catalog = fixtureCatalog();

function profile(over: Partial<Parameters<typeof createProfile>[0]> = {}): LearnerState {
  return createProfile({ profileId: 'p', now: NOW, seed: 3, topicIds: ['alpha'], ...over });
}

/** Mark reels as shown in order (history, counters), as settles would. */
function showReels(state: LearnerState, reelIds: string[], now = NOW): LearnerState {
  let s = state;
  for (const id of reelIds) {
    const reel = catalog.reelById.get(id)!;
    const item: FeedItem = {
      kind: 'reel',
      key: `r${s.counters.reels}:${id}`,
      conceptId: reel.conceptId,
      reelId: id,
      angle: reel.angle,
      ordinal: s.counters.reels,
      durationMs: reel.durationMs,
      pool: null,
      reason: { code: 'FALLBACK', params: {} },
      source: 'feed',
      gap: null,
    };
    s = shown(s, catalog, item, now);
  }
  return s;
}

function learned(state: LearnerState, ids: string[], due = NOW + 3_600_000): LearnerState {
  const mastery = { ...state.mastery };
  const unlocked = { ...state.unlocked };
  for (const id of ids) {
    mastery[id] = {
      ...EMPTY_MASTERY,
      box: 2,
      due_at: due,
      scheduled_at: NOW - 1000,
      last_answered_at: NOW - 1000,
    };
  }
  for (const c of catalog.concepts) {
    if (!c.isRoot && c.prereqs.every((p) => (mastery[p]?.box ?? 0) >= 2))
      unlocked[c.id] ??= { at: NOW, by: c.prereqs.at(-1)! };
  }
  return { ...state, mastery, unlocked };
}

const ids = (cands: { concept: { id: string } }[]) => cands.map((c) => c.concept.id);

describe('pool membership (PLAN "Pools")', () => {
  it('fresh profile: Deepen = picked roots, Explore = all open roots, Lateral and Review empty', () => {
    const pools = computePools(makeCtx(profile(), catalog, NOW));
    expect(ids(pools.deepen)).toEqual(['a1']);
    expect(ids(pools.explore)).toEqual(['a1', 'b1', 'g1', 'g2']);
    expect(pools.explore.find((c) => c.concept.id === 'a1')!.score).toBeCloseTo(0.175);
    expect(pools.explore.find((c) => c.concept.id === 'b1')!.score).toBeCloseTo(0.075);
    expect(pools.lateral).toEqual([]);
    expect(pools.review).toEqual([]);
  });

  it('Deepen: unlocked by a Learned prerequisite scores +0.2 and says what unlocked it', () => {
    const pools = computePools(makeCtx(learned(profile(), ['a1']), catalog, NOW));
    const a2 = pools.deepen.find((c) => c.concept.id === 'a2')!;
    expect(a2.code).toBe('DEEPEN_UNLOCKED');
    expect(a2.params).toMatchObject({ prereq: 'a1' });
    expect(a2.score).toBeCloseTo(0.9);
    expect(ids(pools.deepen)).not.toContain('a1'); // Learned is not Deepen
  });

  it('Deepen: a started concept scores +0.1; the cause is watched, picked or default', () => {
    let s = profile();
    s = { ...s, exposure: { a1: { first_at: NOW, at_reel: 1, finished: ['a1--intro'] } } };
    const started = computePools(makeCtx(s, catalog, NOW)).deepen[0]!;
    expect(started.score).toBeCloseTo(0.8);
    expect(started.params.cause).toBe('picked');
    s = { ...s, interest: { ...s.interest, engaged_topics: ['alpha'] } };
    expect(computePools(makeCtx(s, catalog, NOW)).deepen[0]!.params.cause).toBe('watched');
    const skip = profile({ topicIds: [], skipped: true });
    expect(computePools(makeCtx(skip, catalog, NOW)).deepen.map((c) => c.params.cause)).toEqual([
      'default',
      'default',
      'default',
      'default',
    ]);
  });

  it('Explore: least-seen topic first; topics with 2 reels seen or interest 0.15 or less drop out', () => {
    let s = showReels(profile(), ['b1--intro', 'g1--intro', 'g1--example', 'a1--intro']);
    const explore = computePools(makeCtx(s, catalog, NOW)).explore;
    // gamma has 2 reels seen and a1 is the previous reel: only b1 (beta, 1 seen) is left.
    expect(ids(explore)).toEqual(['b1']);
    expect(explore[0]!.params.seen).toBe('1');
    s = { ...profile(), interest: { ...profile().interest, topic: { beta: 0.15 } } };
    expect(ids(computePools(makeCtx(s, catalog, NOW)).explore)).not.toContain('b1');
  });

  it('Lateral: neighbours of a liked reel; a locked neighbour becomes its bridge', () => {
    let s = showReels(profile(), ['a1--intro']);
    const history = s.session.history.map((e) => ({ ...e, action: 'more_like_this' as const }));
    s = { ...s, session: { ...s.session, history } };
    const lateral = computePools(makeCtx(s, catalog, NOW)).lateral;
    // a1 is related to b2, which is locked behind b1: the bridge is b1.
    expect(lateral).toHaveLength(1);
    expect(lateral[0]).toMatchObject({
      code: 'LATERAL_BRIDGE',
      params: { concept: 'b1', target: 'b2', source: 'a1' },
    });
    // Once b2 is open the neighbour itself is served.
    const open = learned(s, ['b1']);
    const direct = computePools(makeCtx(open, catalog, NOW)).lateral;
    expect(direct[0]).toMatchObject({
      code: 'LATERAL_RELATED',
      params: { concept: 'b2', source: 'a1' },
    });
  });

  it('Review: due reviews (box 0 retries included), most overdue relative to the interval first', () => {
    const s = {
      ...profile(),
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: NOW - 700_000,
          due_at: NOW - 100_000,
          last_answered_at: NOW - 700_000,
        },
        b1: {
          ...EMPTY_MASTERY,
          box: 0,
          retry: true,
          scheduled_at: NOW - 120_000,
          due_at: NOW - 60_000,
          last_answered_at: NOW - 120_000,
        },
        g1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: NOW,
          due_at: NOW + 600_000,
          last_answered_at: NOW,
        },
      },
    };
    expect(ids(computePools(makeCtx(s, catalog, NOW)).review)).toEqual(['b1', 'a1']);
  });
});

describe('filters on every pool', () => {
  it('no-repeat: not among the previous 2 reels (the third back is allowed)', () => {
    const s = showReels(profile({ skipped: true, topicIds: [] }), [
      'a1--intro',
      'b1--intro',
      'g1--intro',
    ]);
    const explore = ids(computePools(makeCtx(s, catalog, NOW)).explore);
    expect(explore).not.toContain('g1');
    expect(explore).not.toContain('b1');
    expect(explore).toContain('a1');
    expect(explore).toContain('g2');
  });

  it('no reel twice per session, hidden concepts excluded', () => {
    let s = showReels(profile(), [
      'a1--intro',
      'a1--example',
      'a1--pitfall',
      'g1--intro',
      'g2--intro',
    ]);
    expect(ids(computePools(makeCtx(s, catalog, NOW)).deepen)).toEqual([]);
    s = { ...profile(), session: { ...profile().session, hidden: ['a1'] } };
    const pools = computePools(makeCtx(s, catalog, NOW));
    expect([...ids(pools.deepen), ...ids(pools.explore)]).not.toContain('a1');
  });

  it('honesty gap: no reel while the review is due or due within 90 s', () => {
    const base = profile();
    const due = (ms: number) => ({
      ...base,
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: NOW - 60_000,
          due_at: NOW + ms,
          last_answered_at: NOW - 60_000,
        },
      },
    });
    expect(ids(computePools(makeCtx(due(90_000), catalog, NOW)).deepen)).toEqual([]);
    expect(ids(computePools(makeCtx(due(-1), catalog, NOW)).explore)).not.toContain('a1');
    expect(ids(computePools(makeCtx(due(90_001), catalog, NOW)).deepen)).toEqual(['a1']);
  });
});

describe('weighted draw', () => {
  it('renormalises over non-empty pools', () => {
    const w = DEFAULT_POOL_WEIGHTS.focus;
    expect(drawPool(w, ['deepen', 'explore'], 0.899)).toBe('deepen');
    expect(drawPool(w, ['deepen', 'explore'], 0.901)).toBe('explore');
    expect(drawPool(w, ['explore'], 0.999)).toBe('explore');
    expect(
      drawPool({ review: 0, deepen: 0, explore: 0, lateral: 0 }, ['lateral', 'deepen'], 0.6),
    ).toBe('deepen');
    expect(() => drawPool(w, [], 0.5)).toThrow();
  });

  for (const mode of ['light', 'focus'] as const) {
    it(`draws each pool within 2% of its ${mode} weight over 10k seeded slots`, () => {
      const counts: Record<Pool, number> = { review: 0, deepen: 0, explore: 0, lateral: 0 };
      for (let ordinal = 0; ordinal < 10_000; ordinal++) {
        counts[drawPool(MODE_CONFIG[mode].weights, POOLS, keyedRandom(11, 'pool', ordinal))]++;
      }
      for (const p of POOLS)
        expect(Math.abs(counts[p] / 10_000 - DEFAULT_POOL_WEIGHTS[mode][p])).toBeLessThan(0.02);
    });
  }

  it('through the slot procedure: Light draws all four pools in proportion', () => {
    // a1 liked (Lateral via bridge b1), a1 due in Light with nothing shown since (guard not yet), alpha picked (Deepen a1? a1 is due: honesty gap)
    let s = profile({ mode: 'light' });
    s = { ...s, interest: { ...s.interest, topic: { beta: 0.7 } } };
    s = {
      ...s,
      mastery: {
        g1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: NOW - 700_000,
          due_at: NOW - 100_000,
          last_answered_at: NOW - 700_000,
        },
      },
    };
    s = showReels(s, ['a1--intro']);
    s = {
      ...s,
      session: {
        ...s.session,
        history: s.session.history.map((e) => ({
          ...e,
          at: NOW - 200_000,
          action: 'more_like_this' as const,
        })),
      },
    };
    const pools = computePools(makeCtx(s, catalog, NOW));
    expect(POOLS.filter((p) => pools[p].length > 0)).toEqual([
      'review',
      'deepen',
      'explore',
      'lateral',
    ]);
    const counts: Record<string, number> = {};
    for (let ordinal = 0; ordinal < 4_000; ordinal++) {
      const item = decide({ ...s, counters: { ...s.counters, reels: ordinal } }, catalog, NOW);
      const key = item.pool ?? 'none';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    for (const p of POOLS)
      expect(Math.abs(counts[p]! / 4_000 - DEFAULT_POOL_WEIGHTS.light[p])).toBeLessThan(0.03);
  });
});

describe('the slot procedure', () => {
  const dueA1 = (s: LearnerState): LearnerState => ({
    ...s,
    mastery: {
      ...s.mastery,
      a1: {
        ...EMPTY_MASTERY,
        box: 1,
        scheduled_at: NOW - 700_000,
        due_at: NOW - 100_000,
        last_answered_at: NOW - 700_000,
        last_item_id: 'a1--intro--q1',
      },
    },
  });
  const exposedB1 = (s: LearnerState): LearnerState => ({
    ...s,
    exposure: {
      ...s.exposure,
      b1: { first_at: NOW - 50_000, at_reel: 0, finished: ['b1--intro'] },
    },
  });

  it('rule priority: reteach, prove-it, overdue guard, cadence, echo, change of pace, draw', () => {
    // Every rule applies at once; removing the winner each time reveals the next one.
    let s = exposedB1(dueA1(profile({ mode: 'focus' })));
    s = showReels(s, ['g1--intro', 'g2--intro']);
    s = {
      ...s,
      session: {
        ...s.session,
        history: s.session.history.map((e) => ({ ...e, signal: 'early_skip' as const })),
      },
    };
    s = {
      ...s,
      pending: {
        ...s.pending,
        reteach: { concept_id: 'b1', reel_id: 'b1--example', replay: false },
        prove_it: { concept_id: 'g1', from_reel_id: 'g1--intro' },
        echo: { concept_id: 'a5', key: 'k' },
      },
    };
    s = learned(s, []);
    const code = (state: LearnerState) => {
      const item = decide(state, catalog, NOW);
      return `${item.kind}:${item.reason?.code}`;
    };
    expect(code(s)).toBe('reel:RETEACH');
    s = { ...s, pending: { ...s.pending, reteach: null } };
    expect(code(s)).toBe('card:PROVE_IT');
    s = { ...s, pending: { ...s.pending, prove_it: null } };
    expect(code(s)).toBe('card:REVIEW_DUE');
    s = { ...s, mastery: {} };
    expect(code(s)).toBe('card:FIRST_CHECK');
    s = { ...s, session: { ...s.session, reels_since_card: 0 } };
    expect(code(s)).toBe('reel:MORE_LIKE_THIS');
    s = { ...s, pending: { ...s.pending, echo: null } };
    expect(code(s)).toBe('reel:CHANGE_OF_PACE');
    s = { ...s, session: { ...s.session, pace_used_key: s.session.history.at(-1)!.key } };
    expect(decide(s, catalog, NOW).pool).not.toBeNull();
  });

  it('cadence: due review first, else the oldest pending first check, at least one reel after exposure', () => {
    let s = exposedB1(profile({ mode: 'focus' }));
    s = showReels(s, ['g1--intro']);
    expect(decide(s, catalog, NOW).kind).toBe('reel'); // 1 reel since the last card
    s = showReels(s, ['g2--intro']);
    const card = decide(s, catalog, NOW);
    expect(card).toMatchObject({ kind: 'card', conceptId: 'b1', reason: { code: 'FIRST_CHECK' } });
    // Exposure in the last reel shown: not yet.
    const fresh = {
      ...profile({ mode: 'focus' }),
      exposure: { b1: { first_at: NOW, at_reel: 2, finished: ['b1--intro'] } },
    };
    expect(decide(showReels(fresh, ['g1--intro', 'g2--intro']), catalog, NOW).kind).toBe('reel');
  });

  it('change of pace fires once per pair of early skips', () => {
    let s = showReels(profile(), ['g1--intro', 'g2--intro']);
    s = {
      ...s,
      session: {
        ...s.session,
        history: s.session.history.map((e) => ({ ...e, signal: 'early_skip' as const })),
      },
    };
    const pace = decide(s, catalog, NOW);
    expect(pace).toMatchObject({
      kind: 'reel',
      pool: 'explore',
      reason: { code: 'CHANGE_OF_PACE', params: { trigger: 'skips' } },
    });
    const after = shown(s, catalog, pace, NOW);
    expect(decide(after, catalog, NOW).reason?.code).not.toBe('CHANGE_OF_PACE');
  });

  it('echo: nearest related concept, then siblings; survives an intervening card', () => {
    let s = learned(profile({ mode: 'focus' }), ['a1']);
    s = { ...s, pending: { ...s.pending, echo: { concept_id: 'a2', key: 'k' } } };
    // a2 has no RELATED_TO edge; its sibling (same prerequisite a1) is a5.
    expect(decide(s, catalog, NOW)).toMatchObject({
      conceptId: 'a5',
      reason: { code: 'MORE_LIKE_THIS', params: { source: 'a2' } },
    });
    // A due first check comes first (rule 4 outranks the echo); the echo follows it.
    let withCard = exposedB1(showReels(s, ['g1--intro', 'g2--intro']));
    withCard = {
      ...withCard,
      pending: { ...withCard.pending, echo: { concept_id: 'a2', key: 'k' } },
    };
    const card = decide(withCard, catalog, NOW);
    expect(card).toMatchObject({ kind: 'card', reason: { code: 'FIRST_CHECK' } });
    expect(decide(shown(withCard, catalog, card, NOW), catalog, NOW).reason?.code).toBe(
      'MORE_LIKE_THIS',
    );
    // Related first: with b1 Learned, a1's RELATED_TO neighbour b2 is open and wins.
    const related = {
      ...learned(profile(), ['b1']),
      pending: { ...profile().pending, echo: { concept_id: 'a1', key: 'k' } },
    };
    expect(decide(related, catalog, NOW)).toMatchObject({
      conceptId: 'b2',
      reason: { code: 'MORE_LIKE_THIS' },
    });
  });

  it('never returns nothing, even with every open concept hidden and every reel shown', () => {
    let s = profile();
    s = showReels(
      s,
      catalog.concepts.filter((c) => c.isRoot).flatMap((c) => c.reels.map((r) => r.id)),
    );
    s = { ...s, session: { ...s.session, hidden: ['a1', 'b1', 'g1', 'g2'] } };
    const item = decide(s, catalog, NOW, { reelOnly: true });
    expect(item).toMatchObject({ kind: 'reel', reason: { code: 'FALLBACK' }, pool: null });
  });

  it('an inserted card never moves a later reel pick', () => {
    const s = showReels(profile({ skipped: true, topicIds: [] }), ['a1--intro']);
    const a = decide(s, catalog, NOW);
    const b = decide(
      {
        ...s,
        counters: { ...s.counters, cards: 7 },
        items: { x: { shown: 3, answered_at: null } },
      },
      catalog,
      NOW,
    );
    expect(b).toEqual(a);
  });
});

describe('every item carries a reason and parses', () => {
  it('over simulated sessions on the real graph (personas x modes x clocks)', () => {
    const real = realCatalog();
    const codes = new Set<string>();
    for (const id of ['curious', 'skipper', 'struggler', 'too-easy', 'likes-ai-engineering']) {
      for (const mode of ['light', 'focus'] as const) {
        for (const clock of ['real', 'demo'] as const) {
          const run = simulate({
            catalog: real,
            persona: persona(id),
            mode,
            clock,
            seed: 5,
            start: NOW,
            slots: 30,
          });
          expect(run.rows.length).toBe(30);
          for (const row of run.rows) {
            expect(FeedItemSchema.safeParse(row.item).success).toBe(true);
            if (row.item.kind !== 'summary') {
              expect(row.item.reason.code).toBeTruthy();
              codes.add(row.item.reason.code);
            }
          }
        }
      }
    }
    expect([...codes].sort()).toEqual(
      expect.arrayContaining([
        'CHANGE_OF_PACE',
        'DEEPEN_INTEREST',
        'EXPLORE_NEW',
        'FALLBACK',
        'FIRST_CHECK',
        'MORE_LIKE_THIS',
        'PROVE_IT',
        'RETEACH',
        'REVIEW_DUE',
      ]),
    );
  });
});

describe('overdue guard (UX.md 9.2)', () => {
  it('Focus: the next slot after the item on screen at dueAt; Light: no later than the second', () => {
    const due = NOW + 5_000;
    const focus = showReels(profile({ mode: 'focus' }), ['g1--intro'], NOW); // on screen at dueAt
    expect(guardFires(makeCtx(focus, catalog, due), due)).toBe(true);
    const light = showReels(profile({ mode: 'light' }), ['g1--intro'], NOW);
    expect(guardFires(makeCtx(light, catalog, due), due)).toBe(false); // the first slot may be something else
    const lightLater = showReels(light, ['g2--intro'], due + 1_000); // one item shown after dueAt
    expect(guardFires(makeCtx(lightLater, catalog, due + 1_000), due)).toBe(true);
  });
});
