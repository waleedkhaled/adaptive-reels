// A headless session simulator: a scripted learner drives the queue code with
// a fake clock (PLAN "Test plan", M4 "npm run simulate"). Pure: personas draw
// from keyed random numbers, never Math.random.
import type {
  CardItem,
  ClockSetting,
  FeedItem,
  LearnerState,
  Mode,
  QuickAction,
  ReelItem,
} from '@reels/schemas';
import type { Catalog } from './catalog';
import { leadWord, plain, reasonSentence } from './copy';
import { keyedRandom } from './random';
import {
  answerCard,
  deferCard,
  nextDueAt,
  plan,
  quickAction,
  settle,
  startSession,
  type ReelEndInput,
  type Step,
} from './queue';
import { createProfile } from './state';

export interface ReelDecision {
  /** Fraction of the reel watched before the swipe: 0.1 is an early skip, 1.6 a rewatch. */
  watch: number;
  action?: QuickAction;
}

export interface CardDecision {
  correct: boolean;
  /** Time from card shown to "Check answer" (or "Later"). */
  thinkMs: number;
  later?: boolean;
}

export interface Persona {
  id: string;
  description: string;
  topicIds: string[];
  skipped?: boolean;
  onReel(item: ReelItem, catalog: Catalog, u: number, slot: number): ReelDecision;
  onCard(item: CardItem, catalog: Catalog, u: number, slot: number): CardDecision;
}

const topicOf = (catalog: Catalog, item: FeedItem) =>
  item.conceptId ? (catalog.conceptById.get(item.conceptId)?.topicId ?? '') : '';

/** Built-in personas. "likes-<topic>" and "skips-<topic>" work for any topic id. */
export function persona(id: string): Persona {
  const answer = (rate: number) => (_c: CardItem, _cat: Catalog, u: number) => ({
    correct: u < rate,
    thinkMs: 9_000,
  });
  if (id === 'demo') {
    return {
      id,
      description:
        'Picks React Native, taps More like this on the first reel, watches everything, answers right.',
      topicIds: ['react-native'],
      onReel: (_item, _cat, _u, slot) => ({
        watch: 1.05,
        action: slot === 0 ? 'more_like_this' : undefined,
      }),
      onCard: answer(1),
    };
  }
  if (id === 'curious') {
    return {
      id,
      description:
        'Picks React Native and AI engineering, watches to the end, likes 1 reel in 6, answers 85% right.',
      topicIds: ['react-native', 'ai-engineering'],
      onReel: (_item, _cat, u) => ({
        watch: 1.0,
        action: u < 1 / 6 ? 'more_like_this' : undefined,
      }),
      onCard: answer(0.85),
    };
  }
  if (id === 'skipper') {
    return {
      id,
      description:
        'Skips at onboarding, leaves 70% of reels within a few seconds, answers 60% right.',
      topicIds: [],
      skipped: true,
      onReel: (_item, _cat, u) => ({ watch: u < 0.7 ? 0.1 : 1.0 }),
      onCard: answer(0.6),
    };
  }
  if (id === 'struggler') {
    return {
      id,
      description:
        'Picks Problem solving, watches everything, answers 40% right, taps Later on 1 card in 5.',
      topicIds: ['problem-solving'],
      onReel: () => ({ watch: 1.0 }),
      onCard: (_c, _cat, u) => ({ correct: u < 0.4, thinkMs: 12_000, later: u > 0.8 }),
    };
  }
  if (id === 'too-easy') {
    return {
      id,
      description: 'Picks React + TS, taps Too easy on 1 reel in 4, answers 90% right.',
      topicIds: ['react-typescript'],
      onReel: (_item, _cat, u) => ({ watch: 0.5, action: u < 0.25 ? 'too_easy' : undefined }),
      onCard: answer(0.9),
    };
  }
  const likes = /^likes-(.+)$/.exec(id)?.[1];
  if (likes) {
    return {
      id,
      description: `Completes and likes ${likes} reels (rewatches some), skips the rest, answers 90% right.`,
      topicIds: [],
      skipped: true,
      onReel: (item, cat, u) =>
        topicOf(cat, item) === likes
          ? { watch: u < 0.3 ? 1.6 : 1.0, action: u < 0.5 ? 'more_like_this' : undefined }
          : { watch: 0.1 },
      onCard: answer(0.9),
    };
  }
  const skips = /^skips-(.+)$/.exec(id)?.[1];
  if (skips) {
    return {
      id,
      description: `Skips ${skips} reels within a few seconds, completes the rest, answers 90% right.`,
      topicIds: [],
      skipped: true,
      onReel: (item, cat) => (topicOf(cat, item) === skips ? { watch: 0.1 } : { watch: 1.0 }),
      onCard: answer(0.9),
    };
  }
  throw new Error(`unknown persona "${id}"`);
}

