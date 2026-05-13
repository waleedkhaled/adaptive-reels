// The app's single door to the learning agent (@reels/agent). Each call runs
// the pure agent with the current time, keeps the new learner state, and
// replaces the pager's unplayed tail with the agent's plan (PERFORMANCE.md
// 2.5): items up to the highest settled index never change.
import * as agent from '@reels/agent';
import type {
  AnswerResult,
  Catalog,
  QuickActionConfirmation,
  ReelEndInput,
  ReelEndResult,
  Step,
} from '@reels/agent';
import type { ClockSetting, FeedItem, LearnerState, Mode, QuickAction } from '@reels/schemas';
import type { TileState } from '../components/StateTile';
import { graph } from '../lib/library';
import { useApp } from '../lib/store';
import type { CardSlot, ReelSlot } from '../lib/types';

let catalog: Catalog | null = null;
let catalogFor: unknown = null;
/** Highest settled index of this session's list; the tail after it is the agent's plan. */
let frontier = -1;
/** The pager is moving: tail edits wait for the next settle (which re-plans anyway). */
let moving = false;
let dueTimer: ReturnType<typeof setTimeout> | null = null;
let planned: (() => void) | null = null;
/** The feed list put aside while a gap session runs on the same pager. */
let feedStash: { slots: FeedItem[]; settledIndex: number; frontier: number } | null = null;
/**
 * startSession and startGapSession settle their first item inside the agent.
 * The pager's first settle on that item is its first showing, not a revisit.
 */
let settledByAgent: string | null = null;

/** The catalog for the loaded manifest, built once per manifest. */
export function cat(): Catalog {
  const manifest = useApp.getState().manifest;
  if (!manifest) throw new Error('No manifest loaded');
  if (!catalog || catalogFor !== manifest) {
    catalog = agent.buildCatalog(graph, manifest);
    catalogFor = manifest;
  }
  return catalog;
}

function state(): LearnerState {
  const s = useApp.getState().learner;
  if (!s) throw new Error('No learner profile');
  return s;
}

/** Called after every plan change: the controller re-asserts the player window. */
export function onPlanned(handler: () => void): void {
  planned = handler;
}

export function setMoving(value: boolean): void {
  moving = value;
}

/** Keep the new state, then replace everything after `after` with the active item's plan. */
function applyStep(step: Step, after = frontier): void {
  const app = useApp.getState();
  const head = app.slots.slice(0, after + 1);
  if (step.active) {
    const i = head.findIndex((s) => s.key === step.active?.key);
    if (i >= 0) head[i] = step.active;
  }
  app.setLearner(step.state);
  app.setSlots([...head, ...step.upcoming]);
  armDueTimer();
  planned?.();
}

/** One timeout at the next due time: a due review re-plans the tail. */
function armDueTimer(): void {
  if (dueTimer) clearTimeout(dueTimer);
  dueTimer = null;
  const s = useApp.getState().learner;
  if (!s) return;
  const at = agent.nextDueAt(s, Date.now());
  if (at === null) return;
  dueTimer = setTimeout(
    () => {
      dueTimer = null;
      if (moving || !useApp.getState().learner) return;
      applyStep(agent.plan(state(), cat(), Date.now(), 'keep'));
    },
    Math.max(0, at - Date.now()) + 50,
  );
}

