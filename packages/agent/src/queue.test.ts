import type { CardItem, FeedItem, LearnerState, QuickAction } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { INTERVALS } from './config';
import { AgentError } from './errors';
import { keyedRandom } from './random';
import {
  answerCard,
  next,
  plan,
  quickAction,
  reelEnded,
  refreshItem,
  sessionExpired,
  setClock,
  setMode,
  settle,
  startGapSession,
  startSession,
  undoQuickAction,
} from './queue';
import { createProfile, EMPTY_MASTERY, masteryOf } from './state';
import { Driver, T0 } from './testing/driver';
import { fixtureCatalog, realCatalog } from './testing/fixtures';

const catalog = fixtureCatalog();
const real = realCatalog();
const kinds = (items: FeedItem[]) => items.map((i) => i.kind);

describe('plan and settle (PERFORMANCE.md 2.5)', () => {
  it('starts a session with slot 0 settled, the committed reel and 2 provisional items', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'] });
    expect(d.active.kind).toBe('reel');
    expect(d.state.session.history.map((e) => e.key)).toEqual([d.active.key]);
    expect(d.upcoming).toHaveLength(3);
    expect(d.upcoming[0]).toEqual(d.state.queue.committed);
    expect(d.state.queue.active).toEqual(d.active);
  });

  it('keeps the committed reel across re-plans; a re-plan from unchanged state repeats its picks', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'] });
    const again = plan(d.state, catalog, d.now + 1_000);
    expect(again.upcoming).toEqual(d.upcoming);
    expect(again.state.queue.committed).toBe(d.state.queue.committed);
  });

  it('places a due card directly after the active item, ahead of the committed reel', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    expect(card.reason.code).toBe('FIRST_CHECK');
    d.answer(true);
    d.swipe(); // a reel
    const committed = d.state.queue.committed!;
    // The review falls due while this reel plays: the timer re-plan puts it first.
    d.advance(70_000);
    expect(d.upcoming[0]).toMatchObject({ kind: 'card', reason: { code: 'REVIEW_DUE' } });
    expect(d.upcoming[1]).toEqual(committed);
  });

  it('a flick that passes over items never lets a later item reuse their key or reel ordinal', () => {
    // The app keeps passed-over items in its list (append-only head), so keys and
    // reel ordinals (which pick the video player) must stay unique across it.
    for (let seed = 1; seed <= 40; seed++) {
      let now = T0;
      let rnd = seed;
      const coin = () => (rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 < 0.3;
      const start = startSession(
        createProfile({
          profileId: 'p',
          now,
          seed,
          topicIds: ['react-native'],
          mode: 'focus',
          clock: 'demo',
        }),
        real,
        now,
      );
      let state = start.state;
      let list: FeedItem[] = [start.active as FeedItem, ...start.upcoming];
      let at = 0;
      const apply = (step: { state: LearnerState; upcoming: FeedItem[] }, after: number) => {
        state = step.state;
        list = [...list.slice(0, after + 1), ...step.upcoming];
      };
      for (let n = 0; n < 40; n++) {
        now += 20_000;
        const active = list[at] as FeedItem;
        if (active.kind === 'card') {
          const right = real.itemById.get(active.itemId)?.answerIndex ?? 0;
          apply(answerCard(state, real, { key: active.key, choiceIndex: right }, now), at);
        }
        const target = coin() && list[at + 2] ? at + 2 : at + 1; // a flick skips a page
        apply(settle(state, real, list[target] as FeedItem, now), target);
        at = target;
        const keys = list.map((i) => i.key);
        expect(new Set(keys).size).toBe(keys.length);
        const ordinals = list.filter((i) => i.kind === 'reel').map((i) => i.ordinal);
        expect(new Set(ordinals).size).toBe(ordinals.length);
      }
    }
  });

  it('refreshItem brings a planned review card up to date without changing state', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    d.untilCard();
    d.answer(true);
    d.swipe();
    d.advance(70_000); // the due timer plans the review now
    const planned = d.upcoming[0] as CardItem;
    expect(planned.reason.code).toBe('REVIEW_DUE');
    const answeredAt = masteryOf(d.state, planned.conceptId).last_answered_at as number;
    expect(Number(planned.reason.params.elapsed_ms)).toBeLessThan(d.now - answeredAt);
    const later = refreshItem(d.state, catalog, planned, d.now + 120_000);
    expect(later.kind === 'card' && Number(later.reason.params.elapsed_ms)).toBe(
      d.now + 120_000 - answeredAt,
    );
    expect(later.key).toBe(planned.key);
    expect(d.upcoming[0]).toBe(planned); // the input is untouched
  });

  it('a settle on an item already shown is a revisit: nothing changes, nothing is re-planned', () => {
    const d = Driver.start(catalog);
    const first = d.active;
    d.swipe();
    const step = settle(d.state, catalog, first, d.now);
    expect(step.revisit).toBe(true);
    expect(step.state).toBe(d.state);
    expect(step.upcoming).toEqual([]);
  });

  it('a flick past the committed reel drops it and commits a new one', () => {
    const d = Driver.start(catalog, { skipped: true });
    const committed = d.upcoming[0]!;
    const provisional = d.upcoming[1]!;
    expect(provisional.kind).toBe('reel');
    const step = settle(d.state, catalog, provisional, d.now + 4_000);
    expect(step.state.queue.committed?.key).not.toBe(committed.key);
    expect(step.state.counters.reels).toBe(
      (provisional.kind === 'reel' ? provisional.ordinal : 0) + 1,
    );
    const keys = new Set([
      ...step.state.session.history.map((e) => e.key),
      ...step.upcoming.map((i) => i.key),
    ]);
    expect(keys.size).toBe(step.state.session.history.length + step.upcoming.length);
  });

  it('closes the previous reel before shown(), whatever the order of calls', () => {
    const d = Driver.start(catalog, { mode: 'focus', topicIds: ['alpha'] });
    const reel = d.active;
    const nextItem = d.upcoming[0]!;
    // App order A: reel end inside settle. Order B: settle first, reel end after.
    const a = settle(d.state, catalog, nextItem, d.now + 30_000, {
      ended: { key: reel.key, watchedMs: 30_000, loops: 1 },
    });
    const b0 = settle(d.state, catalog, nextItem, d.now + 30_000);
    const b = reelEnded(
      b0.state,
      catalog,
      { key: reel.key, watchedMs: 30_000, loops: 1 },
      d.now + 30_000,
    );
    expect(a.state.exposure).toEqual(b.state.exposure);
    expect(a.ended?.signal).toBe('completed');
    expect(
      reelEnded(b.state, catalog, { key: reel.key, watchedMs: 1, loops: 0 }, d.now).ignored,
    ).toBe(true);
  });

  it('works on the real graph within the cap of 2 cards before the reel', () => {
    for (let seed = 0; seed < 20; seed++) {
      const d = Driver.start(real, {
        seed,
        mode: 'focus',
        clock: 'demo',
        topicIds: ['react-native'],
      });
      for (let i = 0; i < 25; i++) {
        const firstReel = d.upcoming.findIndex((x) => x.kind === 'reel');
        expect(firstReel).toBeGreaterThanOrEqual(0);
        expect(firstReel).toBeLessThanOrEqual(2);
        if (d.active.kind === 'card') d.answer(keyedRandom(seed, 'a', i) < 0.7);
        d.swipe(keyedRandom(seed, 'w', i) < 0.2 ? 0.1 : 1);
      }
    }
  });
});

