// The feed queue (UX.md 9.2, PERFORMANCE.md 2.5): pure code shared by the app
// and the tests. The persisted learner state advances only through things that
// happened (settle, reel end, quick action, Undo, answer, "Later", settings);
// a re-plan simulates the next items on a throwaway copy and keeps only the
// committed reel.
import type {
  CardItem,
  ClockSetting,
  DisplayLevel,
  FeedItem,
  GapEnd,
  HistoryEntry,
  ItemSource,
  LearnerState,
  Mode,
  QuickAction,
  ReelItem,
  UndoRecord,
  WatchSignal,
} from '@reels/schemas';
import type { Catalog } from './catalog';
import { conceptOf } from './catalog';
import { INTEREST_DELTAS, RULES } from './config';
import {
  decide,
  makeCtx,
  reviewParams,
  sessionSummary,
  twoSkipsKey,
  type DecideOptions,
} from './decide';
import { AgentError } from './errors';
import { buildScript, decideGap, gapAfterAnswer, gapEnd, gapPlan, type GapPlan } from './gap';
import { applyInterest, classifyWatch, type EndedBy, type ReelOutcome } from './interest';
import { chooseReteachReel } from './items';
import { applyAnswerRule, newlyUnlocked, nextDueAt, rescaleDue } from './mastery';
import { addUnique, emptyPending, isDue, levelOf, masteryOf, newSession } from './state';

/** What every queue call returns: the new state, the item on screen and the planned items after it. */
export interface Step {
  state: LearnerState;
  /** The item on screen (null before the first settle). */
  active: FeedItem | null;
  /**
   * Planned items after the active one: cards first (placed directly after the
   * active item), then the committed reel, then 2 provisional items. Replace
   * the unplayed tail of the list with these.
   */
  upcoming: FeedItem[];
}

/**
 * keep: the committed reel stays (settle, due timer, correct answer, "Later", Undo).
 * explicit: the committed reel is re-picked (quick action, wrong answer, mode, clock, gap session).
 */
export type PlanTrigger = 'keep' | 'explicit';

// ---------------------------------------------------------------- shown and next

/**
 * The reducer for "this item is now on screen" (PERFORMANCE.md 2.5): history,
 * cadence, ordinals, presentation counts. No RNG step. `settle` applies it to
 * the learner state; a re-plan applies it to a throwaway copy.
 */
