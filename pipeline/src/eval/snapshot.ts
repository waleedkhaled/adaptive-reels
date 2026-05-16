// Freezes passed library reels into the golden set.
// Usage (repo root): npx tsx pipeline/src/eval/snapshot.ts <reel_id> [<reel_id> ...]
import fs from 'node:fs';
import path from 'node:path';
import { jobsFor, loadContent } from '../content';
import { readRecord, type TextRecord } from '../store';
import { GOLDEN_DIR, type GoldenFile } from './golden';

const ids = process.argv.slice(2);
if (!ids.length) {
  process.stderr.write('Usage: npx tsx pipeline/src/eval/snapshot.ts <reel_id> [...]\n');
  process.exit(1);
}
const content = loadContent();
fs.mkdirSync(GOLDEN_DIR, { recursive: true });
for (const id of ids) {
  const job = jobsFor(content, { only: [id] }).find((j) => j.reelId === id);
  const text = readRecord<TextRecord>(id, 'text');
  if (!job || !text?.spec || text.status !== 'passed') {
    throw new Error(`${id}: needs a passed text record in library/reels/${id}/`);
  }
  const { node, topic, card } = job.concept;
  const file: GoldenFile = {
    reel_id: id,
    label_source: 'unchecked',
    concept: { id: node.id, title: node.title, summary: node.summary },
    topic: { id: topic.id, title: topic.title, summary: topic.summary },
    card: { ref: card.ref, text: card.text },
    spec: text.spec,
  };
  fs.writeFileSync(path.join(GOLDEN_DIR, `${id}.json`), `${JSON.stringify(file, null, 2)}\n`);
  process.stdout.write(`${id}\n`);
}
