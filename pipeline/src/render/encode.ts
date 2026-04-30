// Encode settings of PERFORMANCE.md 6.1, kept free of Remotion imports so
// they can be unit-tested: the renderMedia options and the corrected ffmpeg
// audio pass (mono, loudness-normalised, 64k AAC at 48 kHz, faststart, video copied).
import { VIDEO } from '../video';

/** The renderMedia options that define the encode (the rest is plumbing). */
export const REMOTION_ENCODE = {
  codec: 'h264',
  crf: VIDEO.crf,
  x264Preset: VIDEO.x264Preset,
  gopSize: VIDEO.gopSize,
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  imageFormat: 'png',
  scale: VIDEO.scale,
  audioCodec: 'aac',
  audioBitrate: VIDEO.audio.intermediateBitrate,
} as const;

/** ffmpeg arguments for the audio pass; the video stream is copied untouched. */
export function audioPassArgs(input: string, output: string): string[] {
  const l = VIDEO.loudness;
  const loudnorm = `loudnorm=I=${l.I}:TP=${l.TP}:LRA=${l.LRA}${l.dualMono ? ':dual_mono=true' : ''}`;
  return [
    '-y',
    '-v',
    'error',
    '-i',
    input,
    '-c:v',
    'copy',
    '-ar',
    String(VIDEO.audio.sampleRate),
    '-c:a',
    'aac',
    '-b:a',
    VIDEO.audio.bitrate,
    '-movflags',
    '+faststart',
    '-af',
    `pan=mono|c0=0.5*c0+0.5*c1,${loudnorm}`,
    output,
  ];
}

/** reels/<id>/<id>.<first 12 hex of sha256>.mp4 */
export const hashedName = (reelId: string, sha256: string) =>
  `${reelId}.${sha256.slice(0, 12)}.mp4`;
