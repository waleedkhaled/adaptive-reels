// Which reel of a concept, which retrieval item, which options (UX.md 3.3).
import type { Angle, LearnerState } from '@reels/schemas';
import type { Catalog, ConceptInfo, ItemInfo, ReelInfo } from './catalog';
import { conceptOf } from './catalog';
import { keyedRandom, keyedShuffle, pickIndex } from './random';
import { masteryOf } from './state';

/**
 * The next reel of a concept: never one shown this session; the pitfall after
 * "Too easy"; else the first angle never shown (intro, example, pitfall);
 * else the least recently shown. Null when every reel was shown this session.
 */
export function chooseReel(
  state: LearnerState,
  concept: ConceptInfo,
  shownThisSession: ReadonlySet<string>,
): ReelInfo | null {
  const fresh = concept.reels.filter((r) => !shownThisSession.has(r.id));
  if (fresh.length === 0) return null;
  if (state.pending.pitfall_next.includes(concept.id)) {
    const pitfall = fresh.find((r) => r.angle === 'pitfall');
    if (pitfall) return pitfall;
  }
  const never = fresh.find((r) => !state.reels[r.id]);
  if (never) return never;
  return leastRecentlyShown(state, fresh);
}

export function leastRecentlyShown(state: LearnerState, reels: readonly ReelInfo[]): ReelInfo {
  let best = reels[0] as ReelInfo;
  let bestOrdinal = Infinity;
  for (const reel of reels) {
    const ordinal = state.reels[reel.id]?.last_ordinal ?? -1;
    if (ordinal < bestOrdinal) {
      best = reel;
      bestOrdinal = ordinal;
    }
  }
  return best;
}

/**
 * The reteach reel after a wrong answer: an angle never shown (intro, example,
 * pitfall); when none is left, the reel the question came from ("The same reel
 * is next.", UX.md 5.3).
 */
export function chooseReteachReel(
  state: LearnerState,
  catalog: Catalog,
  conceptId: string,
  sourceReelId: string,
): { reel: ReelInfo; replay: boolean } | null {
  const concept = conceptOf(catalog, conceptId);
  const unplayed = concept.reels.filter((r) => !state.reels[r.id]);
  const pick = unplayed.find((r) => r.id !== sourceReelId) ?? unplayed[0];
  if (pick) return { reel: pick, replay: false };
  const source = catalog.reelById.get(sourceReelId) ?? concept.reels[0];
  return source ? { reel: source, replay: true } : null;
}

const PROVE_IT_ANGLES: readonly Angle[] = ['pitfall', 'example', 'intro'];

/**
 * UX.md 3.3 "Which item": from the reels of this concept the learner finished
 * (not early-skipped), least recently answered first (never answered wins),
 * never the item of this concept's previous card; if none qualifies, the least
 * recently answered item of any angle. Prove-it: an item from an angle other
 * than the reel on screen, pitfall first. Ties are broken by the seeded draw
 * keyed by the card ordinal.
 */
export function pickItem(
  state: LearnerState,
  catalog: Catalog,
  conceptId: string,
  cardOrdinal: number,
  proveItFromReelId: string | null = null,
): ItemInfo | null {
  const concept = conceptOf(catalog, conceptId);
  const all = concept.reels.flatMap((r) => r.items);
  if (all.length === 0) return null;
  const previous = masteryOf(state, conceptId).last_item_id;
  const notPrevious = all.filter((i) => i.id !== previous);
  const pick = (candidates: readonly ItemInfo[]) =>
    leastRecentlyAnswered(state, candidates, keyedRandom(state.seed, 'item', cardOrdinal));

  if (proveItFromReelId !== null) {
    const onScreen = catalog.reelById.get(proveItFromReelId)?.angle;
    for (const angle of PROVE_IT_ANGLES) {
      if (angle === onScreen) continue;
      const candidates = notPrevious.filter((i) => i.angle === angle);
      if (candidates.length > 0) return pick(candidates);
    }
  }
  const finished = new Set(state.exposure[conceptId]?.finished ?? []);
  const fromFinished = notPrevious.filter((i) => finished.has(i.reelId));
  if (fromFinished.length > 0) return pick(fromFinished);
  return pick(notPrevious.length > 0 ? notPrevious : all);
}

function leastRecentlyAnswered(
  state: LearnerState,
  candidates: readonly ItemInfo[],
  u: number,
): ItemInfo {
  const answeredAt = (item: ItemInfo) => state.items[item.id]?.answered_at ?? -Infinity;
  let oldest = Infinity;
  for (const item of candidates) oldest = Math.min(oldest, answeredAt(item));
  const tied = candidates.filter((item) => answeredAt(item) === oldest);
  return tied[pickIndex(tied.length, u)] as ItemInfo;
}

/**
 * Authored choice indices in the order to show: 3 at box 0 (one distractor
 * dropped by the seeded draw, never the correct one), all from box 1; shuffled
 * per presentation by the seed, the item id and its presentation count.
 */
export function cardOptions(
  seed: number,
  item: ItemInfo,
  presentation: number,
  box: number,
): number[] {
  let indices = Array.from({ length: item.choiceCount }, (_, i) => i);
  if (box === 0 && indices.length > 3) {
    const distractors = indices.filter((i) => i !== item.answerIndex);
    const dropped = distractors[
      pickIndex(distractors.length, keyedRandom(seed, 'drop', item.id, presentation))
    ] as number;
    indices = indices.filter((i) => i !== dropped);
  }
  return keyedShuffle(indices, seed, 'shuffle', item.id, presentation);
}
