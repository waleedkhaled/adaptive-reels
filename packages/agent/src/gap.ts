// Gap sessions (UX.md 3.6): planned per step, cut to whole steps within 6 items.
import type {
  CardItem,
  FeedItem,
  GapEnd,
  GapScriptEntry,
  GapState,
  ItemSource,
  LearnerState,
} from '@reels/schemas';
import type { Catalog, ConceptInfo, ReelInfo } from './catalog';
import { conceptOf } from './catalog';
import { RULES } from './config';
import { cardItem, makeCtx, reelItem, reviewParams, summaryItem } from './decide';
import { chooseReteachReel, leastRecentlyShown } from './items';
import { isDue, isUnlocked, levelOf, masteryOf } from './state';
import { orderedUnmetAncestors } from './walk';

export type GapStepState = 'open' | 'seen' | 'locked' | 'due' | 'rewatch';

export interface GapStepPlan {
  conceptId: string;
  state: GapStepState;
  /** 3 for an Open, Seen or locked step (a reel, one more, a card); 1 for a due one. */
  items: number;
}

export interface GapPlan {
  targetId: string;
  /**
   * gap: unmet ancestors then the target; review: one card (due); rewatch: one
   * reel (Learned or Retained, not due); none: nothing can count now.
   */
  kind: 'gap' | 'review' | 'rewatch' | 'none';
  /** Unmet ancestors in gap order, then the target: the map's number pins ({n} = length). */
  pins: string[];
  /** Planned whole steps. */
  steps: GapStepPlan[];
  /** {k}: items planned. */
  items: number;
  /** The plan ends with a check on the target. */
  reachesTarget: boolean;
  /** Why the plan stops before the target. */
  stop: null | 'cap' | 'checked_not_due';
  /** The Checked, not due concept the plan stops at (no button; the dock shows its countdown). */
  blockedBy: string | null;
  /** "Start with {first unmet}"; null when nothing can be served. */
  firstStep: string | null;
}

/** The dock's plan for a concept (UX.md 3.6 and 5.5). Pure: starting it is `startGapSession`. */
export function gapPlan(
  targetId: string,
  state: LearnerState,
  catalog: Catalog,
  now: number,
): GapPlan {
  const target = conceptOf(catalog, targetId);
  const m = masteryOf(state, targetId);
  const base = { targetId, reachesTarget: true, stop: null, blockedBy: null };
  if (m.box >= 1 && isDue(m, now)) {
    const steps = [{ conceptId: targetId, state: 'due' as const, items: 1 }];
    return { ...base, kind: 'review', pins: [targetId], steps, items: 1, firstStep: targetId };
  }
  if (m.box >= 2) {
    const steps = [{ conceptId: targetId, state: 'rewatch' as const, items: 1 }];
    return { ...base, kind: 'rewatch', pins: [targetId], steps, items: 1, firstStep: targetId };
  }
  if (m.box === 1) {
    return {
      ...base,
      kind: 'none',
      pins: [targetId],
      steps: [],
      items: 0,
      reachesTarget: false,
      stop: 'checked_not_due',
      blockedBy: targetId,
      firstStep: null,
    };
  }
  const pins = [...orderedUnmetAncestors(state, catalog, targetId), targetId];
  const steps: GapStepPlan[] = [];
  let items = 0;
  let stop: GapPlan['stop'] = null;
  let blockedBy: string | null = null;
  for (const id of pins) {
    const sm = masteryOf(state, id);
    let step: GapStepPlan;
    if (sm.box >= 1 && isDue(sm, now)) step = { conceptId: id, state: 'due', items: 1 };
    else if (sm.box >= 1) {
      // A card here could not count, so the session stops before this step.
      stop = 'checked_not_due';
      blockedBy = id;
      break;
    } else {
      const concept = conceptOf(catalog, id);
      const level = levelOf(state, id);
      const stepState = !isUnlocked(state, concept) ? 'locked' : level === 'none' ? 'open' : 'seen';
      step = { conceptId: id, state: stepState, items: 3 };
    }
    if (items + step.items > RULES.gapCap) {
      stop = 'cap';
      break;
    }
    steps.push(step);
    items += step.items;
  }
  const reachesTarget = steps.length > 0 && steps[steps.length - 1]?.conceptId === target.id;
  return {
    targetId,
    kind: steps.length > 0 ? 'gap' : 'none',
    pins,
    steps,
    items,
    reachesTarget,
    stop,
    blockedBy,
    firstStep: steps[0]?.conceptId ?? null,
  };
}

/** The item sequence for a plan. */
export function buildScript(plan: GapPlan): GapScriptEntry[] {
  const script: GapScriptEntry[] = [];
  plan.steps.forEach((step, i) => {
    const base = {
      concept_id: step.conceptId,
      step: plan.pins.indexOf(step.conceptId) + 1 || i + 1,
    };
    if (step.state === 'due') script.push({ ...base, type: 'card', role: 'review' });
    else if (step.state === 'rewatch') script.push({ ...base, type: 'reel', role: 'rewatch' });
    else {
      script.push({ ...base, type: 'reel', role: 'learn' });
      script.push({ ...base, type: 'reel', role: 'more' });
      script.push({ ...base, type: 'card', role: 'check' });
    }
  });
  return script;
}

