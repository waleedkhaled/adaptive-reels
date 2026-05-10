import type { ConceptMastery } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { INTERVALS } from './config';
import { classifyWatch } from './interest';
import { applyAnswerRule, nextDueAt, opensCount, rescaleDue } from './mastery';
import { createProfile, EMPTY_MASTERY, interestOf, intervalMs, topicInterest } from './state';
import { fixtureCatalog, realCatalog } from './testing/fixtures';

const NOW = 1_791_000_000_000;
const MIN = 60_000;

function at(box: number, dueIn: number | null): ConceptMastery {
  return {
    ...EMPTY_MASTERY,
    box,
    due_at: dueIn === null ? null : NOW + dueIn,
    scheduled_at: dueIn === null ? null : NOW + dueIn - 10 * MIN,
    last_answered_at: dueIn === null ? null : NOW + dueIn - 10 * MIN,
  };
}

describe('mastery table (PLAN "Mastery"): (box, correct, early or on time)', () => {
  // [box before, due in (ms from now; null = never answered), correct, box after, due interval key, early]
  const rows: [number, number | null, boolean, number, 'retry' | number | 'same', boolean][] = [
    [0, null, true, 1, 1, false], // first check
    [0, null, false, 0, 'retry', false],
    [0, 5_000, true, 1, 1, false], // re-check before the retry is due still counts at box 0
    [0, -5_000, false, 0, 'retry', false],
    [1, -1_000, true, 2, 2, false], // delayed correct: Learned
    [1, 30_000, true, 1, 'same', true], // correct before dueAt: no promotion, due unchanged
    [1, -1_000, false, 0, 'retry', false], // lapse
    [1, 30_000, false, 0, 'retry', false], // wrong drops a box whenever it comes
    [2, 0, true, 3, 3, false], // exactly at dueAt counts
    [2, 60_000, true, 2, 'same', true],
    [2, -1_000, false, 1, 'retry', false],
    [3, -1_000, true, 4, 4, false],
    [4, -1_000, true, 4, 4, false], // box 4 stays 4 and reschedules
    [4, -1_000, false, 3, 'retry', false],
  ];
  for (const clock of ['real', 'demo'] as const) {
    for (const [box, dueIn, correct, after, interval, early] of rows) {
      it(`${clock}: box ${box}, ${dueIn === null ? 'first' : dueIn > 0 ? 'early' : 'on time'}, ${correct ? 'correct' : 'wrong'} -> box ${after}`, () => {
        const prev = at(box, dueIn);
        const out = applyAnswerRule(prev, {
          correct,
          now: NOW,
          clock,
          proveIt: false,
          itemId: 'q',
        });
        expect(out.mastery.box).toBe(after);
        expect(out.early).toBe(early);
        if (interval === 'same') expect(out.mastery.due_at).toBe(prev.due_at);
        else if (interval === 'retry') {
          expect(out.mastery.due_at).toBe(NOW + INTERVALS[clock].retryMs);
          expect(out.mastery.retry).toBe(true);
        } else {
          expect(out.mastery.due_at).toBe(NOW + INTERVALS[clock].boxMs[interval]!);
          expect(out.mastery.retry).toBe(false);
        }
        expect(out.mastery.last_answered_at).toBe(NOW);
        expect(out.mastery.last_item_id).toBe('q');
      });
    }
  }

  it('a prove-it card reaches Checked at most', () => {
    const fromSeen = applyAnswerRule(at(0, null), {
      correct: true,
      now: NOW,
      clock: 'demo',
      proveIt: true,
      itemId: 'q',
    });
    expect(fromSeen.mastery.box).toBe(1);
    const due = at(1, -1_000);
    const fromChecked = applyAnswerRule(due, {
      correct: true,
      now: NOW,
      clock: 'demo',
      proveIt: true,
      itemId: 'q',
    });
    expect(fromChecked.mastery.box).toBe(1);
    expect(fromChecked.early).toBe(true);
    const wrong = applyAnswerRule(at(2, 60_000), {
      correct: false,
      now: NOW,
      clock: 'demo',
      proveIt: true,
      itemId: 'q',
    });
    expect(wrong.mastery.box).toBe(1);
  });

  it('uses both interval tables', () => {
    expect([1, 2, 3, 4].map((b) => intervalMs('real', b, false))).toEqual([
      10 * MIN,
      1440 * MIN,
      3 * 1440 * MIN,
      7 * 1440 * MIN,
    ]);
    expect([1, 2, 3, 4].map((b) => intervalMs('demo', b, false))).toEqual([
      MIN,
      3 * MIN,
      6 * MIN,
      12 * MIN,
    ]);
    expect(intervalMs('real', 2, true)).toBe(MIN);
    expect(intervalMs('demo', 0, true)).toBe(20_000);
  });

  it('rescales pending due times on a clock switch, counted from the scheduling answer', () => {
    let state = createProfile({ profileId: 'p', now: NOW, seed: 1, clock: 'demo' });
    state = {
      ...state,
      mastery: {
        a: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: NOW,
          due_at: NOW + MIN,
          last_answered_at: NOW,
        },
        b: {
          ...EMPTY_MASTERY,
          box: 0,
          retry: true,
          scheduled_at: NOW,
          due_at: NOW + 20_000,
          last_answered_at: NOW,
        },
        c: {
          ...EMPTY_MASTERY,
          box: 2,
          scheduled_at: NOW,
          due_at: NOW + 3 * MIN,
          last_answered_at: NOW,
        },
      },
    };
    const real = rescaleDue(state, 'real');
    expect(real.changed).toEqual(['a', 'b', 'c']);
    expect(real.mastery.a!.due_at).toBe(NOW + 10 * MIN);
    expect(real.mastery.b!.due_at).toBe(NOW + MIN);
    expect(real.mastery.c!.due_at).toBe(NOW + 1440 * MIN);
    expect(rescaleDue({ ...state, mastery: real.mastery }, 'demo').mastery).toEqual(state.mastery);
    expect(rescaleDue(state, 'demo').changed).toEqual([]);
  });

  it('nextDueAt is the earliest future due time', () => {
    const state = {
      ...createProfile({ profileId: 'p', now: NOW, seed: 1 }),
      mastery: { a: at(1, -5_000), b: at(1, 40_000), c: at(2, 20_000) },
    };
    expect(nextDueAt(state, NOW)).toBe(NOW + 20_000);
    expect(nextDueAt(state, NOW + 30_000)).toBe(NOW + 40_000);
    expect(nextDueAt(state, NOW + 50_000)).toBeNull();
  });

  it('counts the concepts a concept opens (UX.md 3.5: Core components 6, Tokens 3 of 4)', () => {
    const catalog = realCatalog();
    const state = createProfile({ profileId: 'p', now: NOW, seed: 1 });
    expect(opensCount(state, catalog, 'rn-core-components')).toBe(6);
    expect(opensCount(state, catalog, 'tokens-context-windows')).toBe(3);
    expect(catalog.conceptById.get('tokens-context-windows')!.dependents).toHaveLength(4);
  });
});

