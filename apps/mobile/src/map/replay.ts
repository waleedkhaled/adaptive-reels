// The map replay (UX.md 3.5): on the first open after a level change, the
// staged topic shows its old state, then the changed tiles fill (400 ms), then
// each concept that opened gets its outline and NEW, 90 ms apart (from 900 ms),
// and the dock slides up at 1800 ms. Only the staged topic animates; changes
// elsewhere just appear. Reduce Motion shows the final state at once.
import { useEffect, useState } from 'react';
import type { TileState } from '../components/StateTile';
import type { MapView, TopicView } from './model';

export interface ReplayPlan {
  /** Concepts in the staged topic whose level changed, with their old level. */
  changed: Map<string, TileState['level']>;
  /** Concepts in the staged topic that opened since the last visit, in rail order. */
  opened: string[];
}

const FILL_AT = 400;
const OPEN_AT = 900;
const OPEN_STEP = 90;
const DOCK_AT = 1800;

export function planReplay(
  topic: TopicView | undefined,
  changes: { levelChanged: string[]; unlocked: string[] },
  oldLevels: Record<string, TileState['level']>,
): ReplayPlan | null {
  if (!topic) return null;
  const ids = new Set(topic.rows.map((r) => r.conceptId));
  const changed = new Map(
    changes.levelChanged
      .filter((id) => ids.has(id))
      .map((id) => [id, oldLevels[id] ?? 'none'] as const),
  );
  const opened = topic.rows.map((r) => r.conceptId).filter((id) => changes.unlocked.includes(id));
  return changed.size > 0 || opened.length > 0 ? { changed, opened } : null;
}

/** Elapsed replay step: 0 old, 1 filled, 2 + i the i-th opened concept shown, or 'done'. */
export function useReplayStep(plan: ReplayPlan | null, reduceMotion: boolean): number | 'done' {
  const [step, setStep] = useState<number | 'done'>(plan && !reduceMotion ? 0 : 'done');
  useEffect(() => {
    if (!plan || reduceMotion) return;
    const timers = [
      setTimeout(() => setStep(1), FILL_AT),
      ...plan.opened.map((_, i) => setTimeout(() => setStep(2 + i), OPEN_AT + OPEN_STEP * i)),
      setTimeout(() => setStep('done'), DOCK_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [plan, reduceMotion]);
  return step;
}

const OLD = (level: TileState['level']): TileState => ({
  level,
  locked: false,
  due: false,
  justUnlocked: false,
});
const LOCKED: TileState = { level: 'none', locked: true, due: false, justUnlocked: false };

/** The map as it should look at this replay step. */
export function replayView(map: MapView, plan: ReplayPlan | null, step: number | 'done'): MapView {
  if (!plan || step === 'done') return map;
  const tileAt = (id: string, tile: TileState): TileState => {
    const old = plan.changed.get(id);
    if (old !== undefined && step < 1) return OLD(old);
    const i = plan.opened.indexOf(id);
    if (i >= 0 && step < 2 + i) return LOCKED;
    return tile;
  };
  return {
    ...map,
    topics: map.topics.map((t) => ({
      ...t,
      rows: t.rows.map((r) => ({ ...r, tile: tileAt(r.conceptId, r.tile) })),
    })),
  };
}