export function shown(
  state: LearnerState,
  catalog: Catalog,
  item: FeedItem,
  now: number,
): LearnerState {
  const session = state.session;
  const entry: HistoryEntry = {
    key: item.key,
    kind: item.kind,
    concept_id: item.conceptId,
    reel_id: item.kind === 'summary' ? null : item.reelId,
    item_id: item.kind === 'card' ? item.itemId : null,
    pool: item.pool,
    code: item.reason?.code ?? null,
    source: item.source,
    ordinal: item.ordinal,
    at: now,
    signal: null,
    action: null,
  };
  const history = [...session.history, entry];
  if (history.length > RULES.historyCap) history.splice(0, history.length - RULES.historyCap);
  let next: LearnerState;
  if (item.kind === 'reel') {
    const topicId = conceptOf(catalog, item.conceptId).topicId;
    const prev = state.reels[item.reelId];
    const pending = state.pending;
    next = {
      ...state,
      reels: {
        ...state.reels,
        [item.reelId]: { shown: (prev?.shown ?? 0) + 1, last_ordinal: item.ordinal, last_at: now },
      },
      topic_reels: { ...state.topic_reels, [topicId]: (state.topic_reels[topicId] ?? 0) + 1 },
      counters: { ...state.counters, reels: Math.max(state.counters.reels, item.ordinal + 1) },
      session: {
        ...session,
        history,
        last_active_at: now,
        shown_reels: addUnique(session.shown_reels, item.reelId),
        reels: session.reels + 1,
        reels_since_card: session.reels_since_card + 1,
        items_since_summary: session.items_since_summary + 1,
        pace_used_key:
          item.reason.code === 'CHANGE_OF_PACE'
            ? (twoSkipsKey(state) ?? session.pace_used_key)
            : session.pace_used_key,
      },
      pending: {
        ...pending,
        // The echo applies to the next reel the agent picks: it survives an
        // intervening card and the reteach reel, which keeps "After the
        // question: {concept}" true. The reteach is consumed by its reel.
        echo: item.reason.code === 'RETEACH' ? pending.echo : null,
        reteach: item.reason.code === 'RETEACH' ? null : pending.reteach,
        pitfall_next: pending.pitfall_next.includes(item.conceptId)
          ? pending.pitfall_next.filter((id) => id !== item.conceptId)
          : pending.pitfall_next,
      },
    };
  } else if (item.kind === 'card') {
    const pending = state.pending;
    const prev = state.items[item.itemId];
    const trigger = item.reason.params.trigger;
    const isProveIt = item.proveIt || trigger === 'too_easy';
    next = {
      ...state,
      items: {
        ...state.items,
        [item.itemId]: { shown: (prev?.shown ?? 0) + 1, answered_at: prev?.answered_at ?? null },
      },
      counters: { ...state.counters, cards: Math.max(state.counters.cards, item.ordinal + 1) },
      session: {
        ...session,
        history,
        last_active_at: now,
        reels_since_card: 0,
        items_since_summary: session.items_since_summary + 1,
      },
      pending: {
        ...pending,
        awaiting: [
          ...pending.awaiting.filter((a) => a.key !== item.key),
          { key: item.key, concept_id: item.conceptId, item_id: item.itemId },
        ],
        prove_it:
          isProveIt && pending.prove_it?.concept_id === item.conceptId ? null : pending.prove_it,
        deferred:
          trigger === 'later'
            ? pending.deferred.filter((d) => d.concept_id !== item.conceptId)
            : pending.deferred,
      },
    };
  } else {
    next = {
      ...state,
      counters: {
        ...state.counters,
        summaries: Math.max(state.counters.summaries, item.ordinal + 1),
      },
      session: {
        ...session,
        history,
        last_active_at: now,
        items_since_summary: 0,
        exhausted_summary: session.exhausted_summary || item.trigger === 'exhausted',
      },
    };
  }
  if (next.gap && item.source !== 'feed') {
    next = {
      ...next,
      gap:
        item.kind === 'summary'
          ? { ...next.gap, summary_shown: true }
          : { ...next.gap, served: next.gap.served + 1 },
    };
  }
  return next;
}

/**
 * One slot (PLAN "Agent spec"): the item after the last one in `state`, and
 * the state as if it were shown. Pure; `plan` calls it 3 to 5 times.
 */
export function next(
  state: LearnerState,
  catalog: Catalog,
  now: number,
  opts: DecideOptions = {},
): { item: FeedItem | null; state: LearnerState } {
  const item = state.gap ? decideGap(state, catalog, now) : decide(state, catalog, now, opts);
  return { item, state: item ? shown(state, catalog, item, now) : state };
}

// ---------------------------------------------------------------- plan and settle

/**
 * Re-plan (PERFORMANCE.md 2.5): decide the items after the active one with the
 * current `now`. Cards (at most 2) go directly after the active item; then the
 * committed reel, kept unless there is none or the trigger is explicit; then
 * 2 provisional items. Call it when the single due timer fires.
 */
export function plan(
  state: LearnerState,
  catalog: Catalog,
  now: number,
  trigger: PlanTrigger = 'keep',
): Step {
  if (catalog.reelCount === 0) throw new AgentError('the manifest has no reels');
  if (state.gap) return planGap(state, catalog, now);
  let planState = state;
  const upcoming: FeedItem[] = [];
  let committed = state.queue.committed;
  let nonReels = 0;
  for (;;) {
    const item = decide(planState, catalog, now, {
      reelOnly: nonReels >= RULES.maxNonReelsBeforeReel,
    });
    if (item.kind !== 'reel') {
      upcoming.push(item);
      planState = shown(planState, catalog, item, now);
      nonReels++;
      continue;
    }
    if (trigger === 'explicit' || committed === null) committed = item;
    upcoming.push(committed);
    planState = shown(planState, catalog, committed, now);
    break;
  }
  for (let i = 0; i < RULES.provisional; i++) {
    const item = decide(planState, catalog, now);
    upcoming.push(item);
    planState = shown(planState, catalog, item, now);
  }
  const queue = { ...state.queue, committed, upcoming: upcoming.map((i) => i.key) };
  return { state: { ...state, queue }, active: state.queue.active, upcoming };
}

