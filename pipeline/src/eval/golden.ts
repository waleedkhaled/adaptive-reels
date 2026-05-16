// The eval's golden set: frozen copies of real reel specs together with the
// concept and source card they were written from. Freezing them keeps the set
// stable when content/ or library/ changes, and lets the eval run from a clean
// clone (library/ is not committed). Files: pipeline/evals/golden/<reel_id>.json
import fs from 'node:fs';
import path from 'node:path';
import { ReelSpec, type GraphNode } from '@reels/schemas';
import { REPO_ROOT } from '../config';
import { parseSourceCard, type Job } from '../content';

export const EVAL_DIR = path.join(REPO_ROOT, 'pipeline/evals');
export const GOLDEN_DIR = path.join(EVAL_DIR, 'golden');
export const RESULTS_DIR = path.join(EVAL_DIR, 'results');

interface NodeSnapshot {
  id: string;
  title: string;
  summary: string;
}

export interface GoldenFile {
  reel_id: string;
  /** How the "good" label was established, and by whom. */
  label_source: string;
  concept: NodeSnapshot;
  topic: NodeSnapshot;
  /** The source card's markdown, as the writer and the reviewer saw it. */
  card: { ref: string; text: string };
  spec: ReelSpec;
}

export interface Golden {
  file: GoldenFile;
  spec: ReelSpec;
  job: Job;
}

const node = (n: NodeSnapshot, kind: GraphNode['kind']): GraphNode => ({
  id: n.id,
  kind,
  title: n.title,
  summary: n.summary,
});

export function jobForGolden(file: GoldenFile, spec: ReelSpec): Job {
  return {
    reelId: file.reel_id,
    angle: spec.angle,
    concept: {
      node: node(file.concept, 'concept'),
      topic: node(file.topic, 'topic'),
      prerequisites: [],
      card: parseSourceCard(file.concept.id, file.card.text, file.card.ref),
    },
  };
}

export function loadGolden(dir: string = GOLDEN_DIR): Golden[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as GoldenFile;
      const spec = ReelSpec.parse(file.spec);
      return { file, spec, job: jobForGolden(file, spec) };
    });
}
