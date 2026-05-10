// npm run simulate -- [--persona demo] [--mode focus] [--clock demo] [--seed 14]
//                     [--slots 30] [--minutes 3] [--synthetic] [--compare] [--find-demo-seed]
// Prints a readable session trace for a scripted learner on the real graph.
// Durations come from library/reels/*/render.json when present, else 30 s.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KnowledgeGraph,
  Manifest,
  SCHEMA_VERSION,
  type ClockSetting,
  type ManifestReel,
  type Mode,
} from '@reels/schemas';
import { buildCatalog, DEMO_SEED, mapCounts, type Catalog } from '../src/index';
import { formatCountdown } from '../src/copy';
import { persona, PERSONAS, simulate, type SimResult } from '../src/simulate';
import { describeSequence, PINNED_SEQUENCE, runDemo } from '../src/testing/demo-script';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SHA = '0'.repeat(64);

function flags(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) continue;
    const value = argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) {
      out.set(arg.slice(2), value);
      i++;
    } else out.set(arg.slice(2), 'true');
  }
  return out;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

interface TextRecord {
  status?: string;
  spec?: {
    concept_id: string;
    angle: ManifestReel['angle'];
    difficulty: number;
    retrieval_items: ManifestReel['retrieval_items'];
  };
}
interface RenderRecord {
  file: string;
  duration_s: number;
  bytes: number;
  sha256: string;
}

/** The manifest the library would produce if every passed, rendered reel were approved. */
function libraryManifest(
  graph: KnowledgeGraph,
  synthetic: boolean,
): { manifest: Manifest; source: string } {
  const dir = path.join(root, 'library/reels');
  const reels: ManifestReel[] = [];
  let rendered = 0;
  if (fs.existsSync(dir)) {
    for (const id of fs.readdirSync(dir).sort()) {
      const textFile = path.join(dir, id, 'text.json');
      if (!fs.existsSync(textFile)) continue;
      const text = readJson(textFile) as TextRecord;
      if (text.status !== 'passed' || !text.spec) continue;
      const renderFile = path.join(dir, id, 'render.json');
      const render =
        !synthetic && fs.existsSync(renderFile) ? (readJson(renderFile) as RenderRecord) : null;
      if (render) rendered++;
      reels.push({
        reel_id: id,
        concept_id: text.spec.concept_id,
        angle: text.spec.angle,
        difficulty: text.spec.difficulty,
        url: render?.file ?? `reels/${id}.mp4`,
        duration_s: render?.duration_s ?? 30,
        bytes: render?.bytes ?? 1,
        sha256: render?.sha256 ?? SHA,
        captions: [],
        retrieval_items: text.spec.retrieval_items,
      });
    }
  }
  if (reels.length === 0) {
    // No library on this machine: 3 synthetic reels per concept.
    for (const node of graph.nodes.filter((n) => n.kind === 'concept')) {
      for (const angle of ['intro', 'example', 'pitfall'] as const) {
        const id = `${node.id}--${angle}`;
        reels.push({
          reel_id: id,
          concept_id: node.id,
          angle,
          difficulty: 1,
          url: `reels/${id}.mp4`,
          duration_s: 30,
          bytes: 1,
          sha256: SHA,
          captions: [],
          retrieval_items: [1, 2].map((q) => ({
            id: `${id}--q${q}`,
            type: 'mcq' as const,
            prompt: `Question ${q}?`,
            choices: ['A', 'B', 'C', 'D'],
            answer_index: 0,
            explanation: 'Synthetic.',
            claim_ids: ['c1'],
          })),
        });
      }
    }
  }
  const source =
    rendered > 0
      ? `${reels.length} reels from library/reels (${rendered} with render.json durations)`
      : `${reels.length} reels, synthetic 30 s durations`;
  return {
    manifest: Manifest.parse({
      schema_version: SCHEMA_VERSION,
      generated_at: 0,
      domain_id: 'software-engineering',
      graph_sha256: SHA,
      reels,
    }),
    source,
  };
}

const clockOf = (ms: number) => formatCountdown(ms);

