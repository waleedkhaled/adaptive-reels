// A tiny test driver: one learner on one fake clock, calling the queue the way
// the app does (settle with the previous reel's end, answer, Later, taps).
import type { CardItem, FeedItem, LearnerState, QuickAction } from '@reels/schemas';
import type { Catalog } from '../catalog';
import {
  answerCard,
  deferCard,
  nextDueAt,
  plan,
  quickAction,
  settle,
  startSession,
  undoQuickAction,
  type AnswerResult,
  type QuickActionConfirmation,
  type ReelEndResult,
  type Step,
} from '../queue';
import { createProfile, type CreateProfileInput } from '../state';

export const T0 = 1_791_000_000_000;

export class Driver {
  state: LearnerState;
  now: number;
  active: FeedItem;
  upcoming: FeedItem[];
  /** Every settled item, in order. */
  readonly settled: FeedItem[] = [];
  lastEnd: ReelEndResult | null = null;

  constructor(
    readonly catalog: Catalog,
    step: Step,
    now: number,
  ) {
    this.state = step.state;
    this.now = now;
    this.active = step.active as FeedItem;
    this.upcoming = step.upcoming;
    this.settled.push(this.active);
  }

  static start(catalog: Catalog, input: Partial<CreateProfileInput> = {}): Driver {
    const now = input.now ?? T0;
    const state = createProfile({ profileId: 'test', now, seed: 1, ...input });
    return new Driver(catalog, startSession(state, catalog, now), now);
  }

  private apply(step: Step): void {
    this.state = step.state;
    if (step.active) this.active = step.active;
    this.upcoming = step.upcoming;
  }

  /** Advance the clock, firing the single due timer on the way (as the app does). */
  advance(ms: number): void {
    const until = this.now + ms;
    for (;;) {
      const due = nextDueAt(this.state, this.now);
      if (due === null || due > until) break;
      this.now = due;
      this.apply(plan(this.state, this.catalog, this.now));
    }
    this.now = until;
  }

  /** Leave the active item for the next planned one. Reels are watched for `fraction` of their length. */
  swipe(fraction = 1): FeedItem {
    let ended: { key: string; watchedMs: number; loops: number } | undefined;
    if (this.active.kind === 'reel') {
      const watchedMs = Math.round(fraction * this.active.durationMs);
      this.advance(watchedMs);
      ended = {
        key: this.active.key,
        watchedMs,
        loops: Math.floor(watchedMs / this.active.durationMs),
      };
    } else if (this.active.kind === 'summary') this.advance(2_000);
    const following = this.upcoming[0];
    if (!following) throw new Error('nothing planned');
    const step = settle(this.state, this.catalog, following, this.now, ended ? { ended } : {});
    this.lastEnd = step.ended;
    this.apply(step);
    this.settled.push(this.active);
    return this.active;
  }

  /** Answer the card on screen after `thinkMs`, then read for `readMs`. */
  answer(correct: boolean, thinkMs = 8_000, readMs = 4_000): AnswerResult {
    const card = this.card();
    this.advance(thinkMs);
    const right = this.catalog.itemById.get(card.itemId)?.answerIndex ?? 0;
    const wrong = card.options.find((o) => o !== right) ?? right;
    const step = answerCard(
      this.state,
      this.catalog,
      { key: card.key, choiceIndex: correct ? right : wrong },
      this.now,
    );
    this.apply(step);
    this.advance(readMs);
    return step.result;
  }

  later(thinkMs = 3_000): void {
    const card = this.card();
    this.advance(thinkMs);
    this.apply(deferCard(this.state, this.catalog, card, this.now));
  }

  tap(action: QuickAction, afterMs = 3_000): QuickActionConfirmation {
    this.advance(afterMs);
    const step = quickAction(this.state, this.catalog, { key: this.active.key, action }, this.now);
    this.apply(step);
    return step.confirmation;
  }

  undo(afterMs = 1_000): void {
    this.advance(afterMs);
    this.apply(undoQuickAction(this.state, this.catalog, { key: this.active.key }, this.now));
  }

  card(): CardItem {
    if (this.active.kind !== 'card') throw new Error(`expected a card, got ${this.active.kind}`);
    return this.active;
  }

  /** Swipe through reels until a card is on screen (at most `max` items). */
  untilCard(max = 12, fraction = 1): CardItem {
    for (let i = 0; i < max && this.active.kind !== 'card'; i++) this.swipe(fraction);
    return this.card();
  }
}
