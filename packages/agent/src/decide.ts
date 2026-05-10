// The slot procedure (PLAN "Slot procedure", amended by UX.md section 9):
// one pure decision for the item after the last one in `state`'s history.
import type {
  CardItem,
  FeedItem,
  HistoryEntry,
  ItemSource,
  LearnerState,
  Pool,
  ReasonCode,
  ReelItem,
  SessionSummary,
  SummaryItem,
} from '@reels/schemas';
import type { Catalog, ConceptInfo, ReelInfo } from './catalog';
import { MODE_CONFIG, POOLS, RULES, SCORE_EPSILON, type ModeConfig } from './config';
import { AgentError } from './errors';
import { cardOptions, chooseReel, pickItem } from './items';
import { nextDueAt } from './mastery';
import { keyedRandom, pickIndex } from './random';
import {
  interestOf,
  isDue,
  isLearned,
  isUnlocked,
  levelOf,
  masteryOf,
  topicInterest,
} from './state';
import { bridgeFor } from './walk';

export type Params = Record<string, string>;

/** A reel candidate in a pool, with its score and the reason it would carry. */
export interface ReelCandidate {
  concept: ConceptInfo;
  reel: ReelInfo;
  score: number;
  code: ReasonCode;
  params: Params;
}

/** A due review in the Review pool (a card). */
export interface ReviewCandidate {
  concept: ConceptInfo;
  /** How overdue, relative to its interval. */
  score: number;
  dueAt: number;
}

export interface Pools {
  review: ReviewCandidate[];
  deepen: ReelCandidate[];
  explore: ReelCandidate[];
  lateral: ReelCandidate[];
}

export interface DecideOptions {
  /** Skip every rule that yields a card or a summary (after 2 of them before the reel). */
  reelOnly?: boolean;
}

/** Everything one decision reads, computed once. */
export interface Ctx {
  s: LearnerState;
  cat: Catalog;
  now: number;
  mode: ModeConfig;
  hidden: ReadonlySet<string>;
  /** Concepts with a card settled (or planned) but not answered. */
  awaiting: ReadonlySet<string>;
  /** Concepts with a "Later" card: only the deferral itself may serve them. */
  deferring: ReadonlySet<string>;
  /** Concepts missed RULES.missCap times this session: no cards until the next session. */
  rested: ReadonlySet<string>;
  /** Reel history entries, most recent first. */
  reelHistory: readonly HistoryEntry[];
  /** No-repeat filter: concepts of the previous 2 reels (UX.md 9.7). */
  recentConcepts: ReadonlySet<string>;
  shownThisSession: ReadonlySet<string>;
  reelOrdinal: number;
  cardOrdinal: number;
}

export function makeCtx(s: LearnerState, cat: Catalog, now: number): Ctx {
  const reelHistory: HistoryEntry[] = [];
  const history = s.session.history;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i] as HistoryEntry;
    if (entry.kind === 'reel') reelHistory.push(entry);
  }
  const recentConcepts = new Set<string>();
  for (const entry of reelHistory.slice(0, RULES.noRepeatReels)) {
    if (entry.concept_id) recentConcepts.add(entry.concept_id);
  }
  return {
    s,
    cat,
    now,
    mode: MODE_CONFIG[s.settings.mode],
    hidden: new Set(s.session.hidden),
    awaiting: new Set(s.pending.awaiting.map((a) => a.concept_id)),
    deferring: new Set(s.pending.deferred.map((d) => d.concept_id)),
    rested: restedConcepts(s),
    reelHistory,
    recentConcepts,
    shownThisSession: new Set(s.session.shown_reels),
    reelOrdinal: s.counters.reels,
    cardOrdinal: s.counters.cards,
  };
}

/** Concepts that reached the session's miss cap (owner decision #8). */
export function restedConcepts(s: LearnerState): Set<string> {
  const misses = s.session.misses ?? {};
  return new Set(Object.keys(misses).filter((id) => (misses[id] ?? 0) >= RULES.missCap));
}

