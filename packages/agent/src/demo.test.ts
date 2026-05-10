// UX.md section 7: the 3-minute demo, pinned on the real graph with the
// documented reel durations (28.8, 30.4, 31.0, 29.8 s) and DEMO_SEED.
import { describe, expect, it } from 'vitest';
import { DEMO_SEED } from './config';
import {
  dockContent,
  plain,
  progressConsequence,
  reasonSentence,
  stripText,
  confirmationText,
} from './copy';
import { gapPlan } from './gap';
import { displayState, mapCounts, suggestions } from './map';
import { at, describeSequence, PINNED_SEQUENCE, runDemo } from './testing/demo-script';
import { Driver } from './testing/driver';
import { realCatalog } from './testing/fixtures';

const catalog = realCatalog();

describe('the 3-minute demo (UX.md section 7)', () => {
  const run = runDemo(catalog, DEMO_SEED);

  it('serves the pinned sequence with the scripted strings', () => {
    expect(describeSequence(run.settled)).toEqual([...PINNED_SEQUENCE]);
    expect(run.settled.map((i) => stripText(i, catalog))).toEqual([
      'Deepen. From a topic you picked: React Native.',
      'Because you tapped More like this.',
      'First check: Core components.',
      'Explore. New topic: AI engineering.',
      'Explore. New topic: Systems design.',
      'Review. Answered Core components 1m 09s ago.',
    ]);
    expect(plain(confirmationText(run.confirmation, catalog))).toBe('Next: Components and props.');
  });

  it('the tap at 0:27 changes the next reel (an interest change alters the next pick)', () => {
    expect(run.committedBeforeTap?.conceptId).not.toBe('react-components-props');
    expect(run.confirmation.nextReel?.reelId).toBe('react-components-props--intro');
  });

  it('asks reel 1 questions: 3 options first, 4 on the review, never the same item twice', () => {
    const [, , card1, , , review] = run.settled;
    expect(card1?.kind === 'card' && card1.itemId.startsWith('rn-core-components--intro--')).toBe(
      true,
    );
    expect(review?.kind === 'card' && review.itemId.startsWith('rn-core-components--intro--')).toBe(
      true,
    );
    expect(
      card1?.kind === 'card' && review?.kind === 'card' && card1.itemId !== review.itemId,
    ).toBe(true);
  });

  it('plans the first check on Components and props at 2:04 and swaps in the review at 2:26', () => {
    expect(run.sixthAt204).toMatchObject({
      kind: 'card',
      conceptId: 'react-components-props',
      reason: { code: 'FIRST_CHECK' },
    });
    expect(run.sixthAt226).toMatchObject({
      kind: 'card',
      conceptId: 'rn-core-components',
      reason: { code: 'REVIEW_DUE' },
    });
  });

  it('times the review: due at 2:26, shown at 2:35 (8 s after it fell due), Learned at 163 s', () => {
    expect(run.firstAnswer).toMatchObject({ boxBefore: 0, boxAfter: 1, nextDueAt: at(146) });
    expect(progressConsequence(run.firstAnswer, catalog, 'demo', at(86))).toBe(
      'Back in about 1 min. Correct then: Learned.',
    );
    const review = run.settled[5]!;
    expect(review.reason?.params.elapsed_ms).toBe('69000');
    expect(run.reviewAnswer).toMatchObject({
      boxBefore: 1,
      boxAfter: 2,
      levelBefore: 'checked',
      levelAfter: 'learned',
      isDelayed: true,
    });
    expect(run.reviewAnswer.actualGapMs).toBe(77_000);
    expect(run.reviewAnswer.scheduledGapMs).toBe(60_000);
    expect(run.final.mastery['rn-core-components']?.last_answered_at).toBe(at(163));
    expect(run.reviewAnswer.unlocked).toHaveLength(6);
    expect(progressConsequence(run.reviewAnswer, catalog, 'demo', at(163))).toBe(
      '6 more open in React Native.',
    );
  });

  it('excludes Core components from the reel pools for reel 4 (its review is due within 90 s)', () => {
    // Reel 4 was committed at 1:33 with the review due at 2:26 (53 s away).
    const reel4 = run.settled[4]!;
    expect(reel4.conceptId).toBe('caching');
  });

  it('then the map: 1/40 learned, the dock on Flexbox layout, the Performance and re-renders plan', () => {
    const now = at(170);
    expect(mapCounts(run.final, catalog, now).learned).toBe(1);
    const top = suggestions(run.final, catalog, now)[0]!;
    expect(top.conceptId).toBe('rn-flexbox-layout');
    expect(dockContent(top.conceptId, run.final, catalog, now, top).lines[0]).toBe(
      'Just opened by Core components.',
    );
    const plan = gapPlan('rn-performance-rerenders', run.final, catalog, now);
    expect(plan.pins).toEqual([
      'rn-lists-virtualization',
      'react-components-props',
      'react-state',
      'react-memoization',
      'rn-performance-rerenders',
    ]);
    const dock = dockContent('rn-performance-rerenders', run.final, catalog, now);
    expect(dock.button?.label).toBe('Start with Lists and virtualization');
    expect(dock.lines[0]).toBe('6 items: steps 1-2 of 5. Stops before this unlocks.');
  });

  it('Branch B: the sixth item is the first check on Components and props, then the review at about 2:36', () => {
    const b = runDemo(catalog, DEMO_SEED, 'B');
    expect(describeSequence(b.settled)).toEqual([
      ...PINNED_SEQUENCE.slice(0, 5),
      'card FIRST_CHECK react-components-props 3',
      'card REVIEW_DUE rn-core-components 4',
    ]);
    expect(b.sixthAt226).toMatchObject({
      kind: 'card',
      reason: { code: 'REVIEW_DUE' },
      conceptId: 'rn-core-components',
    });
    expect(b.branchAnswer).toMatchObject({ conceptId: 'react-components-props', boxAfter: 1 });
    expect(b.settled[6]?.reason?.params.elapsed_ms).toBe('70000');
    expect(b.reviewAnswer).toMatchObject({ boxAfter: 2, levelAfter: 'learned' });
    const dock = dockContent('rn-performance-rerenders', b.final, catalog, at(170));
    expect(dock.lines[0]).toBe('3 items: step 1 of 5. Stops before this unlocks.');
  });

  it('a wrong answer on card 1 breaks the loop: retry 20 s, reteach reel, re-check', () => {
    const d = Driver.start(catalog, {
      seed: DEMO_SEED,
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
      now: at(7),
    });
    d.swipe(31 / 28.8);
    d.swipe(32 / 30.4);
    const r = d.answer(false, 9_000, 6_000);
    expect(r.nextDueAt! - (d.now - 6_000)).toBe(20_000);
    expect(d.upcoming[0]?.reason?.code).toBe('RETEACH');
    d.swipe();
    d.swipe();
    expect(d.active).toMatchObject({
      kind: 'card',
      reason: { code: 'REVIEW_DUE', params: { retry: 'true' } },
    });
    expect(plain(reasonSentence(d.active.reason!, catalog, 'card'))).toBe(
      'Second try: Core components.',
    );
  });
});

