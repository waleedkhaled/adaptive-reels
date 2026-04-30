// Stages 3 and 4: narration audio with word timestamps, and FLUX images for
// "image" visuals. Both run only on reels whose text passed every gate.
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ReelSpec } from '@reels/schemas';
import { alignToSilences } from './align';
import { MODELS } from './config';
import type { CostLedger } from './ledger';
import type { ImageGen, TTS } from './providers/types';
import {
  detectSilences,
  libraryRel,
  probeDurationMs,
  reelDir,
  writeBytes,
  type ImagesRecord,
  type TimingRecord,
} from './store';

/** The hook is spoken first, then each segment's narration, one audio file per part. */
export async function narrate(spec: ReelSpec, tts: TTS, ledger: CostLedger): Promise<TimingRecord> {
  const texts = [spec.hook, ...spec.segments.map((s) => s.narration)];
  const parts: TimingRecord['parts'] = [];
  for (const [i, text] of texts.entries()) {
    const speech = await ledger.charge(
      { reelId: spec.reel_id, stage: 'tts', provider: tts.provider, model: tts.model },
      tts.estimateUsd(text),
      () => tts.speak(text),
    );
    const file = path.join(reelDir(spec.reel_id), 'audio', `part-${i}.${speech.format}`);
    writeBytes(file, speech.audio);
    const durationMs = probeDurationMs(file);
    parts.push({
      kind: i === 0 ? 'hook' : 'segment',
      segment: i - 1,
      text,
      file: libraryRel(file),
      duration_ms: durationMs,
      // Kokoro drifts around pauses; re-time against the audio's own silences.
      words: alignToSilences(speech.words, detectSilences(file), durationMs),
      tts_words: speech.words,
    });
  }
  return { reel_id: spec.reel_id, parts };
}

const STYLE =
  'Clean, modern educational illustration, soft natural light, simple composition, vertical framing, no text, no letters, no labels. Scene: ';

/** Deterministic seed per reel and segment, so reruns reproduce the same image. */
const seedFor = (reelId: string, segment: number) =>
  createHash('sha256').update(`${reelId}#${segment}`).digest().readUInt32BE(0) % 2_147_483_647;

export async function illustrate(
  spec: ReelSpec,
  images: ImageGen,
  ledger: CostLedger,
): Promise<ImagesRecord> {
  const out: ImagesRecord = { reel_id: spec.reel_id, images: {} };
  for (const [i, segment] of spec.segments.entries()) {
    if (segment.visual.kind !== 'image') continue;
    const req = {
      prompt: STYLE + segment.visual.prompt,
      width: MODELS.images.width,
      height: MODELS.images.height,
      seed: seedFor(spec.reel_id, i),
    };
    const image = await ledger.charge(
      { reelId: spec.reel_id, stage: 'images', provider: images.provider, model: images.model },
      images.estimateUsd(req),
      () => images.generate(req),
    );
    const file = path.join(reelDir(spec.reel_id), 'images', `segment-${i}.${image.ext}`);
    writeBytes(file, image.bytes);
    out.images[String(i)] = libraryRel(file);
  }
  return out;
}
