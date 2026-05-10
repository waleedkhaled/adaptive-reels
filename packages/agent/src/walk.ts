// Prerequisite walks shared by the Lateral bridge, gap sessions and the map.
import type { LearnerState } from '@reels/schemas';
import type { Catalog } from './catalog';
import { conceptOf } from './catalog';
import { isLearned, isUnlocked } from './state';

/**
 * Concepts that must be Learned before `targetId` unlocks: each direct
 * prerequisite that is not Learned, plus, through prerequisites that are still
 * locked, theirs. An unlocked target has none (unlocks are sticky).
 */
export function unmetAncestors(state: LearnerState, catalog: Catalog, targetId: string): string[] {
  const target = conceptOf(catalog, targetId);
  if (isUnlocked(state, target)) return [];
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const p of conceptOf(catalog, id).prereqs) {
      if (isLearned(state, p) || out.has(p)) continue;
      out.add(p);
      if (!isUnlocked(state, conceptOf(catalog, p))) walk(p);
    }
  };
  walk(targetId);
  return [...out];
}

/**
 * UX.md 3.5 "Gap order": topological; among ready steps, the focus topic
 * first, then rail order.
 */
export function gapOrder(catalog: Catalog, ids: readonly string[], focusTopicId: string): string[] {
  const left = new Set(ids);
  const out: string[] = [];
  while (left.size > 0) {
    let best: string | null = null;
    let bestKey = Infinity;
    for (const id of left) {
      const concept = conceptOf(catalog, id);
      if (concept.prereqs.some((p) => left.has(p))) continue;
      const key = (concept.topicId === focusTopicId ? 0 : 1e6) + concept.railIndex;
      if (key < bestKey) {
        best = id;
        bestKey = key;
      }
    }
    if (best === null) break; // only on a cycle, which the graph validator rejects
    left.delete(best);
    out.push(best);
  }
  return [...out, ...left];
}

/** Unmet ancestors of a target in gap order (the map's number pins, minus the target). */
export function orderedUnmetAncestors(
  state: LearnerState,
  catalog: Catalog,
  targetId: string,
): string[] {
  return gapOrder(
    catalog,
    unmetAncestors(state, catalog, targetId),
    conceptOf(catalog, targetId).topicId,
  );
}

/** Lateral bridge (PLAN "Pools"): the first unlocked unmet prerequisite of a locked concept. */
export function bridgeFor(state: LearnerState, catalog: Catalog, lockedId: string): string | null {
  for (const id of orderedUnmetAncestors(state, catalog, lockedId)) {
    if (isUnlocked(state, conceptOf(catalog, id))) return id;
  }
  return null;
}
