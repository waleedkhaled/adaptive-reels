// Shared styling for the reel templates. Colours, sizes and motion come from
// @reels/tokens (DESIGN.md "Status Board"); nothing here is a raw hex value.
import type { CSSProperties } from 'react';
import { color, motion, reel, type FontFamily } from '@reels/tokens';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SyntaxRole } from '../syntax';

export { color };

export const cssStack = (stack: readonly FontFamily[]) => stack.map((f) => `"${f}"`).join(', ');

/**
 * Every baked text block: no ligatures, normal kerning, no synthetic bold or
 * italic, no wrapping (lines are broken by the layout pass, never by CSS).
 * The measurer in measure.ts uses the same settings.
 */
export const TEXT: CSSProperties = {
  fontVariantLigatures: 'none',
  fontKerning: 'normal',
  fontSynthesis: 'none',
  whiteSpace: 'pre',
};

const ease = Easing.bezier(...motion.easing);

/** Token frame counts are authored at the canvas rate (30 fps); this scales them to the render rate. */
export const framesAt = (frames: number, fps: number) =>
  Math.max(1, Math.round((frames * fps) / reel.canvas.fps));

/**
 * The only entrance in a reel: opacity 0 to 1 over reel.fadeFrames from
 * `start`, with `step` frames between staggered entrances (code lines, flow
 * boxes, arrows). Both follow the composition's frame rate (VIDEO.fps).
 */
export function useMotion() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = framesAt(reel.fadeFrames, fps);
  const fade = (start = 0) =>
    interpolate(frame, [start, start + fadeFrames], [0, 1], {
      easing: ease,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  return { frame, fps, fade, fadeFrames, step: framesAt(reel.codeLineFrames, fps) };
}

export const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export const SYNTAX: Record<SyntaxRole, string> = {
  plain: color.text.primary,
  keyword: color.text.primary,
  literal: color.syntax.literal,
  name: color.syntax.name,
  muted: color.text.secondary,
};