/** One slot decision for the feed. Never returns nothing while the catalog has a reel. */
export function decide(
  s: LearnerState,
  cat: Catalog,
  now: number,
  opts: DecideOptions = {},
): FeedItem {
  const ctx = makeCtx(s, cat, now);
  const reteach = reteachReel(ctx); // rule 1
  if (reteach) return reteach;
  if (!opts.reelOnly) {
    const card =
      proveItCard(ctx) ?? // rule 2
      overdueCard(ctx) ?? // rule 3
      returningCard(ctx) ?? // "Later" returns after 2 reels with its sentence
      cadenceCard(ctx); // rule 4
    if (card) return card;
  }
  const echo = echoReel(ctx); // rule 5
  if (echo) return echo;
  // The summary (UX.md 3.7) waits for a promised echo: "Next: {concept}" stays true.
  const summary = opts.reelOnly ? null : summaryDue(ctx);
  if (summary) return summary;
  return (
    paceReel(ctx) ?? // rule 6
    drawnItem(ctx, opts.reelOnly === true) ?? // rule 7
    fallbackReel(ctx)
  );
}

// ---------------------------------------------------------------- item builders

export function reelItem(
  ctx: Ctx,
  reel: ReelInfo,
  pool: Pool | null,
  code: ReasonCode,
  params: Params,
  source: ItemSource = 'feed',
): ReelItem {
  return {
    kind: 'reel',
    key: `r${ctx.reelOrdinal}:${reel.id}`,
    conceptId: reel.conceptId,
    reelId: reel.id,
    angle: reel.angle,
    ordinal: ctx.reelOrdinal,
    durationMs: reel.durationMs,
    pool,
    reason: { code, params },
    source,
    gap: null,
  };
}

export interface CardOptions {
  pool: Pool | null;
  proveIt?: boolean;
  proveItFrom?: string | null;
  itemId?: string;
  retry?: boolean;
  source?: ItemSource;
}

export function cardItem(
  ctx: Ctx,
  concept: ConceptInfo,
  code: ReasonCode,
  params: Params,
  opts: CardOptions,
): CardItem | null {
  const item = opts.itemId
    ? (ctx.cat.itemById.get(opts.itemId) ?? null)
    : pickItem(ctx.s, ctx.cat, concept.id, ctx.cardOrdinal, opts.proveItFrom ?? null);
  if (!item) return null;
  const box = masteryOf(ctx.s, concept.id).box;
  const presentation = ctx.s.items[item.id]?.shown ?? 0;
  return {
    kind: 'card',
    key: `c${ctx.cardOrdinal}:${item.id}`,
    conceptId: concept.id,
    itemId: item.id,
    reelId: item.reelId,
    ordinal: ctx.cardOrdinal,
    box,
    options: cardOptions(ctx.s.seed, item, presentation, box),
    proveIt: opts.proveIt ?? false,
    retry: opts.retry ?? false,
    pool: opts.pool,
    reason: { code, params },
    source: opts.source ?? 'feed',
    gap: null,
  };
}

export function sessionSummary(s: LearnerState, now: number): SessionSummary {
  return {
    reelsWatched: s.session.reels,
    questionsAnswered: s.session.cards_answered,
    correct: s.session.cards_correct,
    checkedIds: [...s.session.checked],
    learnedIds: [...s.session.learned],
    nextReviewAt: nextDueAt(s, now),
  };
}

export function summaryItem(
  ctx: Ctx,
  trigger: SummaryItem['trigger'],
  source: ItemSource = 'feed',
): SummaryItem {
  return {
    kind: 'summary',
    key: `s${ctx.s.counters.summaries}`,
    conceptId: null,
    pool: null,
    reason: null,
    source,
    ordinal: ctx.s.counters.summaries,
    trigger,
    summary: sessionSummary(ctx.s, ctx.now),
  };
}