export const PERSONAS = [
  'demo',
  'curious',
  'skipper',
  'struggler',
  'too-easy',
  'likes-<topic>',
  'skips-<topic>',
];

export interface SimOptions {
  catalog: Catalog;
  persona: Persona;
  mode: Mode;
  clock: ClockSetting;
  seed: number;
  /** Epoch ms of the start. */
  start: number;
  /** Stop after this many settled items. */
  slots?: number;
  /** Stop after this much simulated time. */
  durationMs?: number;
}

export interface TraceRow {
  /** ms since the start. */
  t: number;
  slot: number;
  item: FeedItem;
  lead: string | null;
  sentence: string;
  /** What the learner did. */
  outcome: string;
}

export interface SimResult {
  rows: TraceRow[];
  state: LearnerState;
  /** Re-plans triggered by the due timer. */
  timerReplans: number;
}

/** Run a scripted session through the same calls the app makes. */
export function simulate(opts: SimOptions): SimResult {
  const { catalog, persona: p, seed } = opts;
  const maxSlots = opts.slots ?? 40;
  const end = opts.start + (opts.durationMs ?? Infinity);
  let now = opts.start;
  let state = createProfile({
    profileId: `sim-${p.id}`,
    now,
    seed,
    topicIds: p.topicIds,
    skipped: p.skipped,
    mode: opts.mode,
    clock: opts.clock,
  });
  const step: Step = startSession(state, catalog, now);
  state = step.state;
  let active = step.active as FeedItem;
  let upcoming = step.upcoming;
  const rows: TraceRow[] = [];
  let timerReplans = 0;

  // The app's single timer: re-plan at each due time before `until`.
  const runTimers = (until: number) => {
    for (;;) {
      const due = nextDueAt(state, now);
      if (due === null || due >= until) return;
      now = due;
      const replanned = plan(state, catalog, now);
      state = replanned.state;
      upcoming = replanned.upcoming;
      timerReplans++;
    }
  };

  for (let slot = 0; slot < maxSlots && now < end; slot++) {
    const u = keyedRandom(seed, 'persona', slot);
    const row: TraceRow = {
      t: now - opts.start,
      slot,
      item: active,
      lead: active.kind === 'summary' ? null : leadWord(active),
      sentence: active.reason
        ? plain(reasonSentence(active.reason, catalog, active.kind === 'card' ? 'card' : 'reel'))
        : 'Session summary.',
      outcome: '',
    };
    rows.push(row);
    let ended: ReelEndInput | undefined;
    if (active.kind === 'reel') {
      const decision = p.onReel(active, catalog, u, slot);
      const watchedMs = Math.round(decision.watch * active.durationMs);
      const swipeAt = now + watchedMs;
      if (decision.action) {
        runTimers(now + Math.min(watchedMs, 4_000));
        now += Math.min(watchedMs, 4_000);
        const tap = quickAction(state, catalog, { key: active.key, action: decision.action }, now);
        state = tap.state;
        upcoming = tap.upcoming;
        row.outcome = `${decision.action}, `;
      }
      runTimers(swipeAt);
      now = swipeAt;
      const loops = Math.floor(watchedMs / active.durationMs);
      ended = { key: active.key, watchedMs, loops };
    } else if (active.kind === 'card') {
      const decision = p.onCard(active, catalog, u, slot);
      runTimers(now + decision.thinkMs);
      now += decision.thinkMs;
      if (decision.later && active.source === 'feed') {
        const deferred = deferCard(state, catalog, active, now);
        state = deferred.state;
        upcoming = deferred.upcoming;
        row.outcome = 'Later';
      } else {
        const item = catalog.itemById.get(active.itemId);
        const right = item?.answerIndex ?? 0;
        const wrong = active.options.find((o) => o !== right) ?? right;
        const answered = answerCard(
          state,
          catalog,
          { key: active.key, choiceIndex: decision.correct ? right : wrong },
          now,
        );
        state = answered.state;
        upcoming = answered.upcoming;
        const r = answered.result;
        row.outcome = `${r.correct ? 'correct' : 'wrong'} box ${r.boxBefore}->${r.boxAfter}${r.early ? ' (too soon)' : ''}${r.unlocked.length ? `, opens ${r.unlocked.length}` : ''}`;
        runTimers(now + 6_000);
        now += 6_000; // read the explanation, then Continue
      }
    } else {
      runTimers(now + 3_000);
      now += 3_000; // "Keep going"
      row.outcome = 'Keep going';
    }
    const following = upcoming[0];
    if (!following) break;
    const settled = settle(state, catalog, following, now, ended ? { ended } : {});
    if (settled.ended) {
      row.outcome += settled.ended.signal ?? '';
    }
    state = settled.state;
    active = settled.active as FeedItem;
    upcoming = settled.upcoming;
  }
  return { rows, state, timerReplans };
}
