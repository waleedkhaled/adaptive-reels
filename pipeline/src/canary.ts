// Canary for the claims gate: a known-good spec must pass G2 and the same spec
// with one planted false claim must fail it. Costs two reviewer calls.
import fs from 'node:fs';
import path from 'node:path';
import { ReelSpec } from '@reels/schemas';
import { REPO_ROOT } from './config';
import { jobsFor, loadContent } from './content';
import { gateG2, gatePromptVersions, type GateResult } from './gates';
import type { CostLedger } from './ledger';
import type { LLM } from './providers/types';
import { LLMReviewer } from './reviewer';

export function plantFalseClaim(spec: ReelSpec): ReelSpec {
  const planted = structuredClone(spec);
  // Same quote, opposite claim: the card says props are read-only.
  planted.key_claims[0]!.text =
    'A component can change its own props directly to update what is shown on screen.';
  planted.segments[1]!.narration =
    'Props are yours to change. To update what is shown, a component can simply assign new values to its props.';
  return planted;
}

export async function runCanary(
  reviewerLLM: LLM,
  ledger: CostLedger,
): Promise<{ control: GateResult; planted: GateResult }> {
  const fixture = path.join(REPO_ROOT, 'packages/schemas/fixtures/reel-spec.valid.json');
  const spec = ReelSpec.parse(JSON.parse(fs.readFileSync(fixture, 'utf8')));
  const job = jobsFor(loadContent(), { only: [spec.reel_id] })[0];
  if (!job) throw new Error(`canary: no job for ${spec.reel_id}`);
  const reviewer = new LLMReviewer(reviewerLLM, ledger, await gatePromptVersions());
  const control = await gateG2(spec, job, reviewer);
  const planted = await gateG2({ ...plantFalseClaim(spec), reel_id: spec.reel_id }, job, reviewer);
  return { control, planted };
}