function planGap(state: LearnerState, catalog: Catalog, now: number): Step {
  let planState = state;
  const upcoming: FeedItem[] = [];
  for (let i = 0; i < 3; i++) {
    const item = decideGap(planState, catalog, now);
    if (!item) break;
    upcoming.push(item);
    planState = shown(planState, catalog, item, now);
  }
  const queue = { ...state.queue, committed: null, upcoming: upcoming.map((i) => i.key) };
  return { state: { ...state, queue }, active: state.queue.active, upcoming };
}

export interface SettleOptions {
  /** The reel being left, closed first (PERFORMANCE.md 2.5: reel_end, then shown, then re-plan). */
  ended?: ReelEndInput;
}

export interface SettleStep extends Step {
  /** The learner swiped back to an item already shown: nothing changed and nothing was re-planned. */
  revisit: boolean;
  /** Result of `opts.ended`, when given. */
  ended: ReelEndResult | null;
}

/**
 * The scroll settled on `item`: apply `shown` and re-plan. A card's
 * time-dependent reason params (elapsed, reels ago) are fixed here, so render
 * the returned `active`. A settle on an item already shown is a revisit.
 */
export function settle(
  state: LearnerState,
  catalog: Catalog,
  item: FeedItem,
  now: number,
  opts: SettleOptions = {},
): SettleStep {
  let s = state;
  let ended: ReelEndResult | null = null;
  if (opts.ended) {
    ended = reelEnded(s, catalog, opts.ended, now);
    s = ended.state;
  }
  if (s.session.history.some((e) => e.key === item.key)) {
    return { state: s, active: item, upcoming: [], revisit: true, ended };
  }
  const active = refreshItem(s, catalog, item, now);
  s = shown(s, catalog, active, now);
  const q = s.queue;
  const position = q.upcoming.indexOf(item.key);
  const passed = position > 0 ? q.upcoming.slice(0, position) : [];
  let committed = q.committed;
  if (
    committed &&
    (item.kind === 'reel' || committed.key === item.key || passed.includes(committed.key))
  ) {
    committed = null; // it is on screen now, or a flick passed over it
  }
  s = {
    ...s,
    undo: null,
    queue: { active, committed, upcoming: [] },
    counters: passedOver(s, passed),
  };
  return { ...plan(s, catalog, now, 'keep'), active, revisit: false, ended };
}

/**
 * Items a flick passed over were never shown, but the app's list keeps them.
 * Their ordinals are used up, so no later item reuses their key or, for a
 * reel, the player slot its ordinal selects. Keys are `r<n>:…`, `c<n>:…`, `s<n>`.
 */
function passedOver(state: LearnerState, keys: readonly string[]): LearnerState['counters'] {
  const counters = { ...state.counters };
  for (const key of keys) {
    const match = /^([rcs])(\d+)/.exec(key);
    if (!match) continue;
    const next = Number(match[2]) + 1;
    if (match[1] === 'r') counters.reels = Math.max(counters.reels, next);
    else if (match[1] === 'c') counters.cards = Math.max(counters.cards, next);
    else counters.summaries = Math.max(counters.summaries, next);
  }
  return counters;
}

/**
 * Time-dependent content is fixed when the item is shown: a card's elapsed time
 * and "reels ago" (UX.md 5.1), a summary's counts. `settle` applies it; the app
 * also calls it when an item first comes on screen (before the scroll settles),
 * so the strip never shows values from planning time. Pure: no state change.
 */
export function refreshItem(
  state: LearnerState,
  catalog: Catalog,
  item: FeedItem,
  now: number,
): FeedItem {
  if (item.kind === 'summary') return { ...item, summary: sessionSummary(state, now) };
  if (item.kind !== 'card') return item;
  const params = { ...item.reason.params };
  if (item.reason.code === 'REVIEW_DUE') {
    Object.assign(params, reviewParams(makeCtx(state, catalog, now), item.conceptId));
  }
  if (item.reason.code === 'FIRST_CHECK') {
    const exposure = state.exposure[item.conceptId];
    if (exposure) params.reels_ago = String(state.counters.reels - exposure.at_reel + 1);
  }
  if (params.trigger === 'later') {
    const deferral = state.pending.deferred.find((d) => d.concept_id === item.conceptId);
    if (deferral) params.later_reels = String(state.counters.reels - deferral.at_reels);
  }
  return { ...item, reason: { ...item.reason, params } };
}

