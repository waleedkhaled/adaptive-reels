import { describe, expect, it } from 'vitest';
import { outputSize, VIDEO } from '../video';
import { audioPassArgs, hashedName, REMOTION_ENCODE } from './encode';

describe('encode settings (PERFORMANCE.md 6.1)', () => {
  it('renders the 720 x 1280 canvas at 1080 x 1920, 30 fps', () => {
    expect(outputSize()).toEqual({ width: 1080, height: 1920 });
    expect(VIDEO.fps).toBe(30);
  });

  it('asks Remotion for PNG frames, BT.709 limited range, CRF 20, GOP 150, medium preset', () => {
    expect(REMOTION_ENCODE).toMatchObject({
      codec: 'h264',
      imageFormat: 'png',
      colorSpace: 'bt709',
      pixelFormat: 'yuv420p',
      crf: 20,
      gopSize: 150,
      x264Preset: 'medium',
      scale: 1.5,
    });
  });

  it('re-encodes audio with the corrected loudnorm command, video copied', () => {
    expect(audioPassArgs('video.raw.mp4', 'video.mp4').join(' ')).toBe(
      '-y -v error -i video.raw.mp4 -c:v copy -ar 48000 -c:a aac -b:a 64k -movflags +faststart ' +
        '-af pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=-16:TP=-3:LRA=11:dual_mono=true video.mp4',
    );
  });

  it('names files by the first 12 hex of their sha256', () => {
    expect(hashedName('caching--intro', 'abcdef0123456789'.repeat(4))).toBe(
      'caching--intro.abcdef012345.mp4',
    );
  });
});
