import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Manifest, type ReelSpec } from '@reels/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PATHS, useLibrary } from './config';
import { jobsFor, loadContent, type Job } from './content';
import type { Decisions } from './decisions';
import { buildManifest, codeOf, onScreenTextOf, transcriptOf, writeManifests } from './manifest';
import { RENDER_VERSION, writeRecord, type GateRecord, type RenderRecord } from './store';

const content = loadContent();
const jobs = jobsFor(content).slice(0, 4);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-manifest-'));

const spec = (job: Job): ReelSpec => ({
  schema_version: 1,
  reel_id: job.reelId,
  concept_id: job.concept.node.id,
  lang: 'en',
  angle: job.angle,
  template: 'visual-focus',
  target_duration_s: 30,
  hook: 'Your app crashed — read the trace.',
  segments: [
    {
      narration: 'Find the first frame — start there.',
      on_screen_text: 'Stack trace — top first',
      visual: {
        kind: 'code',
        language: 'ts',
        code: 'const a = 1; // x — y\n',
        highlight_lines: [],
        check: 'should_error',
        shows_mistake: false,
      },
    },
    { narration: 'Second part.', on_screen_text: 'Two', visual: { kind: 'kinetic_text' } },
  ],
  key_claims: [{ id: 'c1', text: 'claim', source_id: 's1', quote: 'quote' }],
  sources: [{ id: 's1', title: 'Card', ref: 'content/x.md' }],
  difficulty: 2,
  retrieval_items: [
    {
      id: 'q1',
      type: 'mcq',
      prompt: 'Which?',
      choices: ['a', 'b', 'c'],
      answer_index: 0,
      explanation: 'Because.',
      claim_ids: ['c1'],
    },
  ],
});

const sha = (n: number) => String(n).repeat(64).slice(0, 64);
const render = (job: Job, n: number, current = true): RenderRecord => ({
  reel_id: job.reelId,
  file: `reels/${job.reelId}/${job.reelId}.${sha(n).slice(0, 12)}.mp4`,
  duration_s: 29.1,
  bytes: 1_000_000,
  sha256: sha(n),
  captions: [{ word: 'Your', start_ms: 600, end_ms: 700 }],
  at: '2026-10-04T00:00:00.000Z',
  ...(current ? { version: RENDER_VERSION, video: { width: 1080, height: 1920, fps: 30 } } : {}),
});
const gate = (job: Job, n: number, pass: boolean): GateRecord => ({
  reel_id: job.reelId,
  file: render(job, n).file,
  sha256: sha(n),
  pass,
  checks: [],
  at: '2026-10-04T00:00:00.000Z',
});

beforeAll(() => {
  useLibrary(dir);
  const [a, b, c, d] = jobs as [Job, Job, Job, Job];
  for (const [i, job] of jobs.entries()) {
    writeRecord(job.reelId, 'text', {
      reel_id: job.reelId,
      status: 'passed',
      spec: spec(job),
      gates: [],
      earlier_drafts: [],
      writer_calls: 1,
      problems: [],
      at: '',
    });
    writeRecord(job.reelId, 'render', render(job, i + 1, job !== d));
  }
  writeRecord(a.reelId, 'gate', gate(a, 1, true));
  writeRecord(b.reelId, 'gate', gate(b, 2, true));
  writeRecord(c.reelId, 'gate', gate(c, 3, false));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('manifests', () => {
  const decisions = (): Decisions => ({
    [jobs[0]!.reelId]: { decision: 'approved', sha256: sha(1), note: '', at: '' },
    [jobs[1]!.reelId]: { decision: 'approved', sha256: sha(9), note: 'older video', at: '' },
  });

  it('ships only approved reels that passed the encode gate', () => {
    const m = buildManifest(content, jobs, decisions());
    expect(m.reels.map((r) => r.reel_id)).toEqual([jobs[0]!.reelId]);
  });

  it('lists every gated reel in the development manifest, approved or not', () => {
    const m = buildManifest(content, jobs, decisions(), { approvedOnly: false });
    // c failed the encode gate; d is an old render the new gate never saw.
    expect(m.reels.map((r) => r.reel_id)).toEqual([jobs[0]!.reelId, jobs[1]!.reelId]);
  });

  it('carries the hashed url, transcript, on-screen text, code and video size', () => {
    const [reel] = buildManifest(content, jobs, decisions()).reels;
    expect(reel).toMatchObject({
      url: `reels/${jobs[0]!.reelId}/${jobs[0]!.reelId}.111111111111.mp4`,
      transcript:
        'Your app crashed: read the trace.\n\nFind the first frame: start there.\n\nSecond part.',
      on_screen_text: ['Stack trace: top first', 'Two'],
      code: [{ language: 'ts', code: 'const a = 1; // x: y', shows_mistake: true }],
      video: { width: 1080, height: 1920, fps: 30 },
    });
  });

  it('writes manifest.json and manifest.all.json', () => {
    expect(writeManifests(content, jobs, decisions())).toEqual({ approved: 1, all: 2 });
    for (const file of [PATHS.manifest, PATHS.manifestAll])
      expect(() => Manifest.parse(JSON.parse(fs.readFileSync(file, 'utf8')))).not.toThrow();
  });

  it('builds the transcript fields from the spec', () => {
    const s = spec(jobs[0]!);
    expect(transcriptOf(s).split('\n\n')).toHaveLength(3);
    expect(onScreenTextOf(s)).toHaveLength(2);
    expect(codeOf(s)).toHaveLength(1);
  });
});
