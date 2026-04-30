import { reel } from '@reels/tokens';
import { describe, expect, it } from 'vitest';
import { cssStack, framesAt, msToFrame } from './theme';

describe('template timing', () => {
  it('keeps the token frame counts at 30 fps and the same durations at other rates', () => {
    expect(framesAt(reel.fadeFrames, 30)).toBe(6);
    expect(framesAt(reel.codeLineFrames, 30)).toBe(4);
    expect(framesAt(reel.fadeFrames, 60)).toBe(12);
    expect(framesAt(reel.codeLineFrames, 60)).toBe(8);
  });

  it('places a spoken word on the frame it starts', () => {
    expect(msToFrame(335, 30)).toBe(10);
    expect(msToFrame(335, 60)).toBe(20);
  });

  it('writes the font stacks of the token module as CSS', () => {
    expect(cssStack(reel.fontStack.display700)).toBe('"BarlowSC-Bold", "MonoNL-ExtraBold"');
  });
});
