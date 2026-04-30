// Stage 6b: a single static HTML page to spot-check every reel: the video,
// the script, each gate's verdict with the reviewer's evidence, the layout
// pass and encode gate results, and its cost. Only reels rendered with the
// current templates that passed the encode gate can be approved.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './config';
import type { Job } from './content';
import { currentDecision, readDecisions, type Decision, type Decisions } from './decisions';
import { describeVisual, type GateResult } from './gates';
import type { LedgerEntry } from './ledger';
import type { Answer } from './reviewer';
import {
  gatePassed,
  isCurrentRender,
  readRecord,
  type GateRecord,
  type LayoutRecord,
  type RenderRecord,
  type TextRecord,
} from './store';

const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const usd = (n: number) => `$${n.toFixed(4)}`;

// Runs in the browser. Saves decisions through the review server
// (npm run pipeline -- serve); opened as a plain file, it keeps them in
// localStorage and offers an export instead.
const REVIEW_SCRIPT = `
const sections = [...document.querySelectorAll('section[data-state]')];
const rows = [...document.querySelectorAll('tr[data-state]')];
let filter = 'all';
let serverOk = location.protocol.startsWith('http');
const local = () => { try { return JSON.parse(localStorage.getItem('reel-decisions') || '{}'); } catch { return {}; } };
function setState(reel, state) {
  for (const el of [document.getElementById(reel), document.querySelector('tr[data-row="' + reel + '"]')]) {
    if (!el) continue;
    el.dataset.state = state;
  }
  const cell = document.querySelector('tr[data-row="' + reel + '"] .dec');
  if (cell) { cell.className = 'dec ' + state; cell.textContent = state; }
  const box = document.querySelector('.review[data-reel="' + reel + '"]');
  if (box) for (const b of box.querySelectorAll('button')) b.classList.toggle('on', b.dataset.d === state);
  refresh();
}
function refresh() {
  const count = (s) => sections.filter((x) => s === 'all' || x.dataset.state === s).length;
  for (const b of document.querySelectorAll('#filters button[data-f]')) {
    b.classList.toggle('on', b.dataset.f === filter);
    b.querySelector('span').textContent = count(b.dataset.f);
  }
  for (const el of [...sections, ...rows]) el.hidden = filter !== 'all' && el.dataset.state !== filter;
}
async function save(reel, sha, decision, note) {
  const body = { reel_id: reel, sha256: sha, decision, note };
  if (serverOk) {
    try {
      const res = await fetch('/api/decisions', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      document.getElementById('saveinfo').textContent = 'Saved to library/decisions.json.';
      return;
    } catch { serverOk = false; }
  }
  const all = local();
  if (decision) all[reel] = { decision, sha256: sha, note, at: new Date().toISOString() }; else delete all[reel];
  try { localStorage.setItem('reel-decisions', JSON.stringify(all)); } catch {}
  document.getElementById('export').hidden = false;
  document.getElementById('saveinfo').textContent = 'Not connected to the review server: decisions are kept in this browser. Use Export decisions.';
}
document.addEventListener('click', (e) => {
  const f = e.target.closest('#filters button[data-f]');
  if (f) { filter = f.dataset.f; refresh(); return; }
  const b = e.target.closest('.review button');
  if (!b) return;
  const box = b.closest('.review');
  const reel = box.dataset.reel;
  const next = b.classList.contains('on') ? null : b.dataset.d;
  setState(reel, next || 'pending');
  save(reel, box.dataset.sha, next, box.querySelector('.note').value);
});
document.addEventListener('change', (e) => {
  if (!e.target.classList.contains('note')) return;
  const box = e.target.closest('.review');
  const on = box.querySelector('button.on');
  if (on) save(box.dataset.reel, box.dataset.sha, on.dataset.d, e.target.value);
});
document.getElementById('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(local(), null, 2)], { type: 'application/json' }));
  a.download = 'decisions.json';
  a.click();
});
if (!serverOk) {
  for (const [reel, d] of Object.entries(local())) {
    const box = document.querySelector('.review[data-reel="' + reel + '"]');
    if (box && box.dataset.sha === d.sha256) { box.querySelector('.note').value = d.note || ''; setState(reel, d.decision); }
  }
  document.getElementById('export').hidden = false;
}
refresh();
`;

export function readLedger(): LedgerEntry[] {
  if (!fs.existsSync(PATHS.ledger)) return [];
  return fs
    .readFileSync(PATHS.ledger, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LedgerEntry);
}