describe('scheduler on a fake clock', () => {
  for (const clock of ['real', 'demo'] as const) {
    it(`${clock} clock: Checked, then due after the box-1 interval, then Learned on a delayed correct answer`, () => {
      const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock });
      d.swipe();
      const card = d.untilCard();
      expect(card.options).toHaveLength(3);
      const first = d.answer(true, 5_000, 0);
      expect(first).toMatchObject({
        boxBefore: 0,
        boxAfter: 1,
        isDelayed: false,
        scheduledGapMs: null,
        actualGapMs: null,
      });
      const answeredAt = d.now;
      expect(first.nextDueAt).toBe(answeredAt + INTERVALS[clock].boxMs[1]);
      // Keep swiping until the review arrives.
      let review: CardItem | null = null;
      for (let i = 0; i < 60 && !review; i++) {
        d.swipe();
        if (d.active.kind === 'card' && d.active.conceptId === card.conceptId) review = d.active;
        else if (d.active.kind === 'card') d.answer(true);
      }
      expect(review).not.toBeNull();
      expect(review!.reason.code).toBe('REVIEW_DUE');
      expect(review!.options).toHaveLength(4);
      expect(d.now).toBeGreaterThanOrEqual(first.nextDueAt!);
      const second = d.answer(true);
      expect(second).toMatchObject({
        boxBefore: 1,
        boxAfter: 2,
        levelAfter: 'learned',
        isDelayed: true,
      });
      expect(second.scheduledGapMs).toBe(INTERVALS[clock].boxMs[1]);
      expect(second.actualGapMs).toBeGreaterThanOrEqual(INTERVALS[clock].boxMs[1]);
      expect(second.unlocked.length).toBeGreaterThan(0);
    });
  }

  it('overdue guard: Focus serves the review in the slot after the item on screen at dueAt', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    d.untilCard();
    const { nextDueAt } = d.answer(true, 5_000, 0);
    d.swipe(); // reel A on screen
    while (d.now + (d.active.kind === 'reel' ? d.active.durationMs : 0) < nextDueAt!) d.swipe();
    // The item on screen at dueAt is the active reel; the next slot must be the review.
    d.advance(nextDueAt! - d.now);
    expect(d.upcoming[0]).toMatchObject({ kind: 'card', reason: { code: 'REVIEW_DUE' } });
  });

  it('overdue guard: Light allows one item first, never two', () => {
    let state = createProfile({
      profileId: 'p',
      now: T0,
      seed: 2,
      topicIds: ['beta'],
      mode: 'light',
    });
    state = {
      ...state,
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: T0 - 600_000,
          due_at: T0 + 10_000,
          last_answered_at: T0 - 600_000,
        },
      },
    };
    const d = new Driver(catalog, startSession(state, catalog, T0), T0);
    d.advance(10_000); // a1 falls due while the first reel is on screen
    const positions = d.upcoming.map((i) => (i.kind === 'card' ? i.conceptId : i.kind));
    const at = positions.indexOf('a1');
    expect(at === 0 || at === 1).toBe(true);
    d.swipe();
    expect(d.active.kind === 'card' || d.upcoming[0]?.kind === 'card').toBe(true);
  });

  it('lapse and reteach: wrong drops a box, the reteach reel (another angle) is next, then the re-check', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    const wrong = d.answer(false, 5_000, 0);
    expect(wrong).toMatchObject({ correct: false, boxBefore: 0, boxAfter: 0, levelAfter: 'seen' });
    expect(wrong.reteach?.replay).toBe(false);
    expect(d.upcoming[0]).toMatchObject({
      kind: 'reel',
      conceptId: card.conceptId,
      pool: null,
      reason: { code: 'RETEACH', params: { trigger: 'wrong_answer' } },
    });
    expect(d.upcoming[0]?.kind === 'reel' && d.upcoming[0].reelId).not.toBe(card.reelId);
    d.swipe(); // the reteach reel
    d.swipe(); // the retry is due (20 s) when it ends: the re-check comes straight after
    expect(d.active).toMatchObject({
      kind: 'card',
      conceptId: card.conceptId,
      retry: true,
      reason: { code: 'REVIEW_DUE', params: { retry: 'true' } },
    });
    expect(d.card().options).toHaveLength(3);
    expect(d.card().itemId).not.toBe(card.itemId);
    const recheck = d.answer(true);
    expect(recheck).toMatchObject({ boxBefore: 0, boxAfter: 1, isDelayed: true, retry: true });
  });

  it('a second miss in a session rests the concept until the next session (owner decision #8)', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    expect(d.answer(false, 5_000, 0)).toMatchObject({ rested: false, reteach: { replay: false } });
    d.swipe(); // the reteach reel
    d.swipe(); // the re-check
    expect(d.active).toMatchObject({ kind: 'card', conceptId: card.conceptId, retry: true });
    const second = d.answer(false, 5_000, 0);
    expect(second).toMatchObject({ correct: false, rested: true, reteach: null });
    expect(d.state.pending.reteach).toBeNull();
    expect(d.state.session.misses?.[card.conceptId]).toBe(2);
    // Its retry falls due 20 s later, yet the rest of the session serves no card for it.
    for (let i = 0; i < 15; i++) {
      const item = d.swipe();
      expect(item.kind === 'card' && item.conceptId === card.conceptId).toBe(false);
    }
    // A new session lifts the rest: the overdue review comes straight back.
    const fresh = new Driver(catalog, startSession(d.state, catalog, d.now), d.now);
    const firstItems = [fresh.active, fresh.swipe(), fresh.swipe(), fresh.swipe()];
    expect(firstItems.some((i) => i.kind === 'card' && i.conceptId === card.conceptId)).toBe(true);
  });

  it('gap-session misses do not count toward the feed cap', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    d.answer(false, 5_000, 0);
    const gap = startGapSession(d.state, catalog, { targetId: card.conceptId }, d.now);
    const g = new Driver(catalog, gap, d.now);
    const gapCard = g.untilCard();
    expect(gapCard.conceptId).toBe(card.conceptId);
    expect(g.answer(false, 5_000, 0).rested).toBe(false);
    expect(g.state.session.misses?.[card.conceptId]).toBe(1);
  });

  it('a lapse from Learned keeps what it opened open (unlocks are sticky)', () => {
    let state = createProfile({
      profileId: 'p',
      now: T0,
      seed: 2,
      topicIds: ['alpha'],
      mode: 'focus',
      clock: 'demo',
    });
    state = {
      ...state,
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 2,
          scheduled_at: T0 - 200_000,
          due_at: T0 - 1_000,
          last_answered_at: T0 - 200_000,
          last_item_id: 'a1--intro--q1',
        },
      },
      unlocked: { a2: { at: T0 - 100_000, by: 'a1' }, a5: { at: T0 - 100_000, by: 'a1' } },
      exposure: {
        a1: { first_at: T0 - 300_000, at_reel: 0, finished: ['a1--intro', 'a1--example'] },
      },
    };
    const d = new Driver(catalog, startSession(state, catalog, T0), T0);
    expect(d.active).toMatchObject({
      kind: 'card',
      conceptId: 'a1',
      reason: { code: 'REVIEW_DUE', params: { box: '2' } },
    });
    const r = d.answer(false);
    expect(r).toMatchObject({ boxBefore: 2, boxAfter: 1, levelAfter: 'checked' });
    expect(Object.keys(d.state.unlocked).sort()).toEqual(['a2', 'a5']);
  });

  it('no promotion on early answers: a prove-it on a Checked concept that is not due', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'real' });
    d.swipe();
    const card = d.untilCard();
    d.answer(true, 5_000, 0);
    d.swipe();
    // Find a reel of the same concept and tap Too easy on it.
    let guard = 0;
    while (!(d.active.kind === 'reel' && d.active.conceptId === card.conceptId) && guard++ < 30) {
      if (d.active.kind === 'card') d.answer(true);
      d.swipe();
    }
    expect(d.active.conceptId).toBe(card.conceptId);
    const conf = d.tap('too_easy');
    expect(conf.countdownMs).toBeGreaterThan(0);
    expect(d.upcoming[0]).toMatchObject({
      kind: 'card',
      proveIt: true,
      reason: { code: 'PROVE_IT' },
    });
    d.swipe();
    const r = d.answer(true);
    expect(r).toMatchObject({
      early: true,
      promoted: false,
      boxBefore: 1,
      boxAfter: 1,
      proveIt: true,
    });
  });
});

