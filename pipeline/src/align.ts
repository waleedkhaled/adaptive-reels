// Kokoro's word timestamps drift by up to ~400 ms around pauses: a word before
// a full stop "ends" late and the next one "starts" early. The audio's own
// silences are ground truth, so we snap word boundaries to detected pauses and
// stretch the timings in between to fit (a piecewise-linear time warp).
import type { SpokenWord } from './providers/types';

export interface Silence {
  startMs: number;
  endMs: number;
}

const PUNCTUATION_ONLY = /^[^\p{L}\p{N}]+$/u;

/** Kokoro emits punctuation as separate "words"; fold it into the word before. */
export function foldPunctuation(words: SpokenWord[]): SpokenWord[] {
  const out: SpokenWord[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (PUNCTUATION_ONLY.test(w.text.trim())) {
      if (prev) prev.text += w.text.trim();
      continue;
    }
    out.push({ ...w, text: w.text.trim() });
  }
  return out;
}

/**
 * Re-time `words` against the clip's silences. Leading and trailing silences set
 * the first start and last end; each interior pause claims the nearest unclaimed
 * word boundary (in order, within `maxShiftMs`).
 */
export function alignToSilences(
  rawWords: SpokenWord[],
  silences: Silence[],
  durationMs: number,
  maxShiftMs = 600,
): SpokenWord[] {
  const words = foldPunctuation(rawWords);
  if (words.length === 0) return words;

  const first = words[0]!;
  const last = words[words.length - 1]!;
  const leading = silences.find((s) => s.startMs <= 20);
  // A clip that is silent end to end (dry-run fixtures) has nothing to align to.
  if (leading && leading.endMs >= durationMs - 20) return words;
  const trailing = [...silences].reverse().find((s) => s.endMs >= durationMs - 20 && s !== leading);
  const onset = leading ? leading.endMs : first.startMs;
  const offset = trailing ? trailing.startMs : Math.min(last.endMs, durationMs);
  const interior = silences
    .filter((s) => s !== leading && s !== trailing)
    .sort((a, b) => a.startMs - b.startMs);

  // Anchors map a Kokoro time to a real time; they must increase in both.
  const anchors: [number, number][] = [[first.startMs, onset]];
  const snaps = new Map<number, Silence>(); // boundary index i: between words i and i+1
  let minBoundary = 0;
  for (const silence of interior) {
    const mid = (silence.startMs + silence.endMs) / 2;
    let best = -1;
    let bestDist = Infinity;
    for (let i = minBoundary; i < words.length - 1; i++) {
      const boundary = (words[i]!.endMs + words[i + 1]!.startMs) / 2;
      const dist = Math.abs(boundary - mid);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    }
    if (best === -1 || bestDist > maxShiftMs) continue;
    snaps.set(best, silence);
    anchors.push([words[best]!.endMs, silence.startMs], [words[best + 1]!.startMs, silence.endMs]);
    minBoundary = best + 1;
  }
  anchors.push([last.endMs, offset]);

  // Keep anchors strictly increasing on both axes.
  const clean: [number, number][] = [];
  for (const a of anchors) {
    const prev = clean[clean.length - 1];
    if (!prev || (a[0] > prev[0] && a[1] >= prev[1])) clean.push(a);
  }
  const warp = (t: number): number => {
    if (clean.length === 1) return t - clean[0]![0] + clean[0]![1];
    let i = 0;
    while (i < clean.length - 2 && t > clean[i + 1]![0]) i++;
    const [k0, r0] = clean[i]!;
    const [k1, r1] = clean[i + 1]!;
    return r0 + ((t - k0) * (r1 - r0)) / (k1 - k0);
  };

  const aligned = words.map((w) => ({
    text: w.text,
    startMs: Math.round(warp(w.startMs)),
    endMs: Math.round(warp(w.endMs)),
  }));
  for (const [i, s] of snaps) {
    aligned[i]!.endMs = Math.round(s.startMs);
    aligned[i + 1]!.startMs = Math.round(s.endMs);
  }
  aligned[0]!.startMs = Math.round(onset);
  aligned[aligned.length - 1]!.endMs = Math.round(offset);
  // Clamp into the clip and keep every word ordered and non-negative in length.
  let floor = 0;
  for (const w of aligned) {
    w.startMs = Math.max(floor, Math.min(w.startMs, durationMs));
    w.endMs = Math.max(w.startMs, Math.min(w.endMs, durationMs));
    floor = w.startMs;
  }
  return aligned;
}