/** REVIEW_DUE params: box and elapsed are fixed when the card is shown (settle refreshes them). */
export function reviewParams(ctx: Ctx, conceptId: string): Params {
  const m = masteryOf(ctx.s, conceptId);
  const params: Params = {
    concept: conceptId,
    box: String(m.box),
    elapsed_ms: String(Math.max(0, ctx.now - (m.last_answered_at ?? ctx.now))),
  };
  if (m.retry) params.retry = 'true';
  return params;
}

// ---------------------------------------------------------------- filters

/** Honesty gap (UX.md 9.8): no reel while the concept's review is due or due within 90 s. */
export function inHonestyGap(ctx: Ctx, conceptId: string): boolean {
  const due = masteryOf(ctx.s, conceptId).due_at;
  return due !== null && due - ctx.now <= RULES.honestyGapMs;
}

/** The reel a pool may serve for a concept, or null when a filter excludes it. */
export function reelFor(ctx: Ctx, concept: ConceptInfo): ReelInfo | null {
  if (!isUnlocked(ctx.s, concept)) return null;
  if (ctx.hidden.has(concept.id) || ctx.awaiting.has(concept.id)) return null;
  if (ctx.recentConcepts.has(concept.id)) return null;
  if (inHonestyGap(ctx, concept.id)) return null;
  return chooseReel(ctx.s, concept, ctx.shownThisSession);
}

function cardAllowed(ctx: Ctx, conceptId: string): boolean {
  return (
    !ctx.hidden.has(conceptId) &&
    !ctx.awaiting.has(conceptId) &&
    !ctx.deferring.has(conceptId) &&
    !ctx.rested.has(conceptId)
  );
}

/** Due reviews (box >= 1, or a box-0 retry; UX.md 9.1), most overdue first. */
export function dueReviews(ctx: Ctx): ReviewCandidate[] {
  const out: ReviewCandidate[] = [];
  for (const [id, m] of Object.entries(ctx.s.mastery)) {
    if (!isDue(m, ctx.now) || !cardAllowed(ctx, id)) continue;
    const concept = ctx.cat.conceptById.get(id);
    if (!concept || concept.reels.every((r) => r.items.length === 0)) continue;
    const dueAt = m.due_at as number;
    const interval = Math.max(1, dueAt - (m.scheduled_at ?? dueAt));
    out.push({ concept, score: (ctx.now - dueAt) / interval, dueAt });
  }
  return out.sort(
    (a, b) => b.score - a.score || a.dueAt - b.dueAt || a.concept.index - b.concept.index,
  );
}

/** Concepts exposed at least one reel ago and never answered, oldest exposure first. */
export function pendingFirstChecks(ctx: Ctx): ConceptInfo[] {
  const out: { concept: ConceptInfo; at: number; reel: number }[] = [];
  for (const [id, e] of Object.entries(ctx.s.exposure)) {
    if (masteryOf(ctx.s, id).last_answered_at !== null || !cardAllowed(ctx, id)) continue;
    if (ctx.s.counters.reels - e.at_reel < RULES.firstCheckAfterReels) continue;
    const concept = ctx.cat.conceptById.get(id);
    if (concept) out.push({ concept, at: e.first_at, reel: e.at_reel });
  }
  out.sort((a, b) => a.at - b.at || a.reel - b.reel || a.concept.index - b.concept.index);
  return out.map((o) => o.concept);
}

// ---------------------------------------------------------------- rules 1 to 4

function reteachReel(ctx: Ctx): ReelItem | null {
  const pending = ctx.s.pending.reteach;
  const reel = pending ? ctx.cat.reelById.get(pending.reel_id) : undefined;
  if (!pending || !reel) return null;
  const params: Params = { concept: pending.concept_id, trigger: 'wrong_answer' };
  if (pending.replay) params.replay = 'true';
  return reelItem(ctx, reel, null, 'RETEACH', params);
}