describe('"Later" (UX.md 3.3)', () => {
  it('skips cadence and the overdue guard for 2 reels, then returns with its original sentence', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    const masteryBefore = JSON.stringify(d.state.mastery);
    const interestBefore = JSON.stringify(d.state.interest);
    d.later();
    expect(JSON.stringify(d.state.mastery)).toBe(masteryBefore);
    expect(JSON.stringify(d.state.interest)).toBe(interestBefore);
    expect(d.upcoming[0]?.kind).toBe('reel');
    d.swipe();
    // One reel into the window: the card does not come back yet.
    expect(d.upcoming[0]).not.toMatchObject({ kind: 'card', conceptId: card.conceptId });
    d.swipe();
    d.swipe();
    expect(d.active).toMatchObject({
      kind: 'card',
      conceptId: card.conceptId,
      itemId: card.itemId,
      reason: { code: card.reason.code, params: { trigger: 'later', later_reels: '2' } },
    });
    // A new presentation: the options are drawn again and still hold the answer.
    expect(d.state.items[card.itemId]?.shown).toBe(2);
    expect(d.card().options).toContain(0);
    expect(d.state.pending.deferred).toEqual([]);
  });
});

describe('quick actions (UX.md 3.2, 9.4)', () => {
  it('More like this re-plans the next reel at once and names it; Undo restores everything', () => {
    // Gamma has two roots, so the echo has a sibling to serve.
    const d = Driver.start(catalog, { topicIds: ['gamma'], seed: 4 });
    const before = d.state;
    const committedBefore = d.state.queue.committed;
    const conf = d.tap('more_like_this');
    expect(conf.cardFirst).toBe(false);
    expect(conf.nextReel).toMatchObject({
      reason: { code: 'MORE_LIKE_THIS', params: { source: d.active.conceptId } },
    });
    expect(d.state.interest.topic.gamma).toBeCloseTo(0.85);
    d.undo();
    expect(d.state.interest).toEqual(before.interest);
    expect(d.state.pending).toEqual(before.pending);
    expect(d.state.queue.committed).toEqual(committedBefore);
    expect(d.state.undo).toBeNull();
    expect(d.state.session.history).toEqual(before.session.history);
  });

  it('the last tap wins: a second action replaces the first; Undo returns to before both', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], seed: 4 });
    const before = d.state;
    d.tap('more_like_this');
    const conf = d.tap('not_for_me');
    expect(d.state.pending.echo).toBeNull();
    expect(d.state.session.hidden).toEqual([d.active.conceptId]);
    expect(d.state.interest.topic.alpha).toBeCloseTo(0.55);
    expect(conf.nextReel?.conceptId).not.toBe(d.active.conceptId);
    expect(conf.nextReel?.reason.params.trigger).toBe('not_for_me');
    d.undo();
    expect(d.state.interest).toEqual(before.interest);
    expect(d.state.session.hidden).toEqual([]);
  });

  it('Not for me voids the impression watch signals', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], seed: 4 });
    const reel = d.active;
    d.tap('not_for_me');
    const interest = d.state.interest;
    d.swipe(1.6);
    expect(d.lastEnd?.signal).toBe('none');
    expect(d.state.interest).toEqual(interest);
    expect(d.state.exposure[reel.conceptId as string]).toBeDefined();
  });

  it('Too easy queues a prove-it card next (3 options, another angle) and the pitfall next for that concept', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], seed: 4 });
    const reel = d.active;
    d.tap('too_easy');
    const proveIt = d.upcoming[0] as CardItem;
    expect(proveIt).toMatchObject({
      kind: 'card',
      proveIt: true,
      conceptId: reel.conceptId,
      reason: { code: 'PROVE_IT', params: { trigger: 'too_easy', box: '0' } },
    });
    expect(proveIt.options).toHaveLength(3);
    expect(proveIt.reelId).toBe(`${reel.conceptId}--pitfall`);
    expect(d.state.pending.pitfall_next).toEqual([reel.conceptId]);
    d.swipe(0.5);
    const r = d.answer(true);
    expect(r).toMatchObject({ boxBefore: 0, boxAfter: 1, proveIt: true });
  });

  it('Too easy on a concept whose review is due serves that review, marked as a tap', () => {
    let state = createProfile({
      profileId: 'p',
      now: T0,
      seed: 2,
      topicIds: ['alpha'],
      mode: 'light',
      clock: 'real',
    });
    state = {
      ...state,
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: T0 - 600_000,
          due_at: T0 + 2_000,
          last_answered_at: T0 - 600_000,
        },
      },
    };
    const step = startSession(state, catalog, T0);
    const reel = step.active!;
    expect(reel.conceptId).not.toBe('a1');
    // Put an a1 reel on screen directly (the honesty gap keeps it out of the pools).
    const a1Reel = {
      ...reel,
      key: 'r99:a1--example',
      conceptId: 'a1',
      reelId: 'a1--example',
      ordinal: 99,
    } as FeedItem;
    const onA1 = settle(step.state, catalog, a1Reel, T0 + 3_000);
    const tap = quickAction(
      onA1.state,
      catalog,
      { key: a1Reel.key, action: 'too_easy' },
      T0 + 4_000,
    );
    expect(tap.upcoming[0]).toMatchObject({
      kind: 'card',
      proveIt: false,
      reason: { code: 'REVIEW_DUE', params: { trigger: 'too_easy' } },
    });
    expect(tap.confirmation.countdownMs).toBeNull();
  });

  it('refuses taps on anything but the reel on screen, and Undo without a tap', () => {
    const d = Driver.start(catalog);
    expect(() => quickAction(d.state, catalog, { key: 'nope', action: 'too_easy' }, d.now)).toThrow(
      AgentError,
    );
    expect(() => undoQuickAction(d.state, catalog, { key: d.active.key }, d.now)).toThrow(
      AgentError,
    );
  });
});

