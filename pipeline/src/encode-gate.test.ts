import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateGate,
  gateExpectations,
  measureForGate,
  type GateMeasurements,
} from './encode-gate';
import { parseEbur128, parseLoudnormJson, parseMaxVolume, topLevelAtoms } from './render/probe';

const good = (): GateMeasurements => ({
  atoms: ['ftyp', 'moov', 'free', 'mdat'],
  firstPacketKeyframe: true,
  video: {
    codec: 'h264',
    profile: 'High',
    level: 40,
    pix_fmt: 'yuv420p',
    width: 1080,
    height: 1920,
    color_range: 'tv',
    color_space: 'bt709',
    color_primaries: 'bt709',
    color_transfer: 'bt709',
    r_frame_rate: '30/1',
    fps: 30,
  },
  audio: { codec: 'aac', profile: 'LC', channels: 1, sample_rate: 48000, bit_rate: 64000 },
  durationS: 29,
  kbps: 300,
  loudness: { integrated_lufs: -19.2, lra_lu: 3, true_peak_dbtp: -2.85, max_volume_db: -2.8 },
  groundDelta: 0,
  leadIn: { frames: 9, delta: 0 },
  bands: { frames: 29, delta: 0, worstSecond: 0 },
});
const failing = (m: GateMeasurements) =>
  evaluateGate(m, gateExpectations())
    .filter((c) => !c.pass)
    .map((c) => c.id);

describe('encode gate checks (PERFORMANCE.md 6.2)', () => {
  it('passes a conforming file', () => {
    expect(failing(good())).toEqual([]);
    expect(gateExpectations()).toMatchObject({
      width: 1080,
      height: 1920,
      maxLevel: 40,
      maxKbps: 900,
      loudnessLufs: -19,
      maxDurationS: 39.5,
      leadInFrames: 9,
    });
  });

  it.each<[string, (m: GateMeasurements) => void]>([
    ['container', (m) => void (m.atoms = ['ftyp', 'mdat', 'moov'])],
    ['container', (m) => void (m.firstPacketKeyframe = false)],
    ['video', (m) => void (m.video!.level = 41)],
    ['video', (m) => void (m.video!.color_range = 'pc')],
    ['video', (m) => void (m.video!.color_transfer = 'unknown')],
    ['video', (m) => void (m.video!.r_frame_rate = '60/1')],
    ['video', (m) => void (m.video!.width = 720)],
    ['audio', (m) => void (m.audio!.channels = 2)],
    ['audio', (m) => void (m.audio!.sample_rate = 44100)],
    ['loudness', (m) => void (m.loudness!.integrated_lufs = -16.4)],
    ['loudness', (m) => void (m.loudness!.true_peak_dbtp = -0.95)],
    ['clipping', (m) => void (m.loudness!.max_volume_db = 0)],
    ['ground', (m) => void (m.groundDelta = 2)],
    ['safe-zones', (m) => void (m.leadIn = { frames: 9, delta: 30 })],
    ['safe-zones', (m) => void (m.bands = { frames: 30, delta: 12, worstSecond: 4 })],
    ['size-length', (m) => void (m.kbps = 950)],
    ['size-length', (m) => void (m.durationS = 39.6)],
  ])('fails %s', (id, mutate) => {
    const m = good();
    mutate(m);
    expect(failing(m)).toEqual([id]);
  });

  it('reads the true peak on a two-decimal reading', () => {
    const m = good();
    m.loudness!.true_peak_dbtp = -1.004;
    expect(failing(m)).toEqual([]);
  });
});

describe('ffmpeg log parsing', () => {
  it('reads the ebur128 summary, not the running values', () => {
    const log = `t: 1.2 M: -20.1 S: -21.0 I: -25.0 LUFS LRA: 0.0 LU\n[Parsed_ebur128_0 @ 0x1] Summary:\n\n  Integrated loudness:\n    I:         -19.2 LUFS\n    Threshold: -29.4 LUFS\n\n  Loudness range:\n    LRA:         2.6 LU\n`;
    expect(parseEbur128(log)).toEqual({ integrated: -19.2, lra: 2.6 });
  });

  it('reads loudnorm JSON and volumedetect', () => {
    const log = `[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-19.21",\n\t"input_tp" : "-2.85"\n}\n`;
    expect(parseLoudnormJson(log).input_tp).toBe('-2.85');
    expect(parseMaxVolume('[Parsed_volumedetect_0 @ 0x1] max_volume: -2.8 dB')).toBe(-2.8);
  });
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

describe.skipIf(!hasFfmpeg)('gate on a real file', () => {
  it('measures a flat 1080 x 1920 clip like a rendered reel', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-gate-'));
    const file = path.join(dir, 'clip.mp4');
    try {
      const made = spawnSync('ffmpeg', [
        '-v',
        'error',
        // RGB first, then BT.709 limited range, as Remotion converts its PNG frames.
        '-f',
        'lavfi',
        '-i',
        'color=c=0x181612:s=1080x1920:r=30:d=2,format=rgb24',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000:duration=2',
        '-vf',
        'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,' +
          'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
        '-c:v',
        'libx264',
        '-profile:v',
        'high',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-ac',
        '1',
        '-b:a',
        '64k',
        '-movflags',
        '+faststart',
        '-shortest',
        file,
      ]);
      expect(made.status, String(made.stderr)).toBe(0);
      expect(topLevelAtoms(file).indexOf('moov')).toBeLessThan(topLevelAtoms(file).indexOf('mdat'));
      const m = measureForGate(file);
      expect(m.groundDelta).toBeLessThanOrEqual(1);
      expect(m.leadIn.frames).toBe(9);
      expect(m.bands.frames).toBeGreaterThanOrEqual(2);
      const checks = evaluateGate(m, gateExpectations());
      const byId = Object.fromEntries(checks.map((c) => [c.id, c.pass]));
      expect(byId).toMatchObject({
        container: true,
        video: true,
        audio: true,
        ground: true,
        'safe-zones': true,
        'size-length': true,
      });
      // The test tone is not normalised; only check that loudness was measured on the file.
      expect(Number.isFinite(m.loudness!.integrated_lufs)).toBe(true);
      expect(m.loudness!.max_volume_db).toBeLessThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