/**
 * A new session (cold start, or back after 30 minutes away): empty history, no
 * hidden concepts, no pending rule items; then slot 0 is planned and settled.
 */
export function startSession(state: LearnerState, catalog: Catalog, now: number): Step {
  const s: LearnerState = {
    ...state,
    session: newSession(state.session.index + 1, now),
    pending: { ...emptyPending(), pitfall_next: state.pending.pitfall_next },
    queue: { active: null, committed: null, upcoming: [] },
    undo: null,
    gap: null,
  };
  const first = plan(s, catalog, now, 'explicit').upcoming[0] as FeedItem;
  const step = settle(s, catalog, first, now);
  return { state: step.state, active: step.active, upcoming: step.upcoming };
}

/** True when the last activity is 30 minutes or more ago: call `startSession`. */
export function sessionExpired(state: LearnerState, now: number): boolean {
  return now - state.session.last_active_at >= RULES.sessionIdleMs;
}

// ---------------------------------------------------------------- reel end

export interface ReelEndInput {
  /** Key of the reel item being left. */
  key: string;
  /** loops * durationMs + position at close (PERFORMANCE.md 2.6). */
  watchedMs: number;
  loops: number;
  /** Defaults to the manifest duration. */
  durationMs?: number;
  /** Default "swipe". */
  endedBy?: EndedBy;
}

export interface ReelEndResult {
  state: LearnerState;
  /** For `reel_end.outcome`; null when ignored. */
  outcome: ReelOutcome | null;
  signal: WatchSignal | null;
  /** Seen, and eligible for a first check. */
  exposed: boolean;
  /** Unknown key, or this impression already ended (a revisit). */
  ignored: boolean;
}

/**
 * Close a reel impression: one interest signal (none after "Not for me",
 * skip_failed or blur) and exposure when it was not an early skip.
 */
export function reelEnded(
  state: LearnerState,
  catalog: Catalog,
  input: ReelEndInput,
  now: number,
): ReelEndResult {
  const history = state.session.history;
  let index = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.key === input.key) {
      index = i;
      break;
    }
  }
  const entry = history[index];
  const reel = entry?.reel_id ? catalog.reelById.get(entry.reel_id) : undefined;
  if (!entry || entry.kind !== 'reel' || entry.signal !== null || !reel) {
    return { state, outcome: null, signal: null, exposed: false, ignored: true };
  }
  const watch = classifyWatch({
    watchedMs: input.watchedMs,
    durationMs: input.durationMs ?? reel.durationMs,
    loops: input.loops,
    endedBy: input.endedBy ?? 'swipe',
  });
  // "Not for me" voids this impression's watch signals (UX.md 3.2).
  const signal: WatchSignal = entry.action === 'not_for_me' ? 'none' : watch.signal;
  let s = state;
  if (signal === 'completed' || signal === 'rewatch' || signal === 'early_skip') {
    s = applyInterest(s, catalog, reel.conceptId, INTEREST_DELTAS[signal]);
  }
  if (signal === 'completed' || signal === 'rewatch') {
    const topicId = conceptOf(catalog, reel.conceptId).topicId;
    s = {
      ...s,
      interest: {
        ...s.interest,
        engaged_topics: addUnique(s.interest.engaged_topics, topicId),
      },
    };
  }
  if (watch.exposed) {
    const prev = s.exposure[reel.conceptId];
    s = {
      ...s,
      exposure: {
        ...s.exposure,
        [reel.conceptId]: {
          first_at: prev?.first_at ?? now,
          // Reels shown up to and including this one, whatever the call order.
          at_reel: prev?.at_reel ?? entry.ordinal + 1,
          finished: addUnique(prev?.finished ?? [], reel.id),
        },
      },
    };
  }
  const nextHistory = [...s.session.history];
  nextHistory[index] = { ...entry, signal };
  s = { ...s, session: { ...s.session, history: nextHistory, last_active_at: now } };
  return { state: s, outcome: watch.outcome, signal, exposed: watch.exposed, ignored: false };
}

// ---------------------------------------------------------------- quick actions

export interface QuickActionInput {
  /** Key of the reel on screen. */
  key: string;
  action: QuickAction;
}

