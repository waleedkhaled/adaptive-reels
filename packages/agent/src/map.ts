// Knowledge map helpers (UX.md 3.5 and 9.11): one display state for matrix,
// rail, dock and progress panel, suggestions, and the "last seen" snapshot.
import type { DisplayLevel, LearnerState } from '@reels/schemas';
import type { Catalog } from './catalog';
import { conceptOf } from './catalog';
import { opensCount } from './mastery';
import { isDue, isUnlocked, levelOf, masteryOf, topicInterest } from './state';

export interface DisplayState {
  /** Learned = box 2, Retained = box 3-4, Checked = box 1, Seen = a reel end that was not an early skip (or an answer). */
  level: DisplayLevel;
  /** Some prerequisite was never Learned (unlocks are sticky). */
  locked: boolean;
  /** Checked or above and its review is due now. */
  due: boolean;
  /** Opened since the last map visit and not started yet ("NEW"). */
  justUnlocked: boolean;
}

export function displayState(
  conceptId: string,
  state: LearnerState,
  catalog: Catalog,
  now: number,
): DisplayState {
  const concept = conceptOf(catalog, conceptId);
  const level = levelOf(state, conceptId);
  const m = masteryOf(state, conceptId);
  const locked = !isUnlocked(state, concept);
  const openedBefore = state.map_seen?.unlocked.includes(conceptId) ?? false;
  return {
    level,
    locked,
    due: m.box >= 1 && isDue(m, now),
    justUnlocked: !locked && !concept.isRoot && level === 'none' && !openedBefore,
  };
}

export interface Suggestion {
  conceptId: string;
  /** due: review due now; new: just opened; opens: ranked by how many concepts it opens. */
  kind: 'due' | 'new' | 'opens';
  /** Concepts that become Open if this one is Learned now. */
  opens: number;
}

/**
 * Dock suggestions (UX.md 3.5): due now, just opened, then "opens the most"
 * (ties: topic interest, then rail order). Only concepts a session can serve
 * now: due, or open and not yet Checked.
 */
export function suggestions(
  state: LearnerState,
  catalog: Catalog,
  now: number,
  limit = 3,
): Suggestion[] {
  const rows: { s: Suggestion; tier: number; interest: number; rail: number }[] = [];
  for (const concept of catalog.concepts) {
    const d = displayState(concept.id, state, catalog, now);
    let tier: number;
    if (d.due) tier = 0;
    else if (d.locked || (d.level !== 'none' && d.level !== 'seen')) continue;
    else tier = d.justUnlocked ? 1 : 2;
    rows.push({
      s: {
        conceptId: concept.id,
        kind: tier === 0 ? 'due' : tier === 1 ? 'new' : 'opens',
        opens: opensCount(state, catalog, concept.id),
      },
      tier,
      interest: topicInterest(state, concept.topicId),
      rail: concept.railIndex,
    });
  }
  rows.sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.tier === 2 ? b.s.opens - a.s.opens : 0) ||
      b.interest - a.interest ||
      a.rail - b.rail,
  );
  return rows.slice(0, limit).map((r) => r.s);
}

/** Store "what the map looked like" (call when the map closes, after the replay). */
export function markMapSeen(state: LearnerState, catalog: Catalog, now: number): LearnerState {
  const levels: Record<string, DisplayLevel> = {};
  const unlocked: string[] = [];
  for (const concept of catalog.concepts) {
    const level = levelOf(state, concept.id);
    if (level !== 'none') levels[concept.id] = level;
    if (isUnlocked(state, concept)) unlocked.push(concept.id);
  }
  return { ...state, map_seen: { at: now, levels, unlocked } };
}

export interface MapChanges {
  /** Level changes from answers (Checked and up), for the replay and the Map tab mark. */
  levelChanged: string[];
  /** New Seen dots (no tab mark: watching never marks the map). */
  seenAdded: string[];
  /** Opened since the last visit. */
  unlocked: string[];
  /** Topic of the latest level change, else null (UX.md 3.5 "Staged topic on open"). */
  stagedTopicId: string | null;
}

/** Changes since the last map visit; a missing snapshot is the fresh-profile state. */
export function mapChanges(state: LearnerState, catalog: Catalog): MapChanges {
  const seen = state.map_seen;
  const levelChanged: string[] = [];
  const seenAdded: string[] = [];
  const unlocked: string[] = [];
  let latest: { at: number; topicId: string } | null = null;
  for (const concept of catalog.concepts) {
    const before = seen?.levels[concept.id] ?? 'none';
    const after = levelOf(state, concept.id);
    if (before !== after) {
      const answered = (l: DisplayLevel) => l !== 'none' && l !== 'seen';
      if (answered(before) || answered(after)) {
        levelChanged.push(concept.id);
        const at = masteryOf(state, concept.id).last_answered_at ?? 0;
        if (!latest || at > latest.at) latest = { at, topicId: concept.topicId };
      } else if (after === 'seen') seenAdded.push(concept.id);
    }
    const wasOpen = seen ? seen.unlocked.includes(concept.id) : concept.isRoot;
    if (!wasOpen && isUnlocked(state, concept)) unlocked.push(concept.id);
  }
  return { levelChanged, seenAdded, unlocked, stagedTopicId: latest?.topicId ?? null };
}

export interface TopicCounts {
  topicId: string;
  learned: number;
  /** Unlocked and not Learned. */
  open: number;
  due: number;
  total: number;
}

export interface MapCounts {
  /** "1/40 learned". */
  learned: number;
  /** "{n} watched": concepts at Seen or above. */
  watched: number;
  total: number;
  topics: TopicCounts[];
}

export function mapCounts(state: LearnerState, catalog: Catalog, now: number): MapCounts {
  let learned = 0;
  let watched = 0;
  const topics = catalog.topics.map((topic) => {
    const counts: TopicCounts = { topicId: topic.id, learned: 0, open: 0, due: 0, total: 0 };
    for (const id of topic.conceptIds) {
      const d = displayState(id, state, catalog, now);
      counts.total++;
      const isLearnedLevel = d.level === 'learned' || d.level === 'retained';
      if (isLearnedLevel) counts.learned++;
      else if (!d.locked) counts.open++;
      if (d.due) counts.due++;
      if (d.level !== 'none') watched++;
    }
    learned += counts.learned;
    return counts;
  });
  return { learned, watched, total: catalog.concepts.length, topics };
}
