// Stage: the encode gate (PERFORMANCE.md 6.2). Runs on the final MP4 after
// render and before the manifest; a failure fails that reel only. The checks
// are pure (evaluateGate) over measurements taken with ffprobe and ffmpeg.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { color, reel } from '@reels/tokens';
import { PATHS, VIDEO } from './config';
import {
  decodeRgb,
  hexToRgb,
  maxDelta,
  probeFile,
  type AudioProbe,
  type Loudness,
  type VideoProbe,
} from './render/probe';
import type { GateRecord, RenderRecord } from './store';
import { leadInFrames, outputSize } from './video';

export interface GateCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface GateMeasurements {
  atoms: string[];
  firstPacketKeyframe: boolean;
  video: VideoProbe | null;
  audio: AudioProbe | null;
  durationS: number;
  kbps: number;
  loudness: Loudness | null;
  /** Largest channel difference from bg.base in frame 0's top band. */
  groundDelta: number;
  /** Lead-in frames decoded and the largest difference from bg.base anywhere in them. */
  leadIn: { frames: number; delta: number };
  /** One frame per second: the largest difference in the top and bottom bands. */
  bands: { frames: number; delta: number; worstSecond: number };
}

export interface GateExpectations {
  width: number;
  height: number;
  fps: number;
  maxLevel: number;
  maxKbps: number;
  maxDurationS: number;
  loudnessLufs: number;
  loudnessToleranceLu: number;
  maxTruePeakDbtp: number;
  groundTolerance: number;
  leadInFrames: number;
}

export function gateExpectations(): GateExpectations {
  const { width, height } = outputSize();
  return {
    width,
    height,
    fps: VIDEO.fps,
    maxLevel: VIDEO.gate.maxLevel[height] ?? 40,
    maxKbps: VIDEO.gate.maxKbps[height] ?? 900,
    maxDurationS: VIDEO.gate.maxDurationS,
    loudnessLufs: VIDEO.loudness.gateMonoLufs,
    loudnessToleranceLu: VIDEO.gate.loudnessToleranceLu,
    maxTruePeakDbtp: VIDEO.gate.maxTruePeakDbtp,
    groundTolerance: VIDEO.gate.groundTolerance,
    leadInFrames: leadInFrames(),
  };
}

const check = (id: string, failures: string[], ok: string): GateCheck => ({
  id,
  pass: failures.length === 0,
  detail: failures.length ? failures.join('; ') : ok,
});

/** Every check of PERFORMANCE.md 6.2; pure. */
export function evaluateGate(m: GateMeasurements, e: GateExpectations): GateCheck[] {
  const checks: GateCheck[] = [];

  const container: string[] = [];
  const moov = m.atoms.indexOf('moov');
  const mdat = m.atoms.indexOf('mdat');
  if (moov === -1 || mdat === -1) container.push(`atoms ${m.atoms.join(',')} lack moov or mdat`);
  else if (moov > mdat) container.push('moov comes after mdat (no faststart)');
  if (!m.firstPacketKeyframe) container.push('first video packet is not a keyframe');
  checks.push(check('container', container, 'moov before mdat; first packet is a keyframe'));

  const video: string[] = [];
  const v = m.video;
  if (!v) video.push('no video stream');
  else {
    if (v.codec !== 'h264') video.push(`codec ${v.codec}, expected h264`);
    if (v.profile !== 'High') video.push(`profile ${v.profile}, expected High`);
    if (!(v.level <= e.maxLevel)) video.push(`level ${v.level}, at most ${e.maxLevel}`);
    if (v.pix_fmt !== 'yuv420p') video.push(`pix_fmt ${v.pix_fmt}`);
    if (v.color_range !== 'tv') video.push(`color_range ${v.color_range}, expected tv`);
    for (const [name, value] of [
      ['color_space', v.color_space],
      ['color_primaries', v.color_primaries],
      ['color_transfer', v.color_transfer],
    ] as const)
      if (value !== 'bt709') video.push(`${name} ${value}, expected bt709`);
    if (v.r_frame_rate !== `${e.fps}/1`) video.push(`r_frame_rate ${v.r_frame_rate}`);
    if (v.width !== e.width || v.height !== e.height)
      video.push(`${v.width}x${v.height}, expected ${e.width}x${e.height}`);
  }
  checks.push(
    check(
      'video',
      video,
      v
        ? `h264 High L${v.level / 10}, yuv420p tv bt709, ${v.r_frame_rate}, ${v.width}x${v.height}`
        : '',
    ),
  );

  const audio: string[] = [];
  const a = m.audio;
  if (!a) audio.push('no audio stream');
  else {
    if (a.codec !== 'aac' || a.profile !== 'LC')
      audio.push(`${a.codec} ${a.profile}, expected aac LC`);
    if (a.channels !== 1) audio.push(`${a.channels} channels, expected 1`);
    if (a.sample_rate !== 48000) audio.push(`${a.sample_rate} Hz, expected 48000`);
  }
  checks.push(check('audio', audio, a ? `AAC-LC mono ${a.sample_rate} Hz` : ''));

  const loud: string[] = [];
  const l = m.loudness;
  if (!l) loud.push('not measured');
  else {
    if (!(Math.abs(l.integrated_lufs - e.loudnessLufs) <= e.loudnessToleranceLu))
      loud.push(
        `integrated ${l.integrated_lufs} LUFS, expected ${e.loudnessLufs} +/- ${e.loudnessToleranceLu}`,
      );
    if (!(Math.round(l.true_peak_dbtp * 100) / 100 <= e.maxTruePeakDbtp))
      loud.push(
        `true peak ${l.true_peak_dbtp.toFixed(2)} dBTP, at most ${e.maxTruePeakDbtp.toFixed(2)}`,
      );
  }
  checks.push(
    check(
      'loudness',
      loud,
      l ? `${l.integrated_lufs} LUFS, ${l.true_peak_dbtp.toFixed(2)} dBTP` : '',
    ),
  );

  const clip: string[] = [];
  if (!l || !(l.max_volume_db < 0))
    clip.push(`max_volume ${l?.max_volume_db ?? '?'} dB, must be below 0`);
  checks.push(check('clipping', clip, `max_volume ${l?.max_volume_db} dB`));

  checks.push(
    check(
      'ground',
      m.groundDelta <= e.groundTolerance
        ? []
        : [`frame 0 top band differs from bg.base by ${m.groundDelta}`],
      `frame 0 top band = bg.base within ${m.groundDelta}`,
    ),
  );

  const zones: string[] = [];
  if (m.leadIn.frames < e.leadInFrames)
    zones.push(`decoded ${m.leadIn.frames} lead-in frames, expected ${e.leadInFrames}`);
  if (m.leadIn.delta > e.groundTolerance)
    zones.push(`lead-in frames are not flat (difference ${m.leadIn.delta})`);
  if (m.bands.frames === 0) zones.push('no frames decoded for the band check');
  if (m.bands.delta > e.groundTolerance)
    zones.push(
      `top or bottom band not flat at ${m.bands.worstSecond} s (difference ${m.bands.delta})`,
    );
  checks.push(
    check(
      'safe-zones',
      zones,
      `${m.leadIn.frames} lead-in frames flat; bands flat on ${m.bands.frames} frames`,
    ),
  );

  const size: string[] = [];
  if (!(m.kbps <= e.maxKbps)) size.push(`${m.kbps} kb/s, at most ${e.maxKbps}`);
  if (!(m.durationS <= e.maxDurationS)) size.push(`${m.durationS} s, at most ${e.maxDurationS}`);
  checks.push(check('size-length', size, `${m.kbps} kb/s, ${m.durationS} s`));
  return checks;
}