export interface QuickActionConfirmation {
  action: QuickAction;
  conceptId: string;
  topicId: string;
  /** The item right after the one on screen. */
  next: FeedItem | null;
  /** The reel that plays next: "Next: {concept}" names it. */
  nextReel: ReelItem | null;
  /** A card comes first: "After the question: {concept}". */
  cardFirst: boolean;
  /** "Too easy" on a Checked concept that is not due: ms until a card can count. */
  countdownMs: number | null;
}

export interface QuickActionStep extends Step {
  confirmation: QuickActionConfirmation;
}

/**
 * A quick action on the reel on screen (UX.md 3.2): applied at once, then the
 * next reel is re-picked so the confirmation can name it. A second tap on the
 * same reel replaces the first (the last tap wins).
 */
export function quickAction(
  state: LearnerState,
  catalog: Catalog,
  input: QuickActionInput,
  now: number,
): QuickActionStep {
  const active = state.queue.active;
  if (state.gap) throw new AgentError('a gap session has no quick actions');
  if (!active || active.kind !== 'reel' || active.key !== input.key) {
    throw new AgentError(`quick actions apply to the reel on screen, not "${input.key}"`);
  }
  let s = state.undo?.key === input.key ? restoreUndo(state, state.undo) : state;
  const concept = conceptOf(catalog, active.conceptId);
  const entry = s.session.history.find((e) => e.key === input.key);
  const undo: UndoRecord = {
    key: input.key,
    action: input.action,
    before: {
      interest: s.interest,
      hidden: s.session.hidden,
      pending: s.pending,
      committed: s.queue.committed,
      entry_action: entry?.action ?? null,
    },
  };
  if (input.action === 'more_like_this') {
    s = applyInterest(s, catalog, concept.id, INTEREST_DELTAS.more_like_this);
    s = {
      ...s,
      interest: {
        ...s.interest,
        engaged_topics: addUnique(s.interest.engaged_topics, concept.topicId),
      },
      pending: { ...s.pending, echo: { concept_id: concept.id, key: input.key } },
    };
  } else if (input.action === 'too_easy') {
    s = {
      ...s,
      pending: {
        ...s.pending,
        prove_it: { concept_id: concept.id, from_reel_id: active.reelId },
        pitfall_next: addUnique(s.pending.pitfall_next, concept.id),
      },
    };
  } else {
    s = applyInterest(s, catalog, concept.id, INTEREST_DELTAS.not_for_me);
    s = { ...s, session: { ...s.session, hidden: addUnique(s.session.hidden, concept.id) } };
  }
  s = withEntryAction(s, input.key, input.action);
  s = { ...s, undo };
  let step = plan(s, catalog, now, 'explicit');
  if (input.action === 'not_for_me' && step.state.queue.committed) {
    // "Re-planned after Not for me." on the reel the action replaced (UX.md 5.1).
    const marked = withTrigger(step.state.queue.committed, 'not_for_me');
    step = {
      ...step,
      state: { ...step.state, queue: { ...step.state.queue, committed: marked } },
      upcoming: step.upcoming.map((i) => (i.key === marked.key ? marked : i)),
    };
  }
  const m = masteryOf(step.state, concept.id);
  const nextItem = step.upcoming[0] ?? null;
  return {
    ...step,
    confirmation: {
      action: input.action,
      conceptId: concept.id,
      topicId: concept.topicId,
      next: nextItem,
      nextReel: step.state.queue.committed,
      cardFirst: nextItem?.kind === 'card',
      countdownMs:
        input.action === 'too_easy' && m.box >= 1 && m.due_at !== null && !isDue(m, now)
          ? m.due_at - now
          : null,
    },
  };
}

/** Undo (within 4 s, or until the swipe): restores interest, hidden state, pending rule items and the queue. */
export function undoQuickAction(
  state: LearnerState,
  catalog: Catalog,
  input: { key: string },
  now: number,
): Step {
  if (!state.undo || state.undo.key !== input.key) {
    throw new AgentError(`nothing to undo on "${input.key}"`);
  }
  return plan({ ...restoreUndo(state, state.undo), undo: null }, catalog, now, 'keep');
}

function restoreUndo(state: LearnerState, undo: UndoRecord): LearnerState {
  const { before } = undo;
  const s: LearnerState = {
    ...state,
    interest: before.interest,
    session: { ...state.session, hidden: before.hidden },
    pending: {
      ...state.pending,
      prove_it: before.pending.prove_it,
      echo: before.pending.echo,
      pitfall_next: before.pending.pitfall_next,
    },
    queue: { ...state.queue, committed: before.committed },
    undo: null,
  };
  return withEntryAction(s, undo.key, before.entry_action);
}

