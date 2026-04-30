// Review server: serves library/ (report, videos) to any device on your
// network and saves approve/reject decisions from the report straight to
// library/decisions.json. Supports HTTP range requests, which iOS needs to play video.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as z from 'zod';
import { PATHS } from './config';
import { Decision, readDecisions, writeDecisions } from './decisions';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

const DecisionUpdate = z.object({
  reel_id: z.string().min(1),
  decision: z.enum(['approved', 'rejected']).nullable(),
  sha256: Decision.shape.sha256,
  note: z.string().max(500).default(''),
});

/** reels/<id>/<id>.<sha256[0:12]>.mp4: the content never changes under that name. */
export const HASHED_VIDEO = /\.[0-9a-f]{12}\.mp4$/;

/**
 * Hashed videos are immutable, as on the production host (PERFORMANCE.md 6.3);
 * manifests, the report and anything unhashed are revalidated on every request.
 */
export function cacheControl(file: string): string {
  return HASHED_VIDEO.test(path.basename(file))
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

function sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string) {
  const { size } = fs.statSync(file);
  const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  const common = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl(file),
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start < 0 || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, {
      ...common,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`,
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...common, 'Content-Length': size });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export function createReviewServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/api/decisions') {
        if (req.method === 'GET') {
          res
            .writeHead(200, { 'Content-Type': 'application/json' })
            .end(JSON.stringify(readDecisions()));
          return;
        }
        if (req.method === 'POST') {
          const update = DecisionUpdate.parse(JSON.parse(await readBody(req)));
          const decisions = readDecisions();
          if (update.decision === null) delete decisions[update.reel_id];
          else {
            decisions[update.reel_id] = {
              decision: update.decision,
              sha256: update.sha256,
              note: update.note,
              at: new Date().toISOString(),
            };
          }
          writeDecisions(decisions);
          res
            .writeHead(200, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(405).end();
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      const rel = decodeURIComponent(url.pathname === '/' ? '/report.html' : url.pathname);
      const file = path.resolve(PATHS.library, `.${rel}`);
      // Never serve anything outside library/.
      if (
        !file.startsWith(PATHS.library + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      ) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      sendFile(req, res, file);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end((error as Error).message);
    }
  });
}

/** IPv4 addresses other devices on the network can reach. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}
