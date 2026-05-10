import type { LearnerState } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { AgentError } from './errors';
import { gapPlan } from './gap';
import {
  answerCard,
  deferCard,
  leaveGapSession,
  quickAction,
  settle,
  startGapSession,
  startSession,
  type Step,
} from './queue';
import { createProfile, EMPTY_MASTERY } from './state';
import { T0 } from './testing/driver';
import { realCatalog } from './testing/fixtures';
import { orderedUnmetAncestors } from './walk';

const catalog = realCatalog();
const MIN = 60_000;

function profile(over: Partial<LearnerState> = {}): LearnerState {
  return {
    ...createProfile({
      profileId: 'p',
      now: T0,
      seed: 2,
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
    }),
    ...over,
  };
}
const learned = (due = T0 + 3 * MIN) => ({
  ...EMPTY_MASTERY,
  box: 2,
  due_at: due,
  scheduled_at: T0 - MIN,
  last_answered_at: T0 - MIN,
});
const checked = (due: number) => ({
  ...EMPTY_MASTERY,
  box: 1,
  due_at: due,
  scheduled_at: due - MIN,
  last_answered_at: due - MIN,
});
const rnUnlocked = Object.fromEntries(
  [
    'rn-flexbox-layout',
    'rn-lists-virtualization',
    'rn-navigation',
    'rn-platform-code',
    'rn-new-architecture',
    'rn-expo-workflow',
  ].map((id) => [id, { at: T0, by: 'rn-core-components' }]),
);

describe('gapPlan (UX.md 3.6)', () => {
  it('an Open concept: a reel, one more, a question', () => {
    const plan = gapPlan('rn-core-components', profile(), catalog, T0);
    expect(plan).toMatchObject({
      kind: 'gap',
      items: 3,
      pins: ['rn-core-components'],
      reachesTarget: true,
      stop: null,
      firstStep: 'rn-core-components',
    });
  });

  it('a locked concept with one Open ancestor is 6 items, ending with the check on the target', () => {
    const plan = gapPlan('rn-flexbox-layout', profile(), catalog, T0);
    expect(plan.steps.map((s) => `${s.conceptId}:${s.state}:${s.items}`)).toEqual([
      'rn-core-components:open:3',
      'rn-flexbox-layout:locked:3',
    ]);
    expect(plan).toMatchObject({ items: 6, reachesTarget: true, firstStep: 'rn-core-components' });
  });

  it('two or more unmet ancestors stop before the target (Performance and re-renders, fresh profile)', () => {
    const plan = gapPlan('rn-performance-rerenders', profile(), catalog, T0);
    expect(plan.pins).toEqual([
      'rn-core-components',
      'rn-lists-virtualization',
      'react-components-props',
      'react-state',
      'react-memoization',
      'rn-performance-rerenders',
    ]);
    expect(plan).toMatchObject({ items: 6, reachesTarget: false, stop: 'cap' });
  });

  it('pins at the end of the demo: Lists and virtualization, Components and props, State, Memoization, itself', () => {
    const s = profile({ mastery: { 'rn-core-components': learned() }, unlocked: rnUnlocked });
    expect(orderedUnmetAncestors(s, catalog, 'rn-performance-rerenders')).toEqual([
      'rn-lists-virtualization',
      'react-components-props',
      'react-state',
      'react-memoization',
    ]);
    const plan = gapPlan('rn-performance-rerenders', s, catalog, T0);
    expect(plan).toMatchObject({ items: 6, stop: 'cap', firstStep: 'rn-lists-virtualization' });
    expect(plan.steps).toHaveLength(2);
  });

  it('a due step is one card; a Checked step that is not due stops the plan', () => {
    const due = profile({ mastery: { 'rn-core-components': checked(T0 - 1_000) } });
    expect(
      gapPlan('rn-flexbox-layout', due, catalog, T0).steps.map((s) => `${s.state}:${s.items}`),
    ).toEqual(['due:1', 'locked:3']);
    const notDue = profile({ mastery: { 'rn-core-components': checked(T0 + 30_000) } });
    expect(gapPlan('rn-flexbox-layout', notDue, catalog, T0)).toMatchObject({
      kind: 'none',
      items: 0,
      blockedBy: 'rn-core-components',
      stop: 'checked_not_due',
      firstStep: null,
    });
  });

  it('a due target is a one-card review; Learned and not due is a rewatch; Checked and not due is nothing', () => {
    expect(
      gapPlan(
        'rn-core-components',
        profile({ mastery: { 'rn-core-components': checked(T0 - 1) } }),
        catalog,
        T0,
      ),
    ).toMatchObject({ kind: 'review', items: 1 });
    expect(
      gapPlan(
        'rn-core-components',
        profile({ mastery: { 'rn-core-components': learned() } }),
        catalog,
        T0,
      ),
    ).toMatchObject({ kind: 'rewatch', items: 1 });
    expect(
      gapPlan(
        'rn-core-components',
        profile({ mastery: { 'rn-core-components': checked(T0 + MIN) } }),
        catalog,
        T0,
      ),
    ).toMatchObject({ kind: 'none' });
  });
});