function proveItCard(ctx: Ctx): CardItem | null {
  const pending = ctx.s.pending.prove_it;
  const concept = pending ? ctx.cat.conceptById.get(pending.concept_id) : undefined;
  if (!pending || !concept) return null;
  const m = masteryOf(ctx.s, concept.id);
  if (isDue(m, ctx.now)) {
    // "Too easy" on a due concept serves its review, marked on the lead (UX.md 5.1).
    const params = { ...reviewParams(ctx, concept.id), trigger: 'too_easy' };
    return cardItem(ctx, concept, 'REVIEW_DUE', params, { pool: null, retry: m.retry });
  }
  const params: Params = { concept: concept.id, trigger: 'too_easy', box: String(m.box) };
  if (m.box >= 1 && m.due_at !== null) params.due_at = String(m.due_at);
  return cardItem(ctx, concept, 'PROVE_IT', params, {
    pool: null,
    proveIt: true,
    proveItFrom: pending.from_reel_id,
  });
}

/**
 * Overdue guard (UX.md 9.2): "next slot" (Focus) is the item after the one on
 * screen at `dueAt`; "within 2 slots" (Light) is no later than the second.
 */
export function guardFires(ctx: Ctx, dueAt: number): boolean {
  let shownSinceDue = 0;
  for (const entry of ctx.s.session.history) if (entry.at > dueAt) shownSinceDue++;
  return shownSinceDue + 1 >= ctx.mode.overdueSlots;
}

function overdueCard(ctx: Ctx): CardItem | null {
  for (const review of dueReviews(ctx)) {
    if (!guardFires(ctx, review.dueAt)) continue;
    const card = reviewCard(ctx, review.concept, null);
    if (card) return card;
  }
  return null;
}

function reviewCard(ctx: Ctx, concept: ConceptInfo, pool: Pool | null): CardItem | null {
  const params = reviewParams(ctx, concept.id);
  return cardItem(ctx, concept, 'REVIEW_DUE', params, {
    pool,
    retry: masteryOf(ctx.s, concept.id).retry,
  });
}

function returningCard(ctx: Ctx): CardItem | null {
  for (const d of ctx.s.pending.deferred) {
    const later = ctx.s.counters.reels - d.at_reels;
    if (later < RULES.deferReels) continue;
    if (ctx.hidden.has(d.concept_id) || ctx.awaiting.has(d.concept_id)) continue;
    if (ctx.rested.has(d.concept_id)) continue;
    const concept = ctx.cat.conceptById.get(d.concept_id);
    const m = masteryOf(ctx.s, d.concept_id);
    if (!concept || (m.last_answered_at !== null && m.last_answered_at > d.at)) continue;
    if (d.code === 'REVIEW_DUE' && !isDue(m, ctx.now)) continue;
    const params: Params = { ...d.params, trigger: 'later', later_reels: String(later) };
    if (d.code === 'REVIEW_DUE') Object.assign(params, reviewParams(ctx, d.concept_id));
    const card = cardItem(ctx, concept, d.code, params, {
      pool: d.pool,
      itemId: d.item_id,
      proveIt: d.prove_it,
      retry: d.code === 'REVIEW_DUE' && m.retry,
    });
    if (card) return card;
  }
  return null;
}

function cadenceCard(ctx: Ctx): CardItem | null {
  if (ctx.s.session.reels_since_card < ctx.mode.cardEvery) return null;
  for (const review of dueReviews(ctx)) {
    const card = reviewCard(ctx, review.concept, null);
    if (card) return card;
  }
  for (const concept of pendingFirstChecks(ctx)) {
    const exposure = ctx.s.exposure[concept.id];
    const reelsAgo = exposure ? ctx.s.counters.reels - exposure.at_reel + 1 : 1;
    const params = { concept: concept.id, reels_ago: String(reelsAgo) };
    const card = cardItem(ctx, concept, 'FIRST_CHECK', params, { pool: null });
    if (card) return card;
  }
  return null;
}