describe('invariants', () => {
  it('any sequence of watch and quick-action events leaves mastery byte-identical', () => {
    const actions: (QuickAction | null)[] = [
      'more_like_this',
      'too_easy',
      'not_for_me',
      null,
      null,
    ];
    for (let seed = 0; seed < 10; seed++) {
      let state = createProfile({
        profileId: 'p',
        now: T0,
        seed,
        topicIds: ['alpha'],
        mode: 'light',
        clock: 'real',
      });
      state = {
        ...state,
        mastery: {
          a1: {
            ...EMPTY_MASTERY,
            box: 2,
            due_at: T0 + 86_400_000,
            scheduled_at: T0,
            last_answered_at: T0,
          },
        },
      };
      const frozen = JSON.stringify(state.mastery);
      let step = startSession(state, catalog, T0);
      let now = T0;
      for (let i = 0; i < 40; i++) {
        const active = step.active!;
        if (active.kind === 'card') {
          // Skip past cards without answering (as a flick past would): defer them.
          now += 1_000;
          const next = step.upcoming.find((x) => x.kind === 'reel')!;
          step = settle(step.state, catalog, next, now);
          continue;
        }
        const action = actions[Math.floor(keyedRandom(seed, 'act', i) * actions.length)] ?? null;
        if (action && active.kind === 'reel') {
          now += 1_000;
          step = quickAction(step.state, catalog, { key: active.key, action }, now);
          if (keyedRandom(seed, 'undo', i) < 0.3)
            step = undoQuickAction(step.state, catalog, { key: active.key }, now + 500);
        }
        const watched = Math.floor(keyedRandom(seed, 'watch', i) * 60_000);
        now += watched;
        step = settle(step.state, catalog, step.upcoming[0]!, now, {
          ended: { key: active.key, watchedMs: watched, loops: Math.floor(watched / 30_000) },
        });
        expect(JSON.stringify(step.state.mastery)).toBe(frozen);
      }
    }
  });

  it('structural sharing: an answer replaces only the answered concept entry', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    const before: LearnerState = {
      ...d.state,
      mastery: {
        b1: { ...EMPTY_MASTERY, box: 1, due_at: T0 + 1e9, scheduled_at: T0, last_answered_at: T0 },
      },
    };
    const step = answerCard(before, catalog, { key: card.key, choiceIndex: 0 }, d.now);
    expect(step.state.mastery.b1).toBe(before.mastery.b1);
    expect(step.state.mastery[card.conceptId]).not.toBe(before.mastery[card.conceptId]);
    expect(step.state.exposure).toBe(before.exposure);
    expect(step.state.interest).toBe(before.interest);
    expect(step.state.reels).toBe(before.reels);
  });

  it('refuses an answer on a card that is not on screen or already answered', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus' });
    expect(() =>
      answerCard(d.state, catalog, { key: d.active.key, choiceIndex: 0 }, d.now),
    ).toThrow(AgentError);
    d.swipe();
    const card = d.untilCard();
    const once = answerCard(d.state, catalog, { key: card.key, choiceIndex: 0 }, d.now);
    expect(() => answerCard(once.state, catalog, { key: card.key, choiceIndex: 0 }, d.now)).toThrow(
      AgentError,
    );
  });
});

