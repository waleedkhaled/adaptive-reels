// Video output settings (PERFORMANCE.md 6.1), single-sourced for the Node
// renderer and the Remotion templates. No Node imports: the browser bundle
// imports this file too.
import { reel } from '@reels/tokens';

export const VIDEO = {
  /** Composition canvas in px. Every layout number in the templates is on this canvas. */
  width: reel.canvas.width,
  height: reel.canvas.height,
  /** Every frame count in the templates derives from this. */
  fps: reel.canvas.fps,
  /** Remotion output scale: 1.5 renders the 720 x 1280 canvas at 1080 x 1920. */
  scale: reel.outputScale,
  crf: 20,
  x264Preset: 'medium',
  gopSize: 150,
  /** Empty ground before any content, for the app's first-frame placeholder handoff. */
  leadInSeconds: 0.3,
  /** Silence after each narrated part. */
  gapMs: 250,
  /** Hard stop in the renderer; the encode gate applies the tighter cap below. */
  maxDurationS: 60,
  audio: {
    sampleRate: 48000,
    bitrate: '64k',
    /** Remotion's own AAC pass, re-encoded by ffmpeg afterwards. */
    intermediateBitrate: '320k',
  },
  /**
   * ffmpeg loudnorm values and the gate target. With dualMono the mono file
   * measures about 3 LU below `I`, hence the -19 gate target (PERFORMANCE.md 6.1).
   */
  loudness: { I: -16, TP: -3, LRA: 11, dualMono: true, gateMonoLufs: -19 },
  /** Encode gate limits (PERFORMANCE.md 1 "Reel file" and 6.2). */
  gate: {
    maxDurationS: 39.5,
    /** Provisional average total bitrate caps, kb/s, by output height. */
    maxKbps: { 1280: 450, 1920: 900 } as Record<number, number>,
    /** Highest H.264 level (x10) by output height at 30 fps. */
    maxLevel: { 1280: 31, 1920: 40 } as Record<number, number>,
    loudnessToleranceLu: 1,
    maxTruePeakDbtp: -1,
    /** A decoded ground pixel may differ from bg.base by this much per channel. */
    groundTolerance: 1,
  },
} as const;

/** Frames of empty ground at the start of every reel (9 at 30 fps). */
export function leadInFrames(fps: number = VIDEO.fps): number {
  return Math.round(VIDEO.leadInSeconds * fps);
}

/** The encoded picture size: the canvas times the output scale. */
export function outputSize(): { width: number; height: number } {
  return {
    width: Math.round(VIDEO.width * VIDEO.scale),
    height: Math.round(VIDEO.height * VIDEO.scale),
  };
}
