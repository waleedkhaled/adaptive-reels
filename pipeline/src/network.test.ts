import http from 'node:http';
import https from 'node:https';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardNetwork, isLoopback } from './network';

describe('offline network guard', () => {
  let restore = () => {};
  afterEach(() => restore());

  it('recognises this machine', () => {
    expect(isLoopback('http://localhost:3000/x')).toBe(true);
    expect(isLoopback('http://127.0.0.1/x')).toBe(true);
    expect(isLoopback('http://[::1]:9/x')).toBe(true);
    expect(isLoopback({ hostname: '127.0.0.1' })).toBe(true);
    expect(isLoopback({})).toBe(true);
    expect(isLoopback('https://api.deepinfra.com/v1')).toBe(false);
    expect(isLoopback({ host: 'example.com:443' })).toBe(false);
  });

  it('blocks remote fetch, https and remote http, then restores them', async () => {
    const realFetch = globalThis.fetch;
    const spy = vi.fn(async () => new Response('ok'));
    globalThis.fetch = spy as unknown as typeof fetch;
    const realRequest = https.request;
    restore = guardNetwork('test');
    await expect(fetch('https://api.deepinfra.com/v1')).rejects.toThrow(/blocked/);
    expect(await (await fetch('http://127.0.0.1:1/x')).text()).toBe('ok');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(() => https.request('https://example.com')).toThrow(/blocked/);
    expect(() => http.request('http://example.com')).toThrow(/blocked/);
    restore();
    restore = () => {};
    expect(https.request).toBe(realRequest);
    globalThis.fetch = realFetch;
  });
});