describe('settings', () => {
  it('the demo clock sets Focus, stores the mode, restores it, and rescales due times', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'light', clock: 'real' });
    d.swipe();
    d.untilCard(12);
    const r = d.answer(true, 5_000, 0);
    expect(r.nextDueAt! - d.now).toBe(10 * 60_000);
    const on = setClock(d.state, catalog, 'demo', d.now);
    expect(on.state.settings).toEqual({ mode: 'focus', clock: 'demo', mode_before_demo: 'light' });
    expect(on.rescaledConceptIds).toEqual([r.conceptId]);
    expect(on.state.mastery[r.conceptId]!.due_at).toBe(d.now + 60_000);
    const off = setClock(on.state, catalog, 'real', d.now);
    expect(off.state.settings).toEqual({ mode: 'light', clock: 'real', mode_before_demo: null });
    expect(off.state.mastery[r.conceptId]!.due_at).toBe(d.now + 600_000);
    expect(setClock(off.state, catalog, 'real', d.now).rescaledConceptIds).toEqual([]);
    expect(setMode(off.state, catalog, 'focus', d.now).state.settings.mode).toBe('focus');
  });

  it('a session summary comes after 14 items in Focus, never before the first answered card', () => {
    const d = Driver.start(real, {
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
      seed: 3,
    });
    const triggers: string[] = [];
    for (let i = 1; i < 30; i++) {
      if (d.active.kind === 'card') d.later();
      d.swipe();
      if (d.active.kind === 'summary') triggers.push(d.active.trigger);
    }
    // Every card was put off, so nothing was answered: no count-based summary
    // (the one for "every open reel shown" does not wait for an answer).
    expect(triggers).not.toContain('count');
    const e = Driver.start(real, {
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
      seed: 3,
    });
    let summaryAt = -1;
    for (let i = 1; i < 30 && summaryAt < 0; i++) {
      if (e.active.kind === 'card') e.answer(true);
      e.swipe();
      if (e.active.kind === 'summary') summaryAt = i;
    }
    expect(summaryAt).toBeGreaterThanOrEqual(14);
    expect(e.active).toMatchObject({
      kind: 'summary',
      trigger: 'count',
      reason: null,
      conceptId: null,
    });
    expect(e.active.kind === 'summary' && e.active.summary.questionsAnswered).toBeGreaterThan(0);
  });

  it('Light: the summary comes after 10 items; when every open reel was shown, one summary then the fallback', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'light', clock: 'real', seed: 6 });
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      if (d.active.kind === 'card') d.answer(true);
      d.swipe();
      seen.push(d.active.kind === 'summary' ? `summary:${d.active.trigger}` : d.active.reason.code);
    }
    expect(seen).toContain('summary:count');
    expect(seen).toContain('summary:exhausted');
    expect(seen.filter((s) => s === 'summary:exhausted')).toHaveLength(1);
    expect(seen).toContain('FALLBACK');
  });

  it('startSession clears hidden concepts and history; 30 minutes away expires a session', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'] });
    d.tap('not_for_me');
    d.swipe();
    expect(d.state.session.hidden).toHaveLength(1);
    expect(sessionExpired(d.state, d.now + 29 * 60_000)).toBe(false);
    expect(sessionExpired(d.state, d.now + 30 * 60_000)).toBe(true);
    const next = startSession(d.state, catalog, d.now + 31 * 60_000);
    expect(next.state.session.hidden).toEqual([]);
    expect(next.state.session.history).toHaveLength(1);
    expect(next.state.session.index).toBe(d.state.session.index + 1);
    expect(next.state.counters.reels).toBeGreaterThan(d.state.counters.reels);
  });
});