describe('gap sessions on the pager', () => {
  const answer = (step: Step, correct: boolean, at: number) => {
    const card = step.active;
    if (card?.kind !== 'card') throw new Error('expected a card');
    const right = catalog.itemById.get(card.itemId)!.answerIndex;
    return answerCard(
      step.state,
      catalog,
      { key: card.key, choiceIndex: correct ? right : card.options.find((o) => o !== right)! },
      at,
    );
  };

  it('serves the plan step by step, ends on the target check with a summary, then restores the feed', () => {
    const feed = startSession(profile(), catalog, T0);
    const feedActive = feed.active!;
    let step: Step = startGapSession(
      feed.state,
      catalog,
      { targetId: 'rn-flexbox-layout' },
      T0 + 1_000,
    );
    const served: string[] = [];
    let now = T0 + 1_000;
    for (let i = 0; i < 8; i++) {
      const item = step.active!;
      served.push(
        item.kind === 'summary' ? 'summary' : `${item.kind}:${item.conceptId}:${item.reason.code}`,
      );
      if (item.kind === 'summary') break;
      expect(item.source).toBe('gap_session');
      expect(item.gap?.total).toBe(6);
      now += 30_000;
      if (item.kind === 'card') {
        step = answer(step, true, now);
        now += 5_000;
      }
      const following = step.upcoming[0];
      if (!following) break;
      step = settle(
        step.state,
        catalog,
        following,
        now,
        item.kind === 'reel' ? { ended: { key: item.key, watchedMs: 30_000, loops: 1 } } : {},
      );
    }
    expect(served).toEqual([
      'reel:rn-core-components:GAP_SESSION',
      'reel:rn-core-components:GAP_SESSION',
      'card:rn-core-components:GAP_SESSION',
      'reel:rn-flexbox-layout:GAP_SESSION',
      'reel:rn-flexbox-layout:GAP_SESSION',
      'card:rn-flexbox-layout:GAP_SESSION',
      'summary',
    ]);
    expect(step.state.gap?.ended).toBe('target_checked');
    // A still-locked target can be checked (Checked, locked).
    expect(step.state.mastery['rn-flexbox-layout']?.box).toBe(1);
    expect(step.state.unlocked['rn-flexbox-layout']).toBeUndefined();
    expect(() => quickAction(step.state, catalog, { key: 'x', action: 'too_easy' }, now)).toThrow(
      AgentError,
    );
    const back = leaveGapSession(step.state, catalog, now + 2_000);
    expect(back).toMatchObject({ ended: 'target_checked', itemsServed: 6 });
    expect(back.state.gap).toBeNull();
    expect(back.active).toEqual(feedActive);
    expect(back.upcoming.length).toBeGreaterThan(0);
  });

  it('a wrong answer adds the reteach reel and a re-check inside the cap; no room ends the session', () => {
    let step: Step = startGapSession(profile(), catalog, { targetId: 'rn-core-components' }, T0);
    let now = T0;
    for (let i = 0; i < 2; i++) {
      now += 30_000;
      step = settle(step.state, catalog, step.upcoming[0]!, now);
    }
    expect(step.active?.kind).toBe('card');
    const wrong = answer(step, false, now + 5_000);
    expect(wrong.state.gap?.script.map((e) => e.role)).toEqual([
      'learn',
      'more',
      'check',
      'reteach',
      'recheck',
    ]);
    expect(wrong.upcoming[0]).toMatchObject({ kind: 'reel', reason: { code: 'GAP_SESSION' } });
    step = settle(wrong.state, catalog, wrong.upcoming[0]!, now + 10_000);
    step = settle(step.state, catalog, step.upcoming[0]!, now + 40_000);
    expect(step.active).toMatchObject({
      kind: 'card',
      retry: true,
      reason: { params: { retry: 'true' } },
    });
    // 5 of 6 served: a second wrong answer has no room for 2 more.
    const again = answer(step, false, now + 45_000);
    expect(again.result.gapEnded).toBe('wrong_at_cap');
    const back = leaveGapSession(again.state, catalog, now + 50_000);
    expect(back.ended).toBe('wrong_at_cap');
    // Back in the feed the reteach reel comes first.
    expect(back.upcoming[0]).toMatchObject({ kind: 'reel', reason: { code: 'RETEACH' } });
  });

  it('a one-card map review is REVIEW_DUE from map_review, without a summary', () => {
    const s = profile({
      mastery: { 'rn-core-components': checked(T0 - 5_000) },
      exposure: {
        'rn-core-components': {
          first_at: T0 - MIN,
          at_reel: 0,
          finished: ['rn-core-components--intro'],
        },
      },
    });
    const step = startGapSession(s, catalog, { targetId: 'rn-core-components' }, T0);
    expect(step.plan.kind).toBe('review');
    expect(step.active).toMatchObject({
      kind: 'card',
      source: 'map_review',
      reason: { code: 'REVIEW_DUE' },
    });
    expect(step.upcoming).toEqual([]);
    const done = answer(step, true, T0 + 9_000);
    expect(done.result).toMatchObject({
      boxAfter: 2,
      gapEnded: 'target_checked',
      source: 'map_review',
    });
    expect(done.upcoming).toEqual([]);
    expect(() => deferCard(done.state, catalog, step.active as never, T0)).toThrow(AgentError);
  });

  it('refuses a concept with nothing to serve, and a second session', () => {
    const s = profile({ mastery: { 'rn-core-components': checked(T0 + MIN) } });
    expect(() => startGapSession(s, catalog, { targetId: 'rn-core-components' }, T0)).toThrow(
      AgentError,
    );
    const running = startGapSession(profile(), catalog, { targetId: 'caching' }, T0);
    expect(() => startGapSession(running.state, catalog, { targetId: 'caching' }, T0)).toThrow(
      AgentError,
    );
    expect(() => leaveGapSession(profile(), catalog, T0)).toThrow(AgentError);
    const left = leaveGapSession(running.state, catalog, T0 + 5_000);
    expect(left.ended).toBe('left');
  });
});