export const engine = {
  /** A new profile from onboarding, then its first session. */
  createProfile(input: {
    profileId: string;
    topicIds: string[];
    skipped: boolean;
    seed: number;
    mode: Mode;
    clock: ClockSetting;
  }): void {
    const now = Date.now();
    const learner = agent.createProfile({ ...input, now });
    useApp.getState().setLearner(learner);
    engine.startSession();
  },

  /** Replace progress with a sample profile (UX.md 3.8), then start a session on it. */
  loadSample(
    name: agent.SampleProfileName,
    input: { profileId: string; seed: number; mode: Mode; clock: ClockSetting },
  ): void {
    const learner = agent.sampleProfile(name, { ...input, now: Date.now() }, cat());
    useApp.getState().setLearner(learner);
    engine.startSession();
  },

  /** A new session: after onboarding, on a cold start, or after 30 minutes away (UX.md 3.7). */
  startSession(): void {
    // The agent settles slot 0 itself: the list is the active item, then its plan.
    const step = agent.startSession(state(), cat(), Date.now());
    frontier = 0;
    settledByAgent = step.active?.key ?? null;
    const app = useApp.getState();
    app.setLearner(step.state);
    app.setSlots(step.active ? [step.active, ...step.upcoming] : step.upcoming);
    app.setActive(0);
    app.setSettled(-1);
    // A new list: the pager remounts at the top instead of keeping the old offset.
    useApp.setState((x) => ({ listGen: x.listGen + 1 }));
    armDueTimer();
    planned?.();
  },

  /**
   * An item coming on screen (before the scroll settles): bring its
   * time-dependent reason up to date, e.g. "answered 3m 56s ago" instead of the
   * value from when it was planned. No learner state changes.
   */
  refresh(index: number): void {
    const app = useApp.getState();
    const item = app.slots[index];
    const s = app.learner;
    if (!item || !s || item.kind === 'reel' || index <= frontier) return;
    const fresh = agent.refreshItem(s, cat(), item, Date.now());
    if (fresh === item) return;
    const slots = app.slots.slice();
    slots[index] = fresh;
    app.setSlots(slots);
  },

  sessionExpired(): boolean {
    const s = useApp.getState().learner;
    return !!s && agent.sessionExpired(s, Date.now());
  },

  /** The pager settled on `index`: close the reel being left, show this item, re-plan. */
  settle(
    index: number,
    ended?: ReelEndInput,
  ): { active: FeedItem; revisit: boolean; ended: ReelEndResult | null } {
    moving = false;
    const app = useApp.getState();
    const item = app.slots[index];
    if (!item) throw new Error(`No item at ${index}`);
    if (settledByAgent !== null && item.key === settledByAgent) {
      settledByAgent = null;
      frontier = index;
      return { active: item, revisit: false, ended: ended ? engine.reelEnded(ended) : null };
    }
    settledByAgent = null;
    const step = agent.settle(state(), cat(), item, Date.now(), ended ? { ended } : {});
    if (step.revisit) {
      app.setLearner(step.state);
      return { active: item, revisit: true, ended: step.ended };
    }
    frontier = index;
    applyStep(step, index);
    return { active: step.active ?? item, revisit: false, ended: step.ended };
  },

  /** A reel impression closed without a settle (the feed lost focus). */
  reelEnded(input: ReelEndInput): ReelEndResult {
    const result = agent.reelEnded(state(), cat(), input, Date.now());
    useApp.getState().setLearner(result.state);
    return result;
  },

  quickAction(slot: ReelSlot, action: QuickAction): QuickActionConfirmation {
    const step = agent.quickAction(state(), cat(), { key: slot.key, action }, Date.now());
    applyStep(step);
    return step.confirmation;
  },

  undoQuickAction(slot: ReelSlot): void {
    applyStep(agent.undoQuickAction(state(), cat(), { key: slot.key }, Date.now()));
  },

  answer(slot: CardSlot, choiceIndex: number): AnswerResult {
    const step = agent.answerCard(state(), cat(), { key: slot.key, choiceIndex }, Date.now());
    applyStep(step);
    return step.result;
  },

  /** "Later": back after 2 reels. */
  defer(slot: CardSlot): void {
    applyStep(agent.deferCard(state(), cat(), slot, Date.now()));
  },

  setMode(mode: Mode): void {
    if (!useApp.getState().learner) return;
    applyStep(agent.setMode(state(), cat(), mode, Date.now()));
  },

  /** The demo clock also switches to Focus and rescales pending reviews; returns the rescaled concepts. */
  setClock(clock: ClockSetting): { mode: Mode; rescaled: string[] } | null {
    if (!useApp.getState().learner) return null;
    const step = agent.setClock(state(), cat(), clock, Date.now());
    applyStep(step);
    return { mode: step.mode, rescaled: step.rescaledConceptIds };
  },

  tile(conceptId: string): TileState {
    const s = useApp.getState().learner;
    if (!s) return { level: 'none', locked: false, due: false, justUnlocked: false };
    return agent.displayState(conceptId, s, cat(), Date.now());
  },

  inGap(): boolean {
    return !!useApp.getState().learner?.gap;
  },

  /**
   * Start a gap session from the map on the feed's pager (UX.md 3.6): the feed
   * list is put aside and the session's items take the pager.
   */
  startGap(targetId: string, source: 'map_dock' | 'map_review'): agent.GapPlan {
    const app = useApp.getState();
    const step = agent.startGapSession(state(), cat(), { targetId, source }, Date.now());
    feedStash = { slots: app.slots, settledIndex: Math.max(app.settledIndex, 0), frontier };
    frontier = 0;
    settledByAgent = step.active?.key ?? null;
    app.setLearner(step.state);
    app.setSlots(step.active ? [step.active, ...step.upcoming] : step.upcoming);
    app.setActive(0);
    app.setSettled(-1);
    useApp.setState((x) => ({ listGen: x.listGen + 1 }));
    armDueTimer();
    planned?.();
    return step.plan;
  },

  /** Leave the gap session: the feed list returns where it was, with a fresh plan after it. */
  leaveGap(): { ended: string; itemsServed: number; targetId: string } | null {
    const app = useApp.getState();
    const gap = app.learner?.gap;
    if (!gap) return null;
    const step = agent.leaveGapSession(state(), cat(), Date.now());
    const stash = feedStash ?? { slots: [], settledIndex: 0, frontier: -1 };
    feedStash = null;
    frontier = stash.frontier;
    app.setLearner(step.state);
    app.setSlots([...stash.slots.slice(0, stash.frontier + 1), ...step.upcoming]);
    app.setActive(stash.settledIndex);
    app.setSettled(-1);
    useApp.setState((x) => ({ listGen: x.listGen + 1 }));
    armDueTimer();
    planned?.();
    return { ended: step.ended, itemsServed: step.itemsServed, targetId: gap.target_id };
  },

  box(conceptId: string): number {
    const s = useApp.getState().learner;
    return s ? agent.masteryOf(s, conceptId).box : 0;
  },
};