describe('typed failures', () => {
  it('plan refuses an empty manifest', () => {
    const empty = { ...catalog, reelCount: 0 };
    const state: LearnerState = createProfile({ profileId: 'p', now: T0, seed: 1 });
    expect(() => plan(state, empty, T0)).toThrow(AgentError);
  });
});

void kinds;

describe('next() and shown()', () => {
  it('next() is one slot decision plus the state as if it were shown', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'] });
    const one = next(d.state, catalog, d.now);
    expect(one.item?.key).toBe(plan(d.state, catalog, d.now, 'explicit').upcoming[0]?.key);
    expect(one.state.session.history.at(-1)?.key).toBe(one.item?.key);
    expect(one.state.counters.reels).toBe(d.state.counters.reels + 1);
  });

  it('next() returns nothing once a one-card review session is used up', () => {
    let state = createProfile({ profileId: 'p', now: T0, seed: 2, topicIds: ['alpha'] });
    state = {
      ...state,
      mastery: {
        a1: {
          ...EMPTY_MASTERY,
          box: 1,
          scheduled_at: T0 - 700_000,
          due_at: T0 - 1_000,
          last_answered_at: T0 - 700_000,
        },
      },
    };
    const review = startGapSession(state, catalog, { targetId: 'a1' }, T0);
    const done = answerCard(
      review.state,
      catalog,
      { key: review.active!.key, choiceIndex: 0 },
      T0 + 5_000,
    );
    expect(next(done.state, catalog, T0 + 6_000)).toEqual({ item: null, state: done.state });
  });
});