function summaryDue(ctx: Ctx): SummaryItem | null {
  const session = ctx.s.session;
  if (session.items_since_summary >= ctx.mode.summaryAfter && session.cards_answered >= 1) {
    return summaryItem(ctx, 'count');
  }
  if (!session.exhausted_summary && session.reels > 0 && everyUnlockedReelShown(ctx)) {
    return summaryItem(ctx, 'exhausted');
  }
  return null;
}

function everyUnlockedReelShown(ctx: Ctx): boolean {
  let any = false;
  for (const concept of ctx.cat.concepts) {
    if (!isUnlocked(ctx.s, concept) || ctx.hidden.has(concept.id)) continue;
    for (const reel of concept.reels) {
      any = true;
      if (!ctx.shownThisSession.has(reel.id)) return false;
    }
  }
  return any;
}

// ---------------------------------------------------------------- rules 5 to 7

function echoReel(ctx: Ctx): ReelItem | null {
  const echo = ctx.s.pending.echo;
  const source = echo ? ctx.cat.conceptById.get(echo.concept_id) : undefined;
  if (!echo || !source) return null;
  const byId = (id: string) => ctx.cat.conceptById.get(id) as ConceptInfo;
  const topicMates = ctx.cat.concepts.filter(
    (c) => c.topicId === source.topicId && c.id !== source.id,
  );
  const siblings = topicMates.filter((c) =>
    source.isRoot ? c.isRoot : c.prereqs.some((p) => source.prereqs.includes(p)),
  );
  // Nearest first: RELATED_TO neighbours, then siblings, then the rest of the topic.
  for (const tier of [source.related.map(byId), siblings, topicMates]) {
    const candidates: ReelCandidate[] = [];
    for (const concept of tier) {
      const reel = reelFor(ctx, concept);
      if (!reel) continue;
      const params = { source: source.id, concept: concept.id, trigger: 'more_like_this' };
      candidates.push({
        concept,
        reel,
        score: interestOf(ctx.s, ctx.cat, concept.id),
        code: 'MORE_LIKE_THIS',
        params,
      });
    }
    if (candidates.length > 0) {
      const best = topCandidate(candidates, keyedRandom(ctx.s.seed, 'echo', ctx.reelOrdinal));
      return reelItem(ctx, best.reel, null, best.code, best.params);
    }
  }
  return null;
}

/** Key of the newer of the last two ended reels when both were early skips and not yet used. */
export function twoSkipsKey(s: LearnerState): string | null {
  const ended: HistoryEntry[] = [];
  const history = s.session.history;
  for (let i = history.length - 1; i >= 0 && ended.length < 2; i--) {
    const entry = history[i] as HistoryEntry;
    if (entry.kind === 'reel' && entry.signal !== null && entry.signal !== 'none') {
      ended.push(entry);
    }
  }
  if (ended.length < 2 || ended.some((e) => e.signal !== 'early_skip')) return null;
  const newer = (ended[0] as HistoryEntry).key;
  return newer === s.session.pace_used_key ? null : newer;
}

function paceReel(ctx: Ctx): ReelItem | null {
  if (twoSkipsKey(ctx.s) === null) return null;
  const pool = explorePool(ctx);
  if (pool.length === 0) return null;
  const best = topCandidate(pool, keyedRandom(ctx.s.seed, 'pace', ctx.reelOrdinal));
  const params = { concept: best.concept.id, topic: best.concept.topicId, trigger: 'skips' };
  return reelItem(ctx, best.reel, 'explore', 'CHANGE_OF_PACE', params);
}

/** Pool membership for the next reel slot (exported for tests and the simulator). */
export function computePools(ctx: Ctx, includeReview = true): Pools {
  return {
    // Review holds cards, so the honesty gap (a reel-pool rule) never applies to it.
    review: includeReview ? dueReviews(ctx) : [],
    deepen: deepenPool(ctx),
    explore: explorePool(ctx),
    lateral: lateralPool(ctx),
  };
}

