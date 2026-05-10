// The 3-minute demo of docs/UX.md section 7, driven through the queue code
// with a fake clock (UX.md 9 "Definition of done and the end-to-end test").
import type { CardItem, FeedItem, LearnerState, ReelItem } from '@reels/schemas';
import type { Catalog } from '../catalog';
import {
  answerCard,
  plan,
  quickAction,
  settle,
  startSession,
  type AnswerResult,
  type QuickActionConfirmation,
  type Step,
} from '../queue';
import { createProfile } from '../state';

export const DEMO_T0 = 1_791_000_000_000;
/** Epoch ms of a demo clock reading "m:ss" given as seconds. */
export const at = (seconds: number) => DEMO_T0 + seconds * 1000;

export interface DemoRun {
  /** Items in the order they were settled. */
  settled: FeedItem[];
  /** The reel committed after reel 1 before "More like this" was tapped. */
  committedBeforeTap: ReelItem | null;
  confirmation: QuickActionConfirmation;
  /** The item planned after reel 4 at 2:04, and after the due timer at 2:26. */
  sixthAt204: FeedItem | null;
  sixthAt226: FeedItem | null;
  firstAnswer: AnswerResult;
  reviewAnswer: AnswerResult;
  /** Branch B only: the answer on the first check of Components and props. */
  branchAnswer: AnswerResult | null;
  final: LearnerState;
}

function first(step: Step): FeedItem {
  const item = step.upcoming[0];
  if (!item) throw new Error('the plan is empty');
  return item;
}

function correctChoice(catalog: Catalog, card: FeedItem): number {
  if (card.kind !== 'card') throw new Error(`expected a card, got ${card.kind} ${card.key}`);
  return catalog.itemById.get(card.itemId)?.answerIndex ?? 0;
}

/**
 * Main branch: reels watched in full, card 1 answered at 1:26, the review shown
 * at 2:35 and answered at 2:43. Branch B: the learner leaves reel 4 at 2:24, so
 * the sixth item is the first check on Components and props; the due timer at
 * 2:26 places the review directly after it.
 */
export function runDemo(catalog: Catalog, seed: number, branch: 'main' | 'B' = 'main'): DemoRun {
  const settled: FeedItem[] = [];
  const duration = (item: FeedItem) => (item.kind === 'reel' ? item.durationMs : 0);
  // Watched from settle to swipe; a loop is counted when the swipe passes the end.
  const watch = (item: FeedItem, ms: number) => {
    const d = duration(item);
    const loops = Math.floor(ms / d);
    return { key: item.key, watchedMs: ms, loops };
  };

  // 0:00-0:07 onboarding: React Native, Start. Focus and the demo clock are on.
  let state = createProfile({
    profileId: 'demo',
    now: at(7),
    seed,
    topicIds: ['react-native'],
    mode: 'focus',
    clock: 'demo',
  });
  const step: Step = startSession(state, catalog, at(7));
  state = step.state;
  const reel1 = step.active as FeedItem;
  settled.push(reel1);
  const committedBeforeTap = state.queue.committed;

  // 0:27 "More like this" on reel 1 (the Map visit at 0:08-0:14 only paused it).
  const tap = quickAction(state, catalog, { key: reel1.key, action: 'more_like_this' }, at(27));
  state = tap.state;

  // 0:45 swipe: reel 1 watched 0:07-0:08 and 0:15-0:45 (31 s, one loop).
  let s = settle(state, catalog, first(tap), at(45), { ended: watch(reel1, 31_000) });
  state = s.state;
  const reel2 = s.active as FeedItem;
  settled.push(reel2);

  // 1:17 swipe to the first check (reel 2 watched 0:45-1:17).
  s = settle(state, catalog, first(s), at(77), { ended: watch(reel2, 32_000) });
  state = s.state;
  const card1 = s.active as FeedItem;
  settled.push(card1);

  // 1:26 "Check answer", correct.
  const a1 = answerCard(
    state,
    catalog,
    { key: card1.key, choiceIndex: correctChoice(catalog, card1) },
    at(86),
  );
  state = a1.state;

  // 1:33 "Continue": reel 3.
  s = settle(state, catalog, first(a1), at(93));
  state = s.state;
  const reel3 = s.active as FeedItem;
  settled.push(reel3);

  // 2:04 swipe: reel 4 (reel 3 watched 1:33-2:04).
  s = settle(state, catalog, first(s), at(124), { ended: watch(reel3, 31_000) });
  state = s.state;
  const reel4 = s.active as FeedItem;
  settled.push(reel4);
  const sixthAt204 = s.upcoming[0] ?? null;

  let branchAnswer: AnswerResult | null = null;
  let sixthAt226: FeedItem | null;
  let review: FeedItem;
  let reviewAt: number;
  if (branch === 'main') {
    // 2:26 the single due timer fires: re-plan with the new `now`.
    const timer = plan(state, catalog, at(146));
    state = timer.state;
    sixthAt226 = timer.upcoming[0] ?? null;
    // 2:35 swipe: reel 4 watched 2:04-2:35.
    s = settle(state, catalog, first(timer), at(155), { ended: watch(reel4, 31_000) });
    state = s.state;
    review = s.active as FeedItem;
    settled.push(review);
    reviewAt = at(163);
  } else {
    // 2:24 the learner leaves reel 4 early and reaches the sixth item before 2:26.
    s = settle(state, catalog, first(s), at(144), { ended: watch(reel4, 20_000) });
    state = s.state;
    const check = s.active as CardItem;
    settled.push(check);
    // 2:26 the due timer places the review directly after this card.
    const timer = plan(state, catalog, at(146));
    state = timer.state;
    sixthAt226 = timer.upcoming[0] ?? null;
    // 2:30 answer, 2:36 "Continue" onto the review.
    const a = answerCard(
      state,
      catalog,
      { key: check.key, choiceIndex: correctChoice(catalog, check) },
      at(150),
    );
    state = a.state;
    branchAnswer = a.result;
    s = settle(state, catalog, first(a), at(156));
    state = s.state;
    review = s.active as FeedItem;
    settled.push(review);
    reviewAt = at(164);
  }
  const a2 = answerCard(
    state,
    catalog,
    { key: review.key, choiceIndex: correctChoice(catalog, review) },
    reviewAt,
  );
  state = a2.state;

  return {
    settled,
    committedBeforeTap,
    confirmation: tap.confirmation,
    sixthAt204,
    sixthAt226,
    firstAnswer: a1.result,
    reviewAnswer: a2.result,
    branchAnswer,
    final: state,
  };
}

/** The pinned sequence of UX.md section 7, as (kind, reel or code, concept). */
export function describeSequence(items: readonly FeedItem[]): string[] {
  return items.map((item) =>
    item.kind === 'reel'
      ? `reel ${item.reelId} ${item.pool ?? '-'} ${item.reason.code}`
      : item.kind === 'card'
        ? `card ${item.reason.code} ${item.conceptId} ${item.options.length}`
        : `summary ${item.trigger}`,
  );
}

export const PINNED_SEQUENCE = [
  'reel rn-core-components--intro deepen DEEPEN_INTEREST',
  'reel react-components-props--intro - MORE_LIKE_THIS',
  'card FIRST_CHECK rn-core-components 3',
  'reel tokens-context-windows--intro explore EXPLORE_NEW',
  'reel caching--intro explore EXPLORE_NEW',
  'card REVIEW_DUE rn-core-components 4',
] as const;