describe('summary items', () => {
  it('carry the counts of the moment they are shown', () => {
    const d = Driver.start(realCatalog(), {
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
      seed: 3,
    });
    for (let i = 0; i < 30 && d.active.kind !== 'summary'; i++) {
      if (d.active.kind === 'card') d.answer(true);
      d.swipe();
    }
    expect(d.active.kind).toBe('summary');
    if (d.active.kind !== 'summary') return;
    const reelsSoFar = d.settled.filter((i) => i.kind === 'reel').length;
    expect(d.active.summary.reelsWatched).toBe(reelsSoFar);
    expect(d.active.summary.questionsAnswered).toBe(d.state.session.cards_answered);
  });
});

describe('deferrals that can no longer count', () => {
  it('are dropped when the concept is answered another way', () => {
    const d = Driver.start(catalog, { topicIds: ['alpha'], mode: 'focus', clock: 'demo' });
    d.swipe();
    const card = d.untilCard();
    d.later();
    expect(d.state.pending.deferred.map((x) => x.concept_id)).toEqual([card.conceptId]);
    d.swipe();
    // A prove-it on the same concept answers it before the deferral returns.
    let guard = 0;
    while (!(d.active.kind === 'reel' && d.active.conceptId === card.conceptId) && guard++ < 20) {
      if (d.active.kind === 'card') d.answer(true);
      d.swipe();
    }
    expect(d.active.conceptId).toBe(card.conceptId);
    d.tap('too_easy');
    d.swipe(0.5);
    expect(d.active).toMatchObject({ kind: 'card', reason: { code: 'PROVE_IT' } });
    expect(d.state.pending.deferred).toHaveLength(1); // still waiting for its 2 reels
    d.answer(true);
    expect(d.state.pending.deferred).toEqual([]);
  });
});