function answerCell(a: Answer): string {
  if (a.type === 'choice')
    return `<b>${esc(a.choice)}</b> <span class="p">p=${a.probability.toFixed(2)}</span>`;
  if (a.type === 'score')
    return `<b>${a.level}/5</b> <span class="p">p=${a.probability.toFixed(2)}</span>`;
  return `<b>${a.probability >= 0.5 ? 'yes' : 'no'}</b> <span class="p">p(yes)=${a.probability.toFixed(2)}</span>`;
}

function gateBlock(g: GateResult): string {
  const rows = g.answers
    ? Object.entries(g.answers)
        .map(
          ([k, a]) =>
            `<tr><td>${esc(k)}</td><td>${answerCell(a)}</td><td class="ev">${esc(a.evidence)}</td></tr>`,
        )
        .join('')
    : '';
  return `<div class="gate ${g.pass ? 'ok' : 'bad'}">
    <div class="gh">${g.gate} ${g.pass ? 'pass' : 'FAIL'}</div>
    ${g.issues.length ? `<ul class="issues">${g.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${rows ? `<table class="ans">${rows}</table>` : ''}
  </div>`;
}

function reviewControls(
  reelId: string,
  render: RenderRecord | null,
  decision: Decision | null,
): string {
  if (!render) return '';
  return `<div class="review" data-reel="${esc(reelId)}" data-sha="${esc(render.sha256)}">
    <button class="approve${decision?.decision === 'approved' ? ' on' : ''}" data-d="approved">✓ Approve</button>
    <button class="reject${decision?.decision === 'rejected' ? ' on' : ''}" data-d="rejected">✗ Reject</button>
    <input class="note" placeholder="Note (optional, saved with your decision)" value="${esc(decision?.note ?? '')}">
  </div>`;
}

/** pending | approved | rejected | failed: drives the filter buttons. */
function reviewState(
  text: TextRecord | null,
  render: RenderRecord | null,
  gate: GateRecord | null,
  decision: Decision | null,
): string {
  if (!text || text.status !== 'passed' || !gatePassed(render, gate)) return 'failed';
  return decision?.decision ?? 'pending';
}

/** Probe, layout and gate details under the video. */
function renderMeta(
  render: RenderRecord,
  gate: GateRecord | null,
  layout: LayoutRecord | null,
): string {
  const p = render.probe;
  const lines: string[] = [];
  if (p?.video)
    lines.push(
      `${p.video.width}x${p.video.height} · ${p.video.fps} fps · ${p.video.profile} L${p.video.level / 10} · ${p.kbps} kb/s`,
    );
  // Silent audio (a dry run's fake TTS) measures as -inf, which reaches this JSON as null.
  const level = (v: number | null, digits: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'n/a';
  if (p?.loudness)
    lines.push(
      `${level(p.loudness.integrated_lufs, 1)} LUFS · ${level(p.loudness.true_peak_dbtp, 2)} dBTP · lead-in ${render.lead_in_ms} ms`,
    );
  const sizes = render.layout?.segments
    .map(
      (s, i) =>
        `${i + 1}: ${s.visual}${s.code_px ? ` ${s.code_px} px${s.code_status && s.code_status !== 'fits' ? ` (${s.code_status})` : ''}` : ''}`,
    )
    .join(' · ');
  if (render.layout) lines.push(`hook ${render.layout.hook_px} px · ${sizes}`);
  const exceptions = layout?.snippets.filter((s) => s.status === 'exception') ?? [];
  for (const s of exceptions)
    lines.push(`segment ${s.segment + 1} code kept at ${s.size} px: ${esc(s.reason ?? '')}`);
  if (!gate || gate.sha256 !== render.sha256)
    lines.push('<span class="bad">encode gate not run</span>');
  else if (gate.pass) lines.push('<span class="ok">encode gate pass</span>');
  else
    lines.push(
      `<span class="bad">encode gate FAIL</span><ul class="issues">${gate.checks
        .filter((c) => !c.pass)
        .map((c) => `<li>${esc(c.id)}: ${esc(c.detail)}</li>`)
        .join('')}</ul>`,
    );
  return lines.map((l) => (l.startsWith('<') ? l : esc(l))).join('<br>');
}

function reelSection(job: Job, ledger: LedgerEntry[], decisions: Decisions): string {
  const text = readRecord<TextRecord>(job.reelId, 'text');
  const stored = readRecord<RenderRecord>(job.reelId, 'render');
  const render = isCurrentRender(stored) ? stored : null;
  const gate = readRecord<GateRecord>(job.reelId, 'gate');
  const layout = readRecord<LayoutRecord>(job.reelId, 'layout');
  const decision = currentDecision(decisions, job.reelId, render?.sha256);
  const entries = ledger.filter((e) => e.reel_id === job.reelId);
  const byStage = new Map<string, number>();
  for (const e of entries) byStage.set(e.stage, (byStage.get(e.stage) ?? 0) + e.cost_usd);
  const total = entries.reduce((s, e) => s + e.cost_usd, 0);
  const spec = text?.spec;
  const layoutProblems =
    layout && !layout.pass
      ? `<div class="gate bad"><div class="gh">Layout pass FAIL (not rendered)</div><ul class="issues">${layout.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
      : '';
  const video = render
    ? `<video controls preload="metadata" src="${esc(render.file)}"></video><div class="meta">${render.duration_s.toFixed(1)} s · ${(render.bytes / 1e6).toFixed(2)} MB<br>${renderMeta(render, gate, layout)}</div>`
    : `<div class="novideo">${stored ? 'old render: not yet re-rendered with the current templates' : 'not rendered'}</div>`;
  const script = spec
    ? `<p class="hook">“${esc(spec.hook)}”</p>
      <table class="script"><tr><th>#</th><th>Narration</th><th>On screen</th><th>Visual</th></tr>
      ${spec.segments
        .map((s, i) => {
          const visual = describeVisual(s.visual);
          return `<tr><td>${i + 1}</td><td>${esc(s.narration)}</td><td>${esc(s.on_screen_text)}</td><td class="ev"><pre class="vis">${esc(visual)}</pre></td></tr>`;
        })
        .join('')}</table>
      <h4>Key claims</h4><ul>${spec.key_claims.map((c) => `<li><b>${esc(c.id)}</b> ${esc(c.text)}<div class="ev">quote: “${esc(c.quote)}”</div></li>`).join('')}</ul>
      <h4>Retrieval items</h4>${spec.retrieval_items
        .map(
          (q) =>
            `<div class="q"><b>${esc(q.prompt)}</b><ol type="A">${q.choices.map((c, i) => `<li class="${i === q.answer_index ? 'right' : ''}">${esc(c)}</li>`).join('')}</ol><div class="ev">${esc(q.explanation)}</div></div>`,
        )
        .join('')}`
    : `<p>No valid spec. ${esc(text?.problems.join('; ') ?? 'not generated')}</p>`;
  const drafts = text?.earlier_drafts.length
    ? `<details><summary>${text.earlier_drafts.length} earlier draft(s) rejected</summary>${text.earlier_drafts.map((d) => d.gates.map(gateBlock).join('')).join('<hr>')}</details>`
    : '';
  const costs = [...byStage].map(([s, c]) => `${esc(s)} ${usd(c)}`).join(' · ');
  return `<section id="${esc(job.reelId)}" data-state="${reviewState(text, render, gate, decision)}">
    <h2>${esc(job.reelId)} <span class="status ${esc(text?.status ?? 'none')}">${esc(text?.status ?? 'not generated')}</span></h2>
    <div class="topic">${esc(job.concept.topic.title)} · ${esc(job.concept.node.title)} · ${esc(job.angle)}</div>
    <div class="cols"><div class="left">${video}${layoutProblems}${gatePassed(render, gate) ? reviewControls(job.reelId, render, decision) : ''}<div class="meta">cost ${usd(total)}<br>${costs}</div></div>
    <div class="right">${script}<h4>Gates</h4>${text?.gates.map(gateBlock).join('') ?? ''}${drafts}</div></div>
  </section>`;
}

const ANGLE_ORDER = ['intro', 'example', 'pitfall'];

export function writeReport(unordered: Job[], runLabel: string): string {
  const ledger = readLedger();
  const decisions = readDecisions();
  // Group by subject, then concept, then angle.
  const topicOrder = [...new Set(unordered.map((j) => j.concept.topic.id))];
  const conceptOrder = [...new Set(unordered.map((j) => j.concept.node.id))];
  const jobs = [...unordered].sort(
    (a, b) =>
      topicOrder.indexOf(a.concept.topic.id) - topicOrder.indexOf(b.concept.topic.id) ||
      conceptOrder.indexOf(a.concept.node.id) - conceptOrder.indexOf(b.concept.node.id) ||
      ANGLE_ORDER.indexOf(a.angle) - ANGLE_ORDER.indexOf(b.angle),
  );
  let lastTopic = '';
  const rows = jobs
    .map((job) => {
      const text = readRecord<TextRecord>(job.reelId, 'text');
      const stored = readRecord<RenderRecord>(job.reelId, 'render');
      const render = isCurrentRender(stored) ? stored : null;
      const gate = readRecord<GateRecord>(job.reelId, 'gate');
      const decision = currentDecision(decisions, job.reelId, render?.sha256);
      const state = reviewState(text, render, gate, decision);
      const heading =
        job.concept.topic.id !== lastTopic
          ? `<tr class="th"><td colspan="6">${esc(job.concept.topic.title)}</td></tr>`
          : '';
      lastTopic = job.concept.topic.id;
      const gates =
        text?.gates
          .map((g) => `<span class="${g.pass ? 'ok' : 'bad'}">${g.gate}</span>`)
          .join(' ') ?? '';
      const cost = ledger
        .filter((e) => e.reel_id === job.reelId)
        .reduce((s, e) => s + e.cost_usd, 0);
      return `${heading}<tr data-state="${state}" data-row="${esc(job.reelId)}"><td><a href="#${esc(job.reelId)}">${esc(job.reelId)}</a></td><td class="status ${esc(text?.status ?? 'none')}">${esc(text?.status ?? '-')}</td><td>${gates}</td><td>${render ? `${render.duration_s.toFixed(1)} s` : '-'}</td><td>${usd(cost)}</td><td class="dec ${state}">${state}</td></tr>`;
    })
    .join('');
  const spent = ledger.reduce((s, e) => s + e.cost_usd, 0);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reel review</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1a1f2b;--muted:#5b6475;--ok:#0f7b4f;--bad:#b42318;--line:#e3e6ec;--link:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#0f131a;--card:#171c26;--text:#e8ecf3;--muted:#98a2b3;--ok:#4ade80;--bad:#f87171;--line:#2a3140;--link:#7dd3fc}}
a{color:var(--link)}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px}.sub{color:var(--muted);margin-bottom:20px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:20px 0}
.cols{display:flex;gap:20px;flex-wrap:wrap}.left{flex:0 0 280px}.right{flex:1;min-width:300px}
video{width:270px;aspect-ratio:9/16;background:#000;border-radius:10px}
.meta,.ev,.p{color:var(--muted);font-size:13px}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}
.status.passed{color:var(--ok)}.status.rejected,.status.invalid{color:var(--bad)}
.gate{border-left:4px solid var(--line);padding:4px 10px;margin:8px 0}.gate.ok{border-color:var(--ok)}.gate.bad{border-color:var(--bad)}
.gh{font-weight:700}.issues{margin:4px 0;color:var(--bad)}.ans td{font-size:13px}
.hook{font-size:18px;font-weight:600}.right li.right{color:var(--ok);font-weight:600}.q{margin:8px 0}
.vis{white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,monospace;margin:0}
.topic{color:var(--muted);margin:-6px 0 10px}
.howto{margin:-8px 0 14px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:8px 14px;cursor:pointer}
.filters button.on{border-color:var(--link);color:var(--link);font-weight:600}
.review{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;width:270px}
.review button{flex:1;padding:12px 0;font-weight:600}
.review .approve.on{background:var(--ok);border-color:var(--ok);color:#fff}
.review .reject.on{background:var(--bad);border-color:var(--bad);color:#fff}
.note{width:100%;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.dec.approved{color:var(--ok);font-weight:600}.dec.rejected{color:var(--bad);font-weight:600}.dec.pending{color:var(--link)}.dec.failed{color:var(--muted)}
tr.th td{font-weight:700;padding-top:14px}
[hidden]{display:none!important}
@media (max-width:640px){.left{flex:1 1 100%}video,.review,.novideo{width:100%}.summary td:nth-child(3),.summary th:nth-child(3),.summary td:nth-child(5),.summary th:nth-child(5){display:none}}
.novideo{width:270px;aspect-ratio:9/16;display:grid;place-items:center;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
</style></head><body><main>
<h1>Reel review</h1>
<div class="sub">${esc(runLabel)} · generated ${esc(new Date().toISOString())} · total spent ${usd(spent)} over ${ledger.length} paid calls</div>
<div class="howto">Watch each reel, then tap <b>Approve</b> or <b>Reject</b>. Only approved reels reach the app. <span id="saveinfo"></span></div>
<div class="filters" id="filters">
  <button data-f="all" class="on">All <span></span></button>
  <button data-f="pending">To review <span></span></button>
  <button data-f="approved">Approved <span></span></button>
  <button data-f="rejected">Rejected <span></span></button>
  <button data-f="failed">Failed checks <span></span></button>
  <button id="export" hidden>Export decisions</button>
</div>
<table class="summary"><tr><th>Reel</th><th>Status</th><th>Gates</th><th>Duration</th><th>Cost</th><th>Review</th></tr>${rows}</table>
${jobs.map((j) => reelSection(j, ledger, decisions)).join('')}
</main>
<script>
${REVIEW_SCRIPT}
</script></body></html>`;
  fs.mkdirSync(path.dirname(PATHS.report), { recursive: true });
  fs.writeFileSync(PATHS.report, html);
  return PATHS.report;
}
