// Keyed random draws (UX.md 9.3). A draw is a pure function of the seed and a
// key (an ordinal plus a purpose), so there is no RNG state to advance: a
// re-plan from unchanged state repeats its picks, and an inserted card, an
// Undo or a shuffle never moves a later reel pick.

/** FNV-1a over the UTF-16 code units of `text` (32-bit). */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** One mulberry32 step: mixes a 32-bit value into a well-distributed uint32. */
function mulberry32(state: number): number {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

/** A uniform number in [0, 1) for (seed, ...key). Same inputs, same number. */
export function keyedRandom(seed: number, ...key: readonly (string | number)[]): number {
  return mulberry32(fnv1a(`${seed >>> 0}|${key.join('|')}`)) / 4294967296;
}

/** Index in [0, n) for a uniform u in [0, 1). */
export function pickIndex(n: number, u: number): number {
  return Math.min(n - 1, Math.floor(u * n));
}

/** Fisher-Yates shuffle keyed by (seed, ...key); returns a new array. */
export function keyedShuffle<T>(
  values: readonly T[],
  seed: number,
  ...key: readonly (string | number)[]
): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1, keyedRandom(seed, ...key, i));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
