// Retry policy for provider calls: exponential backoff with full jitter, or the
// provider's own Retry-After when it sends one. Rate limits (429), request
// timeouts (408), server errors (5xx) and network failures are retried; any
// other 4xx (bad request, no balance) fails at once because retrying can't fix it.

export interface RetryPolicy {
  /** Total attempts, including the first. */
  attempts: number;
  /** First backoff ceiling; doubles on every retry. */
  baseMs: number;
  /** Largest backoff ceiling. */
  capMs: number;
  /** A Retry-After longer than this fails the call instead of stalling the run. */
  maxRetryAfterMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = {
  attempts: 4,
  baseMs: 1_000,
  capMs: 20_000,
  maxRetryAfterMs: 60_000,
};

/**
 * Full jitter: a random wait in [0, min(cap, base * 2^(retry - 1))). Reels run
 * 4 at a time against one provider, so a rate limit tends to hit several calls
 * at once; random waits keep their retries from arriving together again.
 */
export function backoffMs(
  retry: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
): number {
  return Math.floor(random() * Math.min(policy.capMs, policy.baseMs * 2 ** (retry - 1)));
}

/** Retry-After is either delay-seconds or an HTTP date (RFC 9110, section 10.2.3). */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  // An HTTP date always names the weekday and month; Date.parse alone would accept "-5" as a year.
  if (!/[a-z]{3}/i.test(text)) return null;
  const at = Date.parse(text);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

export const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;