function withEntryAction(
  state: LearnerState,
  key: string,
  action: QuickAction | null,
): LearnerState {
  const history = state.session.history.map((e) => (e.key === key ? { ...e, action } : e));
  return { ...state, session: { ...state.session, history } };
}

function withTrigger<T extends ReelItem | CardItem>(item: T, trigger: string): T {
  return { ...item, reason: { ...item.reason, params: { ...item.reason.params, trigger } } };
}

// ---------------------------------------------------------------- cards

export interface AnswerInput {
  /** Key of the card on screen. */
  key: string;
  /** Authored choice index (map the shown option through `card.options`). */
  choiceIndex: number;
}

export interface AnswerResult {
  conceptId: string;
  itemId: string;
  correct: boolean;
  boxBefore: number;
  boxAfter: number;
  levelBefore: DisplayLevel;
  levelAfter: DisplayLevel;
  /** Concepts this answer unlocked (Learned for the first time). */
  unlocked: string[];
  /** Interval set for this review; null on a first answer. */
  scheduledGapMs: number | null;
  /** Time since the previous answer on this concept; null on a first answer. */
  actualGapMs: number | null;
  /** A delayed answer (the concept was answered before). */
  isDelayed: boolean;
  /** When this concept is due next. */
  nextDueAt: number | null;
  /** Correct but too soon to count (or a prove-it from Checked up): nothing moved. */
  early: boolean;
  promoted: boolean;
  proveIt: boolean;
  /** The re-check after a wrong answer. */
  retry: boolean;
  /** After a wrong answer: the reel that follows. `replay` = no unplayed angle left ("The same reel is next."). */
  reteach: { reelId: string; replay: boolean } | null;
  /**
   * This wrong answer reached the session's miss cap (owner decision #8): no
   * reteach and no card for the concept until the next session.
   */
  rested: boolean;
  /** For `card_answered.options_order`. */
  optionsOrder: number[];
  source: ItemSource;
  /** Set when this answer ended a gap session. */
  gapEnded: GapEnd | null;
}

export interface AnswerStep extends Step {
  result: AnswerResult;
}