describe('end-to-end smoke (PLAN "Test plan"): within 180 simulated seconds, in order', () => {
  it('an interest change alters the next pick, a first check appears, the same concept returns as a delayed review, it becomes Learned', () => {
    // A scripted learner on the queue code with a fake clock: the same calls the app makes.
    const d = Driver.start(catalog, {
      seed: DEMO_SEED,
      topicIds: ['react-native'],
      mode: 'focus',
      clock: 'demo',
      now: at(0),
    });
    const events: { t: number; what: string }[] = [];
    const t0 = d.now;
    const nextBefore = d.upcoming[0];
    const conf = d.tap('more_like_this', 12_000);
    if (conf.nextReel?.key !== nextBefore?.key)
      events.push({ t: d.now - t0, what: 'interest change altered the next pick' });
    let checked: string | null = null;
    for (let i = 0; i < 20 && d.now - t0 <= 180_000; i++) {
      d.swipe(d.active.kind === 'reel' ? 1.02 : 1);
      if (d.active.kind !== 'card') continue;
      const card = d.active;
      if (card.reason.code === 'FIRST_CHECK' && !checked) {
        events.push({ t: d.now - t0, what: 'first check' });
        checked = card.conceptId;
      } else if (card.reason.code === 'REVIEW_DUE' && card.conceptId === checked) {
        expect(d.now).toBeGreaterThanOrEqual(d.state.mastery[checked]!.due_at!);
        events.push({ t: d.now - t0, what: 'delayed review of the same concept' });
      }
      const result = d.answer(true, 8_000, 4_000);
      if (
        result.conceptId === checked &&
        displayState(checked, d.state, catalog, d.now).level === 'learned'
      ) {
        events.push({ t: d.now - t0, what: 'Learned' });
        break;
      }
    }
    expect(events.map((e) => e.what)).toEqual([
      'interest change altered the next pick',
      'first check',
      'delayed review of the same concept',
      'Learned',
    ]);
    expect(events.at(-1)!.t).toBeLessThanOrEqual(180_000);
  });
});
