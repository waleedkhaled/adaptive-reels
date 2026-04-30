// The offline stages (layout, render, gate, report) work only from records
// already on disk. While they run, fetch and http may reach this machine only
// (Remotion talks to its own server and browser on loopback) and https is refused.
import http from 'node:http';
import https from 'node:https';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopback(
  target: string | URL | { hostname?: string | null; host?: string | null },
): boolean {
  if (typeof target === 'string' || target instanceof URL) {
    try {
      return LOOPBACK.has(new URL(target).hostname);
    } catch {
      return false;
    }
  }
  const host = (target.hostname ?? target.host ?? 'localhost').replace(/:\d+$/, '');
  return LOOPBACK.has(host);
}

type AnyFn = (...args: unknown[]) => unknown;

/** Installs the guard; returns a function that removes it. */
export function guardNetwork(label: string): () => void {
  const original = {
    fetch: globalThis.fetch,
    httpRequest: http.request,
    httpGet: http.get,
    httpsRequest: https.request,
    httpsGet: https.get,
  };
  const blocked = (what: string) => new Error(`Network call blocked (${label}): ${what}`);
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!isLoopback(url)) throw blocked(url);
    return original.fetch(input, init);
  }) as typeof fetch;
  const loopbackOnly =
    (fn: AnyFn): AnyFn =>
    (...args) => {
      const target = args[0] as Parameters<typeof isLoopback>[0];
      if (!isLoopback(target)) throw blocked(`http ${JSON.stringify(target)}`);
      return fn(...args);
    };
  const refuse: AnyFn = () => {
    throw blocked('https');
  };
  const mutableHttp = http as unknown as Record<'request' | 'get', AnyFn>;
  const mutableHttps = https as unknown as Record<'request' | 'get', AnyFn>;
  mutableHttp.request = loopbackOnly(original.httpRequest as AnyFn);
  mutableHttp.get = loopbackOnly(original.httpGet as AnyFn);
  mutableHttps.request = refuse;
  mutableHttps.get = refuse;
  return () => {
    globalThis.fetch = original.fetch;
    mutableHttp.request = original.httpRequest as AnyFn;
    mutableHttp.get = original.httpGet as AnyFn;
    mutableHttps.request = original.httpsRequest as AnyFn;
    mutableHttps.get = original.httpsGet as AnyFn;
  };
}