/** "Check answer" (UX.md 3.3): mastery moves, then the queue re-plans (a wrong answer puts the reteach reel next). */
export function answerCard(
  state: LearnerState,
  catalog: Catalog,
  input: AnswerInput,
  now: number,
): AnswerStep {
  const card = state.queue.active;
  if (!card || card.kind !== 'card' || card.key !== input.key) {
    throw new AgentError(`"${input.key}" is not the card on screen`);
  }
  if (!state.pending.awaiting.some((a) => a.key === card.key)) {
    throw new AgentError(`"${input.key}" was already answered`);
  }
  const item = catalog.itemById.get(card.itemId);
  if (!item) throw new AgentError(`unknown item "${card.itemId}"`);
  const conceptId = card.conceptId;
  const correct = input.choiceIndex === item.answerIndex;
  const prev = masteryOf(state, conceptId);
  const rule = applyAnswerRule(prev, {
    correct,
    now,
    clock: state.settings.clock,
    proveIt: card.proveIt,
    itemId: item.id,
  });
  let s: LearnerState = { ...state, mastery: { ...state.mastery, [conceptId]: rule.mastery } };

  let unlocked: string[] = [];
  if (prev.box < 2 && rule.mastery.box >= 2) {
    unlocked = newlyUnlocked(s, catalog, conceptId);
    if (unlocked.length > 0) {
      const added = Object.fromEntries(unlocked.map((id) => [id, { at: now, by: conceptId }]));
      s = { ...s, unlocked: { ...s.unlocked, ...added } };
    }
  }
  const session = s.session;
  s = {
    ...s,
    items: {
      ...s.items,
      [item.id]: { shown: s.items[item.id]?.shown ?? 1, answered_at: now },
    },
    session: {
      ...session,
      last_active_at: now,
      cards_answered: session.cards_answered + 1,
      cards_correct: session.cards_correct + (correct ? 1 : 0),
      checked:
        prev.box === 0 && rule.mastery.box === 1
          ? addUnique(session.checked, conceptId)
          : session.checked,
      learned:
        prev.box < 2 && rule.mastery.box >= 2
          ? addUnique(session.learned, conceptId)
          : session.learned,
    },
    pending: {
      ...s.pending,
      awaiting: s.pending.awaiting.filter((a) => a.key !== card.key),
      // A put-off question on this concept can no longer count as it was.
      deferred: s.pending.deferred.some((d) => d.concept_id === conceptId)
        ? s.pending.deferred.filter((d) => d.concept_id !== conceptId)
        : s.pending.deferred,
    },
  };

  // Feed misses count toward the session cap; gap sessions have their own cap.
  let rested = false;
  if (!correct && !s.gap) {
    const misses = (s.session.misses?.[conceptId] ?? 0) + 1;
    rested = misses >= RULES.missCap;
    s = {
      ...s,
      session: { ...s.session, misses: { ...(s.session.misses ?? {}), [conceptId]: misses } },
    };
  }

  let reteach: AnswerResult['reteach'] = null;
  if (!correct && !rested) {
    const choice = chooseReteachReel(s, catalog, conceptId, card.reelId);
    if (choice) reteach = { reelId: choice.reel.id, replay: choice.replay };
    if (choice && !s.gap) {
      s = {
        ...s,
        pending: {
          ...s.pending,
          reteach: { concept_id: conceptId, reel_id: choice.reel.id, replay: choice.replay },
        },
      };
    }
  }
  let gapEnded: GapEnd | null = null;
  if (s.gap) {
    const gap = gapAfterAnswer(s.gap, conceptId, correct);
    s = { ...s, gap };
    gapEnded = gapEnd(gap);
  }
  const step = plan(s, catalog, now, correct ? 'keep' : 'explicit');
  const prevAnswered = prev.last_answered_at;
  return {
    ...step,
    result: {
      conceptId,
      itemId: item.id,
      correct,
      boxBefore: prev.box,
      boxAfter: rule.mastery.box,
      levelBefore: levelOf(state, conceptId),
      levelAfter: levelOf(step.state, conceptId),
      unlocked,
      scheduledGapMs:
        prevAnswered !== null && prev.due_at !== null && prev.scheduled_at !== null
          ? prev.due_at - prev.scheduled_at
          : null,
      actualGapMs: prevAnswered !== null ? now - prevAnswered : null,
      isDelayed: prevAnswered !== null,
      nextDueAt: rule.mastery.due_at,
      early: rule.early,
      promoted: rule.promoted,
      proveIt: card.proveIt,
      retry: card.retry,
      reteach,
      rested,
      optionsOrder: [...card.options],
      source: card.source,
      gapEnded,
    },
  };
}

/**
 * "Later" (UX.md 3.3): no mastery or interest change; the card skips cadence
 * and the overdue guard for 2 reels, then returns with its original sentence.
 * Also call it for a card flicked past before it settled.
 */
export function deferCard(
  state: LearnerState,
  catalog: Catalog,
  card: CardItem,
  now: number,
): Step {
  if (state.gap) throw new AgentError('in a gap session "Later" is "Leave session"');
  // Keep the original sentence; the "later" trigger is added again when it returns.
  const params = { ...card.reason.params };
  if (params.trigger === 'later') delete params.trigger;
  delete params.later_reels;
  const isProveIt = card.proveIt || card.reason.params.trigger === 'too_easy';
  const pending = state.pending;
  const s: LearnerState = {
    ...state,
    pending: {
      ...pending,
      awaiting: pending.awaiting.filter((a) => a.key !== card.key),
      prove_it:
        isProveIt && pending.prove_it?.concept_id === card.conceptId ? null : pending.prove_it,
      deferred: [
        ...pending.deferred.filter((d) => d.concept_id !== card.conceptId),
        {
          key: card.key,
          concept_id: card.conceptId,
          item_id: card.itemId,
          code: card.reason.code,
          params,
          pool: card.pool,
          prove_it: card.proveIt,
          at: now,
          at_reels: state.counters.reels,
        },
      ],
    },
  };
  return plan(s, catalog, now, 'keep');
}

// ---------------------------------------------------------------- settings

/** Light or Focus (You tab): re-plans the next reel. */
export function setMode(state: LearnerState, catalog: Catalog, mode: Mode, now: number): Step {
  return plan({ ...state, settings: { ...state.settings, mode } }, catalog, now, 'explicit');
}

