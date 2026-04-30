// Pipeline entry point: npm run pipeline -- <stage|all|canary> [options]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runCanary } from './canary';
import { jobsFor, loadContent } from './content';
import { currentDecision, readDecisions } from './decisions';
import { writeManifests } from './manifest';
import { writeReport } from './report';
import { createReviewServer, lanAddresses } from './serve';
import { isCurrentRender, readRecord, type RenderRecord } from './store';
import { DEFAULT_BUDGET_CAP_USD, PATHS, REPO_ROOT } from './config';
import { CostLedger } from './ledger';
import { deepInfraProviders } from './providers/deepinfra';
import { run, STAGES, type Stage } from './run';

const STAGE_HELP: Record<Stage | 'all' | 'canary' | 'approve' | 'setup' | 'serve', string> = {
  setup: 'One-time: download the headless Chrome Remotion renders with (~95 MB)',
  generate: 'Writer drafts a spec per reel, then gates G1-G4 (one rewrite on failure)',
  review: 'Re-run gates G1-G4 on existing specs, no rewrite',
  tts: 'Kokoro narration with word timestamps (passed reels only)',
  images: 'FLUX schnell images for "image" visuals only',
  layout: 'Dry layout pass only: reformat code, glyph audit, measure with the real fonts (offline)',
  render: 'Layout pass, Remotion -> H.264 1080x1920, encode gate, manifests + report (offline)',
  gate: 'Re-run the encode gate on rendered reels, then manifests + report (offline)',
  report: 'Rebuild manifest.json, manifest.all.json and report.html from what exists',
  all: 'generate, tts, images, layout, render, gate, report',
  canary: 'Check G2 rejects a planted false claim (2 reviewer calls)',
  serve: 'Serve the report on your network; approve/reject saves to library/decisions.json',
  approve: 'Rebuild manifest.json from your approved reels and summarise decisions',
};

const HELP = `Usage: npm run pipeline -- <stage> [options]

Stages:
${Object.entries(STAGE_HELP)
  .map(([name, d]) => `  ${name.padEnd(10)}${d}`)
  .join('\n')}

Options:
  --dry-run        Fake providers, network blocked, writes to library/dry-run/; prints projected cost
  --limit <n>      Only the first n reels (M1 validates on 5)
  --only <ids>     Comma-separated reel or concept ids
  --budget <usd>   Stop before spend would exceed this (default: BUDGET_CAP_USD or ${DEFAULT_BUDGET_CAP_USD})
  --force          Redo stages that already have output
  --concurrency <n> Reels processed in parallel (default 4; rendering is always 1)
  --render-concurrency <n> Frames Remotion renders in parallel per reel (default: Remotion's)
  -h, --help       Show this help
`;