function deepenPool(ctx: Ctx): ReelCandidate[] {
  const out: ReelCandidate[] = [];
  for (const concept of ctx.cat.concepts) {
    if (isLearned(ctx.s, concept.id)) continue;
    const interest = interestOf(ctx.s, ctx.cat, concept.id);
    if (interest < RULES.deepenMinInterest) continue;
    const reel = reelFor(ctx, concept);
    if (!reel) continue;
    const unlock = ctx.s.unlocked[concept.id];
    const justUnlocked =
      unlock !== undefined && !concept.isRoot && concept.reels.every((r) => !ctx.s.reels[r.id]);
    const started = levelOf(ctx.s, concept.id) !== 'none';
    const score =
      interest +
      (justUnlocked ? RULES.deepenJustUnlockedBonus : 0) +
      (started ? RULES.deepenStartedBonus : 0);
    if (justUnlocked) {
      const params = { concept: concept.id, prereq: unlock.by, topic: concept.topicId };
      out.push({ concept, reel, score, code: 'DEEPEN_UNLOCKED', params });
    } else {
      const params = {
        concept: concept.id,
        topic: concept.topicId,
        cause: deepenCause(ctx, concept),
      };
      out.push({ concept, reel, score, code: 'DEEPEN_INTEREST', params });
    }
  }
  return out;
}

/** DEEPEN_INTEREST variant (UX.md 5.1): watched or liked, else picked, else default. */
function deepenCause(ctx: Ctx, concept: ConceptInfo): string {
  if (ctx.s.interest.engaged_topics.includes(concept.topicId)) return 'watched';
  if (!ctx.s.onboarding.skipped && ctx.s.onboarding.topic_ids.includes(concept.topicId)) {
    return 'picked';
  }
  return 'default';
}

function explorePool(ctx: Ctx): ReelCandidate[] {
  const out: ReelCandidate[] = [];
  for (const concept of ctx.cat.concepts) {
    const seen = ctx.s.topic_reels[concept.topicId] ?? 0;
    if (seen > RULES.exploreMaxSeen) continue;
    if (topicInterest(ctx.s, concept.topicId) <= RULES.exploreMinTopicInterest) continue;
    const reel = reelFor(ctx, concept);
    if (!reel) continue;
    // Least-seen topic first, then 0.25 x I(c).
    const score = -seen + RULES.exploreInterestWeight * interestOf(ctx.s, ctx.cat, concept.id);
    const params = { concept: concept.id, topic: concept.topicId, seen: String(seen) };
    out.push({ concept, reel, score, code: 'EXPLORE_NEW', params });
  }
  return out;
}

/** "Liked": "More like this" tapped, or a rewatch (an extra loop of 50% or more). */
function liked(entry: HistoryEntry): boolean {
  return entry.action === 'more_like_this' || entry.signal === 'rewatch';
}

function lateralPool(ctx: Ctx): ReelCandidate[] {
  const best = new Map<string, ReelCandidate>();
  ctx.reelHistory.slice(0, RULES.lateralWindow).forEach((entry, k) => {
    const source = entry.concept_id ? ctx.cat.conceptById.get(entry.concept_id) : undefined;
    if (!source || !liked(entry)) return;
    const recency = (RULES.lateralWindow - k) / RULES.lateralWindow;
    const score = interestOf(ctx.s, ctx.cat, source.id) * recency;
    for (const neighbourId of source.related) {
      const neighbour = ctx.cat.conceptById.get(neighbourId);
      if (!neighbour || neighbour.id === source.id) continue;
      let target = neighbour;
      let code: ReasonCode = 'LATERAL_RELATED';
      let params: Params = { concept: neighbour.id, source: source.id };
      if (!isUnlocked(ctx.s, neighbour)) {
        const bridgeId = bridgeFor(ctx.s, ctx.cat, neighbour.id);
        const bridge = bridgeId ? ctx.cat.conceptById.get(bridgeId) : undefined;
        if (!bridge) continue;
        target = bridge;
        code = 'LATERAL_BRIDGE';
        params = { concept: bridge.id, target: neighbour.id, source: source.id };
      }
      if (target.id === source.id) continue;
      const reel = reelFor(ctx, target);
      if (!reel) continue;
      const previous = best.get(target.id);
      if (!previous || score > previous.score + SCORE_EPSILON) {
        best.set(target.id, { concept: target, reel, score, code, params });
      }
    }
  });
  return [...best.values()].sort((a, b) => a.concept.index - b.concept.index);
}

