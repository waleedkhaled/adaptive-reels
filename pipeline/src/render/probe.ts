// Measurements on a finished MP4 with ffprobe and ffmpeg (PERFORMANCE.md 6.2):
// stream properties, top-level atom order, the first packet, loudness on the
// final file (never the encode pass's own summary) and decoded pixels.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

export interface VideoProbe {
  codec: string;
  profile: string;
  /** H.264 level x 10, e.g. 40. */
  level: number;
  pix_fmt: string;
  width: number;
  height: number;
  color_range: string;
  color_space: string;
  color_primaries: string;
  color_transfer: string;
  r_frame_rate: string;
  fps: number;
}

export interface AudioProbe {
  codec: string;
  profile: string;
  channels: number;
  sample_rate: number;
  bit_rate: number;
}

export interface Loudness {
  /** EBU R128 integrated loudness of the file, LUFS (ebur128, one decimal). */
  integrated_lufs: number;
  lra_lu: number;
  /** True peak, dBTP (loudnorm's input_tp, two decimals). */
  true_peak_dbtp: number;
  /** Highest sample, dB (volumedetect). */
  max_volume_db: number;
}

export interface Probe {
  video: VideoProbe | null;
  audio: AudioProbe | null;
  duration_s: number;
  bytes: number;
  /** Average total bitrate, kb/s. */
  kbps: number;
  atoms: string[];
  first_packet_keyframe: boolean;
  loudness: Loudness | null;
}

const ffprobeJson = (args: string[]) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', ...args, '-of', 'json'], { encoding: 'utf8' }),
  );

function fpsOf(rate: string): number {
  const [num, den] = rate.split('/').map(Number);
  return num && den ? num / den : Number.NaN;
}

/** Top-level MP4 boxes in file order (ftyp, moov, mdat, ...). */
export function topLevelAtoms(file: string): string[] {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const header = Buffer.alloc(16);
    const atoms: string[] = [];
    let offset = 0;
    while (offset + 8 <= size && atoms.length < 64) {
      fs.readSync(fd, header, 0, 16, offset);
      let length = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      if (length === 1) length = Number(header.readBigUInt64BE(8));
      else if (length === 0) length = size - offset;
      if (length < 8) break;
      atoms.push(type);
      offset += length;
    }
    return atoms;
  } finally {
    fs.closeSync(fd);
  }
}

export function firstPacketIsKeyframe(file: string): boolean {
  const out = ffprobeJson([
    '-select_streams',
    'v:0',
    '-read_intervals',
    '%+#1',
    '-show_entries',
    'packet=flags',
    file,
  ]) as { packets?: { flags?: string }[] };
  return out.packets?.[0]?.flags?.includes('K') ?? false;
}

const ffmpegLog = (file: string, filter: string) =>
  spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', filter, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ).stderr;

/** Parses the Summary block of ffmpeg's ebur128 filter. */
export function parseEbur128(log: string): { integrated: number; lra: number } {
  const summary = log.slice(log.lastIndexOf('Summary:'));
  const integrated = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1]);
  const lra = Number(/LRA:\s+(-?[\d.]+) LU/.exec(summary)?.[1]);
  return { integrated, lra };
}

/** The JSON block loudnorm prints with print_format=json. */
export function parseLoudnormJson(log: string): Record<string, string> {
  const start = log.lastIndexOf('{');
  const end = log.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('loudnorm printed no JSON');
  return JSON.parse(log.slice(start, end + 1)) as Record<string, string>;
}

export function parseMaxVolume(log: string): number {
  return Number(/max_volume:\s+(-?[\d.]+|-inf) dB/.exec(log)?.[1]);
}

export function measureLoudness(file: string): Loudness {
  const ebur = parseEbur128(ffmpegLog(file, 'ebur128=peak=true'));
  const loudnorm = parseLoudnormJson(ffmpegLog(file, 'loudnorm=print_format=json'));
  return {
    integrated_lufs: ebur.integrated,
    lra_lu: ebur.lra,
    true_peak_dbtp: Number(loudnorm.input_tp),
    max_volume_db: parseMaxVolume(ffmpegLog(file, 'volumedetect')),
  };
}

export function probeFile(file: string): Probe {
  const info = ffprobeJson(['-show_streams', '-show_format', file]) as {
    streams: Record<string, string | number>[];
    format: { duration: string; size: string };
  };
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(info.format.duration);
  const bytes = Number(info.format.size);
  return {
    video: v
      ? {
          codec: String(v.codec_name),
          profile: String(v.profile),
          level: Number(v.level),
          pix_fmt: String(v.pix_fmt),
          width: Number(v.width),
          height: Number(v.height),
          color_range: String(v.color_range ?? 'unknown'),
          color_space: String(v.color_space ?? 'unknown'),
          color_primaries: String(v.color_primaries ?? 'unknown'),
          color_transfer: String(v.color_transfer ?? 'unknown'),
          r_frame_rate: String(v.r_frame_rate),
          fps: fpsOf(String(v.r_frame_rate)),
        }
      : null,
    audio: a
      ? {
          codec: String(a.codec_name),
          profile: String(a.profile),
          channels: Number(a.channels),
          sample_rate: Number(a.sample_rate),
          bit_rate: Number(a.bit_rate),
        }
      : null,
    duration_s: duration,
    bytes,
    kbps: Math.round((bytes * 8) / duration / 10) / 100,
    atoms: topLevelAtoms(file),
    first_packet_keyframe: firstPacketIsKeyframe(file),
    loudness: a ? measureLoudness(file) : null,
  };
}

/**
 * Decodes frames to RGB with the BT.709 limited-range matrix the phones use.
 * `graph` turns [0:v] into [out]; every output frame is width x height.
 */
export function decodeRgb(file: string, graph: string, width: number, height: number): Buffer[] {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      file,
      '-filter_complex',
      `${graph},scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24[out]`,
      '-map',
      '[out]',
      '-fps_mode',
      'passthrough',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${result.stderr}`);
  const frame = width * height * 3;
  const out: Buffer[] = [];
  for (let o = 0; o + frame <= result.stdout.length; o += frame)
    out.push(result.stdout.subarray(o, o + frame));
  return out;
}

/** Largest per-channel difference from `rgb` over a region of a frame. */
export function maxDelta(
  frame: Buffer,
  width: number,
  rgb: readonly [number, number, number],
  rows: [number, number] = [0, frame.length / (width * 3)],
): number {
  let worst = 0;
  for (let y = rows[0]; y < rows[1]; y++) {
    for (let o = y * width * 3, end = o + width * 3; o < end; o += 3) {
      const d = Math.max(
        Math.abs(frame[o]! - rgb[0]),
        Math.abs(frame[o + 1]! - rgb[1]),
        Math.abs(frame[o + 2]! - rgb[2]),
      );
      if (d > worst) worst = d;
    }
  }
  return worst;
}

export const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