describe('a wrong answer on an earlier step', () => {
  it('drops the later steps that no longer fit in the 6-item cap', () => {
    // Flexbox layout (locked): Core components (3 items), then Flexbox layout (3 items).
    let step: Step = startGapSession(profile(), catalog, { targetId: 'rn-flexbox-layout' }, T0);
    let now = T0;
    for (let i = 0; i < 2; i++) {
      now += 30_000;
      step = settle(step.state, catalog, step.upcoming[0]!, now);
    }
    expect(step.active).toMatchObject({ kind: 'card', conceptId: 'rn-core-components' });
    const card = step.active as Extract<typeof step.active, { kind: 'card' }>;
    const right = catalog.itemById.get(card.itemId)!.answerIndex;
    const wrong = answerCard(
      step.state,
      catalog,
      { key: card.key, choiceIndex: card.options.find((o) => o !== right)! },
      now + 5_000,
    );
    // 3 served + reteach + re-check = 5: the 3-item Flexbox step no longer fits.
    expect(wrong.state.gap?.script.map((e) => `${e.concept_id}:${e.role}`)).toEqual([
      'rn-core-components:learn',
      'rn-core-components:more',
      'rn-core-components:check',
      'rn-core-components:reteach',
      'rn-core-components:recheck',
    ]);
    expect(wrong.upcoming.at(-1)).toMatchObject({ kind: 'summary', trigger: 'gap_end' });
  });
});

describe('a wrong answer on a due step', () => {
  it('keeps the later step when it still fits after the reteach and re-check', () => {
    // Core components is Checked and due (a 1-card step); Flexbox layout is the 3-item target.
    const s = profile({ mastery: { 'rn-core-components': checked(T0 - 5_000) } });
    const step = startGapSession(s, catalog, { targetId: 'rn-flexbox-layout' }, T0);
    expect(step.plan.steps.map((x) => `${x.state}:${x.items}`)).toEqual(['due:1', 'locked:3']);
    const card = step.active as Extract<typeof step.active, { kind: 'card' }>;
    const right = catalog.itemById.get(card.itemId)!.answerIndex;
    const wrong = answerCard(
      step.state,
      catalog,
      { key: card.key, choiceIndex: card.options.find((o) => o !== right)! },
      T0 + 5_000,
    );
    expect(wrong.state.gap?.script.map((e) => `${e.concept_id}:${e.role}`)).toEqual([
      'rn-core-components:review',
      'rn-core-components:reteach',
      'rn-core-components:recheck',
      'rn-flexbox-layout:learn',
      'rn-flexbox-layout:more',
      'rn-flexbox-layout:check',
    ]);
  });
});

describe('"Rewatch a reel" (Learned or Retained, not due)', () => {
  it('serves one reel, no card and no summary, then returns', () => {
    const s = profile({ mastery: { 'rn-core-components': learned(T0 + 60 * MIN) } });
    const step = startGapSession(s, catalog, { targetId: 'rn-core-components' }, T0);
    expect(step.plan.kind).toBe('rewatch');
    expect(step.active).toMatchObject({
      kind: 'reel',
      conceptId: 'rn-core-components',
      source: 'gap_session',
    });
    expect(step.upcoming).toEqual([]);
    const back = leaveGapSession(step.state, catalog, T0 + 30_000);
    expect(back.ended).toBe('plan_done');
    expect(back.state.mastery).toEqual(s.mastery);
  });
});