/** How the session ended, or null while it runs (the plan running out counts as done). */
export function gapEnd(gap: GapState): GapEnd | null {
  return gap.ended ?? (gap.served >= gap.script.length ? 'plan_done' : null);
}

/** The next gap-session item, a closing summary, or null when nothing follows. */
export function decideGap(state: LearnerState, catalog: Catalog, now: number): FeedItem | null {
  const gap = state.gap;
  if (!gap) return null;
  const ctx = makeCtx(state, catalog, now);
  const source: ItemSource = gap.kind === 'review' ? 'map_review' : 'gap_session';
  if (gapEnd(gap) !== null) {
    // A gap ends on a summary; the one-card review and the rewatch return to the map.
    return gap.kind === 'gap' && !gap.summary_shown ? summaryItem(ctx, 'gap_end', source) : null;
  }
  const entry = gap.script[gap.served] as GapScriptEntry;
  const concept = conceptOf(catalog, entry.concept_id);
  const info = { index: gap.served + 1, total: gap.script.length };
  const params = {
    target: gap.target_id,
    concept: concept.id,
    step: String(entry.step),
    steps: String(gap.steps_total),
  };
  if (entry.type === 'reel') {
    const reel = gapReel(state, catalog, gap, entry, concept);
    if (!reel) return null;
    return { ...reelItem(ctx, reel, null, 'GAP_SESSION', params, source), gap: info };
  }
  let card: CardItem | null;
  if (gap.kind === 'review') {
    card = cardItem(ctx, concept, 'REVIEW_DUE', reviewParams(ctx, concept.id), {
      pool: null,
      retry: masteryOf(state, concept.id).retry,
      source,
    });
  } else {
    const retry = entry.role === 'recheck';
    card = cardItem(ctx, concept, 'GAP_SESSION', retry ? { ...params, retry: 'true' } : params, {
      pool: null,
      retry,
      source,
    });
  }
  return card ? { ...card, gap: info } : null;
}

function gapReel(
  state: LearnerState,
  catalog: Catalog,
  gap: GapState,
  entry: GapScriptEntry,
  concept: ConceptInfo,
): ReelInfo | null {
  if (concept.reels.length === 0) return null;
  if (entry.role === 'rewatch') return leastRecentlyShown(state, concept.reels);
  if (entry.role === 'reteach') {
    const last = state.session.history[state.session.history.length - 1];
    const source = last?.reel_id ?? concept.reels[0]?.id ?? '';
    return chooseReteachReel(state, catalog, concept.id, source)?.reel ?? null;
  }
  // "A reel in an angle not yet watched, one more reel (another angle)."
  const inSession = new Set(
    state.session.history
      .filter((e) => e.kind === 'reel' && e.source !== 'feed' && e.at >= gap.started_at)
      .map((e) => e.reel_id),
  );
  const finished = new Set(state.exposure[concept.id]?.finished ?? []);
  const fresh = concept.reels.filter((r) => !inSession.has(r.id));
  if (fresh.length === 0) return leastRecentlyShown(state, concept.reels);
  return fresh.find((r) => !finished.has(r.id)) ?? leastRecentlyShown(state, fresh);
}

/** After an answer in a gap session: end on the target's first correct check, or make room for a reteach. */
export function gapAfterAnswer(gap: GapState, conceptId: string, correct: boolean): GapState {
  if (correct) {
    return conceptId === gap.target_id ? { ...gap, ended: 'target_checked' } : gap;
  }
  if (gap.kind !== 'gap') return gap;
  // A wrong answer adds the reteach reel and one re-check inside the 6-item cap;
  // later steps that no longer fit are dropped.
  const room = RULES.gapCap - gap.served;
  if (room < 2) return { ...gap, ended: 'wrong_at_cap' };
  const current = gap.script[gap.served - 1];
  const step = current?.step ?? 1;
  const insert: GapScriptEntry[] = [
    { type: 'reel', concept_id: conceptId, step, role: 'reteach' },
    { type: 'card', concept_id: conceptId, step, role: 'recheck' },
  ];
  let budget = room - insert.length;
  const kept: GapScriptEntry[] = [];
  const rest = gap.script.slice(gap.served);
  let i = 0;
  while (i < rest.length) {
    const groupStep = (rest[i] as GapScriptEntry).step;
    let j = i;
    while (j < rest.length && (rest[j] as GapScriptEntry).step === groupStep) j++;
    if (j - i > budget) break;
    kept.push(...rest.slice(i, j));
    budget -= j - i;
    i = j;
  }
  return { ...gap, script: [...gap.script.slice(0, gap.served), ...insert, ...kept] };
}