describe('watch signals (PLAN "Interest", PERFORMANCE.md 2.6)', () => {
  const d = 30_000;
  it.each([
    [27_000, 0, 'completed', 'completed', true],
    [26_999, 0, 'partial', 'partial', true],
    [4_999, 0, 'early_skip', 'early_skip', false],
    [5_000, 0, 'partial', 'partial', true],
    [45_000, 1, 'completed', 'rewatch', true],
    [44_999, 1, 'completed', 'completed', true],
    [31_000, 1, 'completed', 'completed', true],
  ] as const)(
    '%i ms with %i loops: %s, signal %s',
    (watchedMs, loops, outcome, signal, exposed) => {
      expect(classifyWatch({ watchedMs, durationMs: d, loops, endedBy: 'swipe' })).toEqual({
        outcome,
        signal,
        exposed,
      });
    },
  );

  it('uses min(25%, 5 s) for an early skip of a short reel', () => {
    expect(
      classifyWatch({ watchedMs: 2_400, durationMs: 10_000, loops: 0, endedBy: 'swipe' }).outcome,
    ).toBe('early_skip');
    expect(
      classifyWatch({ watchedMs: 2_600, durationMs: 10_000, loops: 0, endedBy: 'swipe' }).outcome,
    ).toBe('partial');
  });

  it('skip_failed and blur change no interest; blur still exposes by position', () => {
    expect(
      classifyWatch({ watchedMs: 0, durationMs: d, loops: 0, endedBy: 'skip_failed' }),
    ).toEqual({ outcome: 'partial', signal: 'none', exposed: false });
    expect(classifyWatch({ watchedMs: 20_000, durationMs: d, loops: 0, endedBy: 'blur' })).toEqual({
      outcome: 'partial',
      signal: 'none',
      exposed: true,
    });
    expect(classifyWatch({ watchedMs: 1_000, durationMs: d, loops: 0, endedBy: 'blur' })).toEqual({
      outcome: 'partial',
      signal: 'none',
      exposed: false,
    });
  });
});

describe('interest priors (UX.md 3.1)', () => {
  const catalog = fixtureCatalog();
  it('picked 0.7, others 0.3; Skip 0.5 everywhere; I(c) adds the concept offset', () => {
    const picked = createProfile({ profileId: 'p', now: NOW, seed: 1, topicIds: ['alpha'] });
    expect(topicInterest(picked, 'alpha')).toBe(0.7);
    expect(topicInterest(picked, 'beta')).toBe(0.3);
    const skipped = createProfile({ profileId: 'p', now: NOW, seed: 1, skipped: true });
    expect(topicInterest(skipped, 'gamma')).toBe(0.5);
    expect(
      createProfile({ profileId: 'p', now: NOW, seed: 1, topicIds: [] }).onboarding.skipped,
    ).toBe(true);
    const offset = {
      ...picked,
      interest: { ...picked.interest, concept_offset: { a1: 0.5, b1: -0.5 } },
    };
    expect(interestOf(offset, catalog, 'a1')).toBe(1);
    expect(interestOf(offset, catalog, 'b1')).toBe(0);
  });
});
