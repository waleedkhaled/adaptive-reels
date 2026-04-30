import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useLibrary } from './config';
import { readDecisions } from './decisions';
import { cacheControl, createReviewServer } from './serve';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-serve-'));
const hashed = 'a--intro.0123456789ab.mp4';
const server = createReviewServer();
let base = '';

beforeAll(async () => {
  useLibrary(dir);
  fs.mkdirSync(path.join(dir, 'reels/a--intro'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.html'), '<h1>report</h1>');
  fs.writeFileSync(path.join(dir, 'reels/a--intro/video.mp4'), Buffer.from('0123456789'));
  fs.writeFileSync(path.join(dir, `reels/a--intro/${hashed}`), Buffer.from('0123456789'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
  fs.writeFileSync(path.join(dir, 'manifest.all.json'), '{}');
  fs.writeFileSync(path.join(os.tmpdir(), 'secret.txt'), 'nope');
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const sha = 'a'.repeat(64);

describe('review server', () => {
  it('serves the report at /', async () => {
    const res = await fetch(`${base}/`);
    expect(await res.text()).toBe('<h1>report</h1>');
  });

  it('answers byte ranges for video', async () => {
    const res = await fetch(`${base}/reels/a--intro/video.mp4`, {
      headers: { Range: 'bytes=2-5' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await res.text()).toBe('2345');
  });

  it('serves hashed videos as immutable video/mp4, ranges included', async () => {
    for (const init of [{}, { headers: { Range: 'bytes=0-3' } }]) {
      const res = await fetch(`${base}/reels/a--intro/${hashed}`, init);
      expect(res.headers.get('content-type')).toBe('video/mp4');
      expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(res.headers.get('accept-ranges')).toBe('bytes');
    }
    const head = await fetch(`${base}/reels/a--intro/${hashed}`, { method: 'HEAD' });
    expect(head.headers.get('content-length')).toBe('10');
  });

  it('revalidates manifests and unhashed files', async () => {
    for (const file of ['manifest.json', 'manifest.all.json', 'reels/a--intro/video.mp4']) {
      const res = await fetch(`${base}/${file}`);
      expect(res.headers.get('cache-control')).toBe('no-cache');
    }
    expect(cacheControl('reels/x--intro/x--intro.abcdef012345.mp4')).toMatch(/immutable/);
    expect(cacheControl('reels/x--intro/x--intro.mp4')).toBe('no-cache');
  });

  it('refuses paths outside the library', async () => {
    const res = await fetch(`${base}/..%2Fsecret.txt`);
    expect(res.status).toBe(404);
  });

  it('saves, reads and clears decisions', async () => {
    const post = (body: unknown) =>
      fetch(`${base}/api/decisions`, { method: 'POST', body: JSON.stringify(body) });
    expect(
      (await post({ reel_id: 'a--intro', decision: 'approved', sha256: sha, note: 'nice' })).status,
    ).toBe(200);
    expect(readDecisions()['a--intro']).toMatchObject({
      decision: 'approved',
      sha256: sha,
      note: 'nice',
    });
    expect(await (await fetch(`${base}/api/decisions`)).json()).toHaveProperty('a--intro');
    await post({ reel_id: 'a--intro', decision: null, sha256: sha });
    expect(readDecisions()).toEqual({});
  });

  it('rejects malformed decisions', async () => {
    const res = await fetch(`${base}/api/decisions`, {
      method: 'POST',
      body: '{"reel_id":"x","decision":"maybe"}',
    });
    expect(res.status).toBe(400);
  });
});
