// Mastery moves only from retrieval answers (PLAN "Mastery").
import type { ClockSetting, ConceptMastery, LearnerState } from '@reels/schemas';
import type { Catalog } from './catalog';
import { conceptOf } from './catalog';
import { intervalMs, isLearned, isUnlocked, masteryOf } from './state';

export interface AnswerRuleInput {
  correct: boolean;
  now: number;
  clock: ClockSetting;
  /** A prove-it card reaches Checked at most (UX.md 3.3). */
  proveIt: boolean;
  itemId: string;
}

export interface AnswerRuleOutput {
  mastery: ConceptMastery;
  /** Correct but before `dueAt` (or capped by prove-it): no promotion, the due time stays. */
  early: boolean;
  promoted: boolean;
}

/**
 * - Correct at box 0: box 1, due after the box-1 interval.
 * - Correct at box >= 1 on or after `dueAt`: box + 1 (max 4).
 * - Correct before `dueAt`: no promotion; the due time stays.
 * - Wrong: box - 1 (floor 0), due after the retry interval.
 * - Prove-it: never above Checked (box 1).
 */
export function applyAnswerRule(prev: ConceptMastery, input: AnswerRuleInput): AnswerRuleOutput {
  const { correct, now, clock } = input;
  const base = {
    ...prev,
    last_answered_at: now,
    last_item_id: input.itemId,
    correct_count: prev.correct_count + (correct ? 1 : 0),
    wrong_count: prev.wrong_count + (correct ? 0 : 1),
  };
  if (!correct) {
    const box = Math.max(0, prev.box - 1);
    return {
      mastery: {
        ...base,
        box,
        retry: true,
        scheduled_at: now,
        due_at: now + intervalMs(clock, box, true),
      },
      early: false,
      promoted: false,
    };
  }
  const onTime = prev.box === 0 || (prev.due_at !== null && now >= prev.due_at);
  // A prove-it card reaches Checked at most: from box 1 up it can never count.
  if (!onTime || (input.proveIt && prev.box >= 1)) {
    return { mastery: base, early: true, promoted: false };
  }
  const box = Math.min(4, prev.box + 1);
  return {
    mastery: {
      ...base,
      box,
      retry: false,
      scheduled_at: now,
      due_at: now + intervalMs(clock, box, false),
    },
    early: false,
    promoted: box > prev.box,
  };
}

/**
 * Concepts that become unlocked now: dependents of `conceptId`, not yet
 * unlocked, whose prerequisites are all Learned in `state`.
 */
export function newlyUnlocked(state: LearnerState, catalog: Catalog, conceptId: string): string[] {
  const out: string[] = [];
  for (const id of conceptOf(catalog, conceptId).dependents) {
    const dependent = conceptOf(catalog, id);
    if (isUnlocked(state, dependent)) continue;
    if (dependent.prereqs.every((p) => isLearned(state, p))) out.push(id);
  }
  return out;
}

/** "Opens {n}": dependents that would become Open if this concept were Learned now (UX.md 3.5). */
export function opensCount(state: LearnerState, catalog: Catalog, conceptId: string): number {
  let n = 0;
  for (const id of conceptOf(catalog, conceptId).dependents) {
    const dependent = conceptOf(catalog, id);
    if (isUnlocked(state, dependent)) continue;
    if (dependent.prereqs.every((p) => p === conceptId || isLearned(state, p))) n++;
  }
  return n;
}

/**
 * Demo clock switch (UX.md section 2): every pending `dueAt` is rescaled to the
 * new interval table, counted from the answer that scheduled it.
 */
export function rescaleDue(
  state: LearnerState,
  clock: ClockSetting,
): { mastery: LearnerState['mastery']; changed: string[] } {
  const changed: string[] = [];
  let mastery = state.mastery;
  for (const [id, m] of Object.entries(state.mastery)) {
    if (m.due_at === null || m.scheduled_at === null) continue;
    const due = m.scheduled_at + intervalMs(clock, m.box, m.retry);
    if (due === m.due_at) continue;
    if (mastery === state.mastery) mastery = { ...state.mastery };
    mastery[id] = { ...m, due_at: due };
    changed.push(id);
  }
  return { mastery, changed };
}

/** Earliest `due_at` strictly after `now`, for the app's single timer (PERFORMANCE.md 3). */
export function nextDueAt(state: LearnerState, now: number): number | null {
  let best: number | null = null;
  for (const m of Object.values(state.mastery)) {
    if (m.due_at !== null && m.due_at > now && (best === null || m.due_at < best)) best = m.due_at;
  }
  return best;
}

export { masteryOf };