/** Decodes and probes the file; the slow part of the gate. */
export function measureForGate(
  file: string,
  e: GateExpectations = gateExpectations(),
): GateMeasurements {
  const probe = probeFile(file);
  const ground = hexToRgb(color.bg.base);
  const scale = e.height / reel.canvas.height;
  const top = Math.round(reel.band.top * scale);
  const bottom = Math.round(reel.band.bottom * scale);

  const lead = decodeRgb(file, `[0:v]select='lt(n\\,${e.leadInFrames})'`, e.width, e.height);
  const groundDelta = lead[0] ? maxDelta(lead[0], e.width, ground, [0, top]) : 255;
  const leadDelta = Math.max(0, ...lead.map((f) => maxDelta(f, e.width, ground)));

  const bands = decodeRgb(
    file,
    `[0:v]fps=1,split=2[a][b];[a]crop=iw:${top}:0:0[t];[b]crop=iw:${bottom}:0:ih-${bottom}[u];[t][u]vstack`,
    e.width,
    top + bottom,
  );
  let bandDelta = 0;
  let worstSecond = 0;
  bands.forEach((f, second) => {
    const d = maxDelta(f, e.width, ground);
    if (d > bandDelta) {
      bandDelta = d;
      worstSecond = second;
    }
  });

  return {
    atoms: probe.atoms,
    firstPacketKeyframe: probe.first_packet_keyframe,
    video: probe.video,
    audio: probe.audio,
    durationS: probe.duration_s,
    kbps: probe.kbps,
    loudness: probe.loudness,
    groundDelta,
    leadIn: { frames: lead.length, delta: leadDelta },
    bands: { frames: bands.length, delta: bandDelta, worstSecond },
  };
}

/** Gates one rendered reel: the file must still match its render record. */
export function runEncodeGate(render: RenderRecord): GateRecord {
  const file = path.join(PATHS.library, render.file);
  const at = new Date().toISOString();
  const base = { reel_id: render.reel_id, file: render.file, sha256: render.sha256, at };
  if (!fs.existsSync(file))
    return { ...base, pass: false, checks: [{ id: 'file', pass: false, detail: 'file missing' }] };
  const sha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sha !== render.sha256)
    return {
      ...base,
      pass: false,
      checks: [
        { id: 'file', pass: false, detail: `sha256 ${sha.slice(0, 12)} does not match the record` },
      ],
    };
  const checks = evaluateGate(measureForGate(file), gateExpectations());
  return { ...base, pass: checks.every((c) => c.pass), checks };
}