function printTrace(result: SimResult, catalog: Catalog): void {
  const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n - 1) + ' ' : s.padEnd(n));
  console.log(
    `${pad('time', 7)}${pad('#', 4)}${pad('item', 46)}${pad('lead', 9)}${pad('why', 52)}learner`,
  );
  for (const row of result.rows) {
    const item = row.item;
    const label =
      item.kind === 'reel'
        ? `reel  ${item.reelId} ${(item.durationMs / 1000).toFixed(1)}s`
        : item.kind === 'card'
          ? `card  ${item.itemId.replace(/--/g, ' ')} (${item.options.length})`
          : `summary (${item.trigger})`;
    console.log(
      `${pad(clockOf(row.t), 7)}${pad(String(row.slot), 4)}${pad(label, 46)}${pad(row.lead ?? '', 9)}${pad(row.sentence, 52)}${row.outcome}`,
    );
  }
  const s = result.state;
  const counts = mapCounts(s, catalog, s.session.last_active_at);
  const names = (ids: string[]) =>
    ids.map((id) => catalog.conceptById.get(id)?.title ?? id).join(', ') || 'none';
  const fallback = result.rows.filter((r) => r.item.reason?.code === 'FALLBACK').length;
  const cards = result.rows.filter((r) => r.item.kind === 'card').length;
  console.log(
    `\n${result.rows.length} items (${cards} cards), ${counts.learned}/${counts.total} learned, ${counts.watched} watched; ` +
      `checked this session: ${names(s.session.checked)}; learned: ${names(s.session.learned)}; ` +
      `due-timer re-plans: ${result.timerReplans}; fallback reels: ${fallback}.`,
  );
}

function main(): void {
  const f = flags(process.argv.slice(2));
  const graph = KnowledgeGraph.parse(
    readJson(path.join(root, 'content/software-engineering/graph.json')),
  );
  const { manifest, source } = libraryManifest(graph, f.get('synthetic') === 'true');
  const catalog = buildCatalog(graph, manifest);

  if (f.has('find-demo-seed')) {
    const found: number[] = [];
    for (let seed = 0; seed < 5000 && found.length < 5; seed++) {
      const run = runDemo(catalog, seed);
      const ok =
        JSON.stringify(describeSequence(run.settled)) === JSON.stringify(PINNED_SEQUENCE) &&
        run.committedBeforeTap?.conceptId !== 'react-components-props';
      if (ok) found.push(seed);
    }
    console.log(
      `Seeds that give the pinned demo sequence (${source}): ${found.join(', ') || 'none'}`,
    );
    return;
  }

  const clock = (f.get('clock') ?? 'demo') as ClockSetting;
  const mode = (f.get('mode') ?? (clock === 'demo' ? 'focus' : 'light')) as Mode;
  const seed = Number(f.get('seed') ?? DEMO_SEED);
  const slots = Number(f.get('slots') ?? 30);
  const minutes = f.has('minutes') ? Number(f.get('minutes')) : undefined;

  if (f.has('compare')) {
    console.log(`Library: ${source}. ${slots} slots per run, seed ${seed}.\n`);
    console.log(
      'persona            mode   clock  cards  deepen explore lateral review fallback learned',
    );
    for (const id of [
      'curious',
      'skipper',
      'struggler',
      'too-easy',
      'likes-ai-engineering',
      'skips-ai-engineering',
    ]) {
      for (const m of ['light', 'focus'] as const) {
        for (const c of ['real', 'demo'] as const) {
          const r = simulate({
            catalog,
            persona: persona(id),
            mode: m,
            clock: c,
            seed,
            start: 0,
            slots,
          });
          const n = (pred: (row: (typeof r.rows)[number]) => boolean) =>
            String(r.rows.filter(pred).length).padEnd(7);
          console.log(
            `${id.padEnd(19)}${m.padEnd(7)}${c.padEnd(7)}${n((x) => x.item.kind === 'card')}${n((x) => x.item.pool === 'deepen')}${n((x) => x.item.pool === 'explore')}${n((x) => x.item.pool === 'lateral')}${n((x) => x.item.pool === 'review')}${n((x) => x.item.reason?.code === 'FALLBACK')}${mapCounts(r.state, catalog, 0).learned}`,
          );
        }
      }
    }
    return;
  }

  const p = persona(f.get('persona') ?? 'demo');
  console.log(`Persona ${p.id}: ${p.description}`);
  console.log(`Mode ${mode}, ${clock} clock, seed ${seed}. Library: ${source}.`);
  console.log(`Personas: ${PERSONAS.join(', ')}.\n`);
  const result = simulate({
    catalog,
    persona: p,
    mode,
    clock,
    seed,
    start: 0,
    slots,
    durationMs: minutes !== undefined ? minutes * 60_000 : undefined,
  });
  printTrace(result, catalog);
}

main();