export interface ClockStep extends Step {
  /** For `clock_changed.rescaled_concept_ids`. */
  rescaledConceptIds: string[];
  mode: Mode;
}

/**
 * Demo clock (UX.md section 2): on stores the mode and sets Focus; off restores
 * the stored mode. Either way every pending `dueAt` moves to the new table,
 * counted from the answer that scheduled it.
 */
export function setClock(
  state: LearnerState,
  catalog: Catalog,
  clock: ClockSetting,
  now: number,
): ClockStep {
  if (clock === state.settings.clock) {
    return {
      ...plan(state, catalog, now, 'keep'),
      rescaledConceptIds: [],
      mode: state.settings.mode,
    };
  }
  const settings =
    clock === 'demo'
      ? { mode: 'focus' as const, clock, mode_before_demo: state.settings.mode }
      : {
          mode: state.settings.mode_before_demo ?? state.settings.mode,
          clock,
          mode_before_demo: null,
        };
  const { mastery, changed } = rescaleDue(state, clock);
  const step = plan({ ...state, settings, mastery }, catalog, now, 'explicit');
  return { ...step, rescaledConceptIds: changed, mode: settings.mode };
}

// ---------------------------------------------------------------- gap sessions

export interface GapStep extends Step {
  plan: GapPlan;
}

/**
 * Start a gap session from the map (UX.md 3.6) on the feed's pager: the feed
 * queue is put aside, the first item is settled, and `plan`, `settle`,
 * `reelEnded` and `answerCard` work as in the feed until `leaveGapSession`.
 */
export function startGapSession(
  state: LearnerState,
  catalog: Catalog,
  input: { targetId: string; source?: 'map_dock' | 'map_review' },
  now: number,
): GapStep {
  if (state.gap) throw new AgentError('a gap session is already running');
  const gp = gapPlan(input.targetId, state, catalog, now);
  if (gp.kind === 'none') throw new AgentError(`nothing can count for "${input.targetId}" now`);
  const kind = gp.kind;
  const s: LearnerState = {
    ...state,
    undo: null,
    queue: { active: null, committed: null, upcoming: [] },
    gap: {
      target_id: input.targetId,
      kind,
      source: input.source ?? (kind === 'review' ? 'map_review' : 'map_dock'),
      started_at: now,
      steps_total: gp.pins.length,
      script: buildScript(gp),
      served: 0,
      ended: null,
      summary_shown: false,
      at_reels: state.counters.reels,
      saved_queue: state.queue,
    },
  };
  const first = plan(s, catalog, now).upcoming[0];
  if (!first) throw new AgentError(`nothing to serve for "${input.targetId}"`);
  const step = settle(s, catalog, first, now);
  return { state: step.state, active: step.active, upcoming: step.upcoming, plan: gp };
}

export interface LeaveGapStep extends Step {
  ended: GapEnd;
  itemsServed: number;
}

/** End a gap session ("Back to feed", "Leave", back): the feed queue returns and re-plans. */
export function leaveGapSession(state: LearnerState, catalog: Catalog, now: number): LeaveGapStep {
  const gap = state.gap;
  if (!gap) throw new AgentError('no gap session is running');
  const gapCardOpen = state.pending.awaiting.some((a) => a.key === state.queue.active?.key);
  const ended: GapEnd = gap.ended ?? (gapEnd(gap) !== null && !gapCardOpen ? 'plan_done' : 'left');
  const feedActive = gap.saved_queue.active;
  let s: LearnerState = {
    ...state,
    gap: null,
    queue: gap.saved_queue,
    pending: {
      ...state.pending,
      // Only the feed's own card (if one is on screen there) still waits for an answer.
      awaiting: state.pending.awaiting.filter((a) => a.key === feedActive?.key),
    },
  };
  if (ended === 'wrong_at_cap') {
    const last = gap.script[gap.served - 1];
    const lastEntry = state.session.history[state.session.history.length - 1];
    const choice = last
      ? chooseReteachReel(s, catalog, last.concept_id, lastEntry?.reel_id ?? '')
      : null;
    if (last && choice) {
      s = {
        ...s,
        pending: {
          ...s.pending,
          reteach: { concept_id: last.concept_id, reel_id: choice.reel.id, replay: choice.replay },
        },
      };
    }
  }
  const step = plan(s, catalog, now, 'explicit');
  return { ...step, ended, itemsServed: gap.served };
}

export { nextDueAt };
