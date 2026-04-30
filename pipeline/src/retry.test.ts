import { afterEach, describe, expect, it, vi } from 'vitest';
import { postJson, ProviderError } from './providers/deepinfra';
import { backoffMs, DEFAULT_RETRY, isRetryableStatus, parseRetryAfter } from './retry';

describe('backoff with full jitter', () => {
  it('draws below a ceiling that doubles per retry up to the cap', () => {
    const top = () => 0.999999;
    expect(backoffMs(1, DEFAULT_RETRY, top)).toBe(999);
    expect(backoffMs(2, DEFAULT_RETRY, top)).toBe(1999);
    expect(backoffMs(3, DEFAULT_RETRY, top)).toBe(3999);
    expect(backoffMs(10, DEFAULT_RETRY, top)).toBe(DEFAULT_RETRY.capMs - 1);
    expect(backoffMs(3, DEFAULT_RETRY, () => 0)).toBe(0);
  });
});

describe('Retry-After', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');

  it('reads delay-seconds and HTTP dates', () => {
    expect(parseRetryAfter('7', now)).toBe(7000);
    expect(parseRetryAfter(' 0 ', now)).toBe(0);
    expect(parseRetryAfter('Mon, 05 Oct 2026 12:00:30 GMT', now)).toBe(30_000);
    expect(parseRetryAfter('Mon, 05 Oct 2026 11:00:00 GMT', now)).toBe(0);
  });

  it('ignores missing or malformed values', () => {
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter('soon', now)).toBeNull();
    expect(parseRetryAfter('-5', now)).toBeNull();
  });
});

describe('isRetryableStatus', () => {
  it('retries rate limits, timeouts and server errors only', () => {
    expect([408, 429, 500, 502, 503].map(isRetryableStatus)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect([400, 401, 402, 404, 422].map(isRetryableStatus)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('postJson', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  function script(...steps: (Response | Error)[]) {
    const calls = vi.fn(async () => {
      const step = steps.shift();
      if (!step) throw new Error('unexpected extra call');
      if (step instanceof Error) throw step;
      return step;
    });
    globalThis.fetch = calls as unknown as typeof fetch;
    return calls;
  }

  const opts = (waits: number[]) => ({
    timeoutMs: 1000,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
    random: () => 0.5,
  });

  it('honours Retry-After on a 429, backs off on a 503, and reports the attempts', async () => {
    const calls = script(
      respond(429, { error: 'slow down' }, { 'retry-after': '2' }),
      respond(503, { error: 'busy' }),
      respond(200, { ok: true }),
    );
    const waits: number[] = [];
    const result = await postJson('key', 'https://example.test/x', {}, opts(waits));
    expect(result).toEqual({ data: { ok: true }, attempts: 3 });
    expect(calls).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([2000, 1000]); // Retry-After, then half of the 2 s ceiling
  });

  it('retries network errors', async () => {
    script(new TypeError('fetch failed'), respond(200, { ok: 1 }));
    const waits: number[] = [];
    expect((await postJson('key', 'https://example.test/x', {}, opts(waits))).attempts).toBe(2);
    expect(waits).toEqual([500]);
  });

  it('fails at once on a 4xx that retrying cannot fix', async () => {
    const calls = script(respond(402, { error: 'no balance' }));
    const waits: number[] = [];
    await expect(postJson('key', 'https://example.test/x', {}, opts(waits))).rejects.toThrow(
      /HTTP 402 after 1 attempt/,
    );
    expect(calls).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it('gives up instead of waiting out a Retry-After longer than the policy allows', async () => {
    script(respond(429, {}, { 'retry-after': '600' }));
    const waits: number[] = [];
    await expect(postJson('key', 'https://example.test/x', {}, opts(waits))).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(waits).toEqual([]);
  });

  it('stops after the last attempt with the last error', async () => {
    const calls = script(...Array.from({ length: 4 }, () => respond(500, { error: 'down' })));
    const waits: number[] = [];
    await expect(postJson('key', 'https://example.test/x', {}, opts(waits))).rejects.toThrow(
      /HTTP 500 after 4 attempt/,
    );
    expect(calls).toHaveBeenCalledTimes(DEFAULT_RETRY.attempts);
    expect(waits).toHaveLength(DEFAULT_RETRY.attempts - 1);
  });
});