const envFile = path.join(REPO_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
    only: { type: 'string' },
    budget: { type: 'string' },
    force: { type: 'boolean', default: false },
    concurrency: { type: 'string' },
    'render-concurrency': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const command = positionals[0];
const budgetUsd = Number(values.budget ?? process.env.BUDGET_CAP_USD ?? DEFAULT_BUDGET_CAP_USD);

async function main(): Promise<number> {
  if (values.help || !command) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0)
    throw new Error(`invalid budget "${values.budget}"`);

  if (command === 'setup') {
    const { ensureBrowser } = await import('@remotion/renderer');
    const browser = await ensureBrowser();
    process.stdout.write(`Headless Chrome ready (${browser.type}).\n`);
    return 0;
  }

  if (command === 'serve') {
    const port = Number(process.env.PORT ?? 8090);
    const server = createReviewServer();
    await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
    const urls = [
      `http://localhost:${port}`,
      ...lanAddresses().map((ip) => `http://${ip}:${port}`),
    ];
    process.stdout.write(
      `Review server running. Open on this Mac or your phone (same Wi-Fi):\n${urls.map((u) => `  ${u}`).join('\n')}\nDecisions save to library/decisions.json. Ctrl+C to stop.\n`,
    );
    await new Promise(() => {});
    return 0;
  }

  if (command === 'approve') {
    const content = loadContent();
    const jobs = jobsFor(content).filter((j) => readRecord(j.reelId, 'text'));
    const decisions = readDecisions();
    const counts = writeManifests(content, jobs, decisions);
    writeReport(jobs, 'Approve');
    const states = jobs.map((j) => {
      const render = readRecord<RenderRecord>(j.reelId, 'render');
      return isCurrentRender(render)
        ? (currentDecision(decisions, j.reelId, render.sha256)?.decision ?? 'pending')
        : 'not rendered';
    });
    const count = (s: string) => states.filter((x) => x === s).length;
    const stale = Object.keys(decisions).filter((id) => {
      const render = readRecord<RenderRecord>(id, 'render');
      return render && decisions[id]!.sha256 !== render.sha256;
    });
    process.stdout.write(
      `Manifest: ${counts.approved} approved reel(s) -> library/manifest.json (${counts.all} in manifest.all.json)\n` +
        `Approved ${count('approved')} · rejected ${count('rejected')} · still to review ${count('pending')} · not rendered ${count('not rendered')}\n` +
        (stale.length
          ? `Re-rendered since your decision (review again): ${stale.join(', ')}\n`
          : ''),
    );
    return 0;
  }

  if (command === 'canary') {
    const key = process.env.DEEPINFRA_API_KEY;
    if (!key) throw new Error('DEEPINFRA_API_KEY is not set');
    const ledger = new CostLedger(budgetUsd, `canary-${Date.now()}`, false, (e) => {
      fs.mkdirSync(PATHS.library, { recursive: true });
      fs.appendFileSync(path.join(PATHS.library, 'canary-ledger.jsonl'), `${JSON.stringify(e)}\n`);
    });
    const { control, planted } = await runCanary(deepInfraProviders(key).reviewer, ledger);
    process.stdout.write(
      `control spec: G2 ${control.pass ? 'pass' : 'FAIL'}${control.issues.length ? `\n  - ${control.issues.join('\n  - ')}` : ''}\n`,
    );
    process.stdout.write(
      `planted false claim: G2 ${planted.pass ? 'pass (BAD: not caught)' : 'FAIL (caught)'}\n  - ${planted.issues.join('\n  - ')}\n`,
    );
    process.stdout.write(`cost $${ledger.spentUsd.toFixed(4)}\n`);
    return control.pass && !planted.pass ? 0 : 1;
  }

  const stages: Stage[] =
    command === 'all'
      ? ['generate', 'tts', 'images', 'layout', 'render', 'gate', 'report']
      : command === 'render'
        ? ['layout', 'render', 'gate', 'report']
        : command === 'gate'
          ? ['gate', 'report']
          : STAGES.includes(command as Stage)
            ? [command as Stage]
            : [];
  if (!stages.length) {
    process.stderr.write(`Unknown stage "${command}".\n\n${HELP}`);
    return 1;
  }

  const summary = await run({
    stages,
    dryRun: values['dry-run'],
    limit: values.limit === undefined ? undefined : Number(values.limit),
    only: values.only?.split(',').map((s) => s.trim()),
    budgetUsd,
    force: values.force,
    concurrency: values.concurrency === undefined ? undefined : Number(values.concurrency),
    renderConcurrency:
      values['render-concurrency'] === undefined ? undefined : Number(values['render-concurrency']),
  });

  const lines = [
    '',
    values['dry-run']
      ? `Dry run: $0 spent. Projected worst-case cost of this run for real: $${summary.estimatedUsd.toFixed(4)}`
      : `Spent this run: $${summary.spentUsd.toFixed(4)} (reserved worst case $${summary.estimatedUsd.toFixed(4)})`,
  ];
  if (summary.reportPath) lines.push(`Report: ${path.relative(process.cwd(), summary.reportPath)}`);
  if (summary.rendered.length) lines.push(`Rendered ${summary.rendered.length} reel(s).`);
  if (summary.layoutFailures.length)
    lines.push(
      `${summary.layoutFailures.length} reel(s) failed the layout pass or glyph audit (not rendered; manual review):`,
      ...summary.layoutFailures.map((f) => `  - ${f.reelId}: ${f.problems.join(' | ')}`),
    );
  const otherFailures = summary.failures.filter(
    (f) => !summary.layoutFailures.some((l) => f.startsWith(`${l.reelId} layout:`)),
  );
  if (otherFailures.length) {
    lines.push(
      `${otherFailures.length} reel stage(s) failed and were skipped:`,
      ...otherFailures.map((f) => `  - ${f}`),
    );
  }
  if (summary.stoppedByBudget) lines.push('Stopped at the budget cap.');
  process.stdout.write(`${lines.join('\n')}\n`);
  return summary.stoppedByBudget ? 2 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  },
);