/** Weighted draw over the non-empty pools; empty pools give their weight to the rest. */
export function drawPool(
  weights: Readonly<Record<Pool, number>>,
  nonEmpty: readonly Pool[],
  u: number,
): Pool {
  if (nonEmpty.length === 0) throw new AgentError('drawPool needs a non-empty pool');
  const total = nonEmpty.reduce((sum, p) => sum + weights[p], 0);
  if (total <= 0) return nonEmpty[pickIndex(nonEmpty.length, u)] as Pool;
  let acc = 0;
  for (const pool of nonEmpty) {
    acc += weights[pool] / total;
    if (u < acc) return pool;
  }
  return nonEmpty[nonEmpty.length - 1] as Pool;
}

/** Top-scored candidate; ties (within 1e-9) broken by the seeded draw over node order. */
export function topCandidate<T extends { score: number; concept: ConceptInfo }>(
  candidates: readonly T[],
  u: number,
): T {
  let max = -Infinity;
  for (const c of candidates) max = Math.max(max, c.score);
  const tied = candidates
    .filter((c) => c.score >= max - SCORE_EPSILON)
    .sort((a, b) => a.concept.index - b.concept.index);
  return tied[pickIndex(tied.length, u)] as T;
}

function drawnItem(ctx: Ctx, reelOnly: boolean): FeedItem | null {
  const pools = computePools(ctx, !reelOnly);
  const nonEmpty = POOLS.filter((p) => pools[p].length > 0);
  if (nonEmpty.length === 0) return null;
  const pool = drawPool(
    ctx.mode.weights,
    nonEmpty,
    keyedRandom(ctx.s.seed, 'pool', ctx.reelOrdinal),
  );
  if (pool === 'review') {
    const review = topCandidate(
      pools.review,
      keyedRandom(ctx.s.seed, 'tie', pool, ctx.cardOrdinal),
    );
    const card = reviewCard(ctx, review.concept, 'review');
    if (card) return card;
    return drawnItem(ctx, true);
  }
  const best = topCandidate(pools[pool], keyedRandom(ctx.s.seed, 'tie', pool, ctx.reelOrdinal));
  return reelItem(ctx, best.reel, pool, best.code, best.params);
}

/**
 * All pools empty: the least recently seen unlocked reel, so the feed never
 * dead-ends. Filters relax in steps rather than return nothing.
 */
function fallbackReel(ctx: Ctx): ReelItem {
  const unlocked = ctx.cat.concepts.filter((c) => isUnlocked(ctx.s, c));
  const tiers = [
    unlocked.filter(
      (c) =>
        !ctx.hidden.has(c.id) &&
        !ctx.awaiting.has(c.id) &&
        !ctx.recentConcepts.has(c.id) &&
        !inHonestyGap(ctx, c.id),
    ),
    unlocked.filter((c) => !ctx.hidden.has(c.id)),
    unlocked,
    ctx.cat.concepts,
  ];
  for (const tier of tiers) {
    // Least recently seen first; among reels never seen (or seen at the same
    // ordinal), the concept the learner is most interested in.
    let best: ReelInfo | null = null;
    let bestKey: [number, number] = [Infinity, Infinity];
    for (const concept of tier) {
      const interest = interestOf(ctx.s, ctx.cat, concept.id);
      for (const reel of concept.reels) {
        const key: [number, number] = [ctx.s.reels[reel.id]?.last_ordinal ?? -1, -interest];
        if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1] - SCORE_EPSILON)) {
          best = reel;
          bestKey = key;
        }
      }
    }
    if (best) return reelItem(ctx, best, null, 'FALLBACK', {});
  }
  throw new AgentError('the manifest has no reels');
}
