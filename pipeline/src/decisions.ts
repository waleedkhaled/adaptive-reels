// Your approve/reject decisions from the review report, stored next to the
// library. A decision is tied to the video's sha256, so re-rendering a reel
// sends it back to "pending".
import fs from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { PATHS } from './config';

export const Decision = z.object({
  decision: z.enum(['approved', 'rejected']),
  /** The rendered video this decision was made on. */
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().max(500).default(''),
  at: z.string(),
});
export type Decision = z.infer<typeof Decision>;

export const Decisions = z.record(z.string(), Decision);
export type Decisions = z.infer<typeof Decisions>;

export const decisionsPath = () => path.join(PATHS.library, 'decisions.json');

export function readDecisions(): Decisions {
  const file = decisionsPath();
  if (!fs.existsSync(file)) return {};
  return Decisions.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function writeDecisions(decisions: Decisions): void {
  fs.mkdirSync(PATHS.library, { recursive: true });
  // Write then rename, so a crash mid-write never leaves half a file.
  const tmp = `${decisionsPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(decisions, null, 2));
  fs.renameSync(tmp, decisionsPath());
}

/** The decision that still applies to the current video, if any. */
export function currentDecision(
  decisions: Decisions,
  reelId: string,
  sha256: string | undefined,
): Decision | null {
  const d = decisions[reelId];
  return d && sha256 && d.sha256 === sha256 ? d : null;
}
