// Per-reel files under library/reels/<reel_id>/. Each stage writes one JSON
// record; a stage skips a reel whose record already exists unless --force.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ReelSpec } from '@reels/schemas';
import { PATHS } from './config';
import type { GateResult } from './gates';
import type { SpokenWord } from './providers/types';
import type { Probe } from './render/probe';
import type { SnippetOutcome } from './render/reformat';

export interface TextRecord {
  reel_id: string;
  status: 'passed' | 'rejected' | 'invalid';
  spec: ReelSpec | null;
  /** Gate results for the final draft. */
  gates: GateResult[];
  /** Gate results for drafts that were rewritten. */
  earlier_drafts: { spec: ReelSpec; gates: GateResult[] }[];
  writer_calls: number;
  problems: string[];
  at: string;
  /** Models and prompt versions that wrote and last reviewed this spec (absent on records from before 2026-10-05). */
  provenance?: Provenance;
  /** Snippets the render stage reformatted to reach the 26 px code floor (originals kept here). */
  reformats?: {
    segment: number;
    before: { code: string; highlight_lines: number[] };
    after: { code: string; highlight_lines: number[] };
    at: string;
  }[];
}

export interface Provenance {
  writer: { model: string; prompt_version: string };
  reviewer: { model: string; prompt_versions: Record<string, string> };
}

export interface TimingPart {
  kind: 'hook' | 'segment';
  /** Segment index (0-based); -1 for the hook. */
  segment: number;
  text: string;
  /** Path relative to library/. */
  file: string;
  duration_ms: number;
  /** Aligned to the audio's pauses; used for captions. */
  words: SpokenWord[];
  /** Raw timestamps from the TTS provider, kept for debugging. */
  tts_words: SpokenWord[];
}
export interface TimingRecord {
  reel_id: string;
  parts: TimingPart[];
}

export interface ImagesRecord {
  reel_id: string;
  /** Segment index -> path relative to library/. */
  images: Record<string, string>;
}

/** Bumped when the templates or the encode change; older render records are stale. */
export const RENDER_VERSION = 2;

export interface RenderLayoutSummary {
  hook_px: number;
  segments: {
    visual: string;
    on_screen_px: number | null;
    kinetic_px: number | null;
    code_px: number | null;
    /** fits | reformatted | exception (allowed 25 and 24 px). */
    code_status: string | null;
    flow_label_px: number | null;
    equation_px: number | null;
  }[];
}

export interface RenderRecord {
  reel_id: string;
  /** Content-hashed path relative to library/: reels/<id>/<id>.<sha12>.mp4. */
  file: string;
  duration_s: number;
  bytes: number;
  sha256: string;
  /** Word timings on the whole timeline, lead-in included; em dashes replaced. */
  captions: { word: string; start_ms: number; end_ms: number }[];
  at: string;
  /** Absent on records from the old templates (version 1). */
  version?: number;
  video?: { width: number; height: number; fps: number };
  lead_in_ms?: number;
  probe?: Probe;
  layout?: RenderLayoutSummary;
  render_s?: number;
}

export interface GateRecord {
  reel_id: string;
  /** The file and hash that were checked. */
  file: string;
  sha256: string;
  pass: boolean;
  checks: { id: string; pass: boolean; detail: string }[];
  at: string;
}

/** Result of the dry layout pass and the glyph audit for a reel. */
export interface LayoutRecord {
  reel_id: string;
  pass: boolean;
  /** Overflow, fit and glyph problems; a failed reel is never rendered. */
  problems: string[];
  snippets: SnippetOutcome[];
  at: string;
}

/** A render made by the current templates and encode settings. */
export const isCurrentRender = (r: RenderRecord | null): r is RenderRecord =>
  !!r && r.version === RENDER_VERSION;

/** The encode gate passed for exactly this render. */
export const gatePassed = (r: RenderRecord | null, g: GateRecord | null) =>
  isCurrentRender(r) && !!g && g.pass && g.sha256 === r.sha256;

export const reelDir = (reelId: string) => path.join(PATHS.reels, reelId);
export const libraryRel = (abs: string) =>
  path.relative(PATHS.library, abs).split(path.sep).join('/');

export type RecordName = 'text' | 'timing' | 'images' | 'layout' | 'render' | 'gate';

export function readRecord<T>(reelId: string, name: RecordName): T | null {
  const file = path.join(reelDir(reelId), `${name}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : null;
}

export function writeRecord(reelId: string, name: RecordName, value: unknown): void {
  fs.mkdirSync(reelDir(reelId), { recursive: true });
  fs.writeFileSync(path.join(reelDir(reelId), `${name}.json`), JSON.stringify(value, null, 2));
}

export function writeBytes(abs: string, bytes: Uint8Array): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
}

/** Media duration in milliseconds, via ffprobe. */
export function probeDurationMs(file: string): number {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    {
      encoding: 'utf8',
    },
  );
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe could not read the duration of ${file}`);
  return Math.round(seconds * 1000);
}

/** Pauses of at least `minMs` below -35 dB, via ffmpeg silencedetect. Shorter gaps are often stop consonants inside a word. */
export function detectSilences(file: string, minMs = 250): { startMs: number; endMs: number }[] {
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-i', file, '-af', `silencedetect=n=-35dB:d=${minMs / 1000}`, '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const starts = [...result.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(
    (m) => Number(m[1]) * 1000,
  );
  const ends = [...result.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(
    (m) => Number(m[1]) * 1000,
  );
  const durationMs = probeDurationMs(file);
  return starts.map((startMs, i) => ({ startMs, endMs: ends[i] ?? durationMs }));
}
