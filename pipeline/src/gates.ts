// Stage 2: review gates, cheapest first and fail-fast. G1 is deterministic;
// G2-G4 ask the reviewer typed questions. All checks run on text, before any
// media is made.
import { Angle, type ReelSpec, type Visual } from '@reels/schemas';
import { CODE_LIMITS, flowProblems, RENDER_TEMPLATES } from './catalogue';
import { typeCheckSnippet } from './codecheck';
import { WORDS_PER_SECOND } from './config';
import type { Job } from './content';
import { placeholderJob, placeholderSpec, promptVersion } from './provenance';
import {
  buildReviewerPrompt,
  REVIEWER_REPAIR,
  type Answer,
  type Question,
  type Reviewer,
} from './reviewer';
import { ANGLE_BRIEFS } from './writer';

export type GateId = 'G1' | 'G2' | 'G3' | 'G4';

export interface GateResult {
  gate: GateId;
  pass: boolean;
  /** Human-readable problems; also fed back to the writer on a rewrite. */
  issues: string[];
  /** Typed reviewer answers, shown in the report. */
  answers?: Record<string, Answer>;
}

const NARRATION_SYMBOLS = /[=^_\\θΘλπ∑√±×÷<>{}|~°*+/]/;
const LETTER_DIGIT = /\b[a-zA-Z][0-9]\b/;

export function spokenWords(spec: ReelSpec): number {
  const text = [spec.hook, ...spec.segments.map((s) => s.narration)].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

type CodeVisual = Extract<Visual, { kind: 'code' }>;

/** Size limits, plus a real type check for ts/tsx snippets. */
export function codeProblems(v: CodeVisual, where: string): string[] {
  const problems: string[] = [];
  const lines = v.code.split('\n');
  if (lines.length > CODE_LIMITS.maxLines) {
    problems.push(`${where} code has ${lines.length} lines; keep it to ${CODE_LIMITS.maxLines}`);
  }
  const long = lines.findIndex((l) => l.length > CODE_LIMITS.maxLineLength);
  if (long !== -1) {
    problems.push(
      `${where} code line ${long + 1} is ${lines[long]!.length} characters; keep lines to ${CODE_LIMITS.maxLineLength}`,
    );
  }
  if (v.highlight_lines.some((n) => n > lines.length))
    problems.push(`${where} highlights a line that does not exist`);
  const typed = v.language === 'ts' || v.language === 'tsx';
  if (!typed && v.check !== 'none')
    problems.push(`${where} only ts/tsx code can be type-checked; use check "none"`);
  if (typed && v.check === 'none')
    problems.push(`${where} ts/tsx code must use check "compiles" or "should_error"`);
  if (typed && v.check !== 'none') {
    const errors = typeCheckSnippet(v.code, v.language as 'ts' | 'tsx');
    if (v.check === 'compiles' && errors.length) {
      problems.push(`${where} code does not type-check: ${errors.slice(0, 3).join('; ')}`);
    }
    if (v.check === 'should_error' && errors.length === 0) {
      problems.push(`${where} code is marked should_error but type-checks cleanly`);
    }
  }
  return problems;
}

/** G1: schema-level lint that needs no model. */
export function gateG1(spec: ReelSpec, job: Job): GateResult {
  const issues: string[] = [];
  const estimatedS = spokenWords(spec) / WORDS_PER_SECOND;
  const target = spec.target_duration_s;
  if (estimatedS < target * 0.6 || estimatedS > Math.min(target * 1.4, 55)) {
    issues.push(
      `spoken length is about ${estimatedS.toFixed(0)} s (${spokenWords(spec)} words); aim for ${target} s, about ${Math.round(target * WORDS_PER_SECOND)} words`,
    );
  }
  [spec.hook, ...spec.segments.map((s) => s.narration)].forEach((text, i) => {
    const where = i === 0 ? 'hook' : `segment ${i} narration`;
    if (NARRATION_SYMBOLS.test(text))
      issues.push(`${where} contains symbols a TTS voice cannot read; spell them out`);
    if (LETTER_DIGIT.test(text))
      issues.push(`${where} contains a token like "n1"; write it as spoken words`);
  });
  if (!(spec.template in RENDER_TEMPLATES))
    issues.push(`unknown render template "${spec.template}"`);
  const focal = spec.segments.filter((s) => ['code', 'flow', 'equation'].includes(s.visual.kind));
  if (spec.template === 'visual-focus' && focal.length === 0) {
    issues.push('template "visual-focus" needs at least one code, flow or equation visual');
  }
  spec.segments.forEach((s, i) => {
    const where = `segment ${i + 1}`;
    const v = s.visual;
    if (v.kind === 'code') issues.push(...codeProblems(v, where));
    if (v.kind === 'flow')
      issues.push(...flowProblems(v.nodes, v.edges).map((p) => `${where}: ${p}`));
    if (
      v.kind === 'image' &&
      /\b(text|labels?|diagram|words?|letters?|caption|code|screens?|ui|interface)\b/i.test(
        v.prompt,
      )
    ) {
      issues.push(
        `${where} image prompt asks for text, code or a diagram; image models garble those`,
      );
    }
  });
  if (spec.segments.length < 2 || spec.segments.length > 5) issues.push('use 2 to 5 segments');
  if (spec.retrieval_items.length < 2) issues.push('write 2 retrieval items');
  const card = job.concept.card;
  if (spec.sources.length !== 1 || spec.sources[0]?.id !== card.id)
    issues.push(`sources must be exactly the card "${card.id}"`);
  return { gate: 'G1', pass: issues.length === 0, issues };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();

/** Claims must quote the card verbatim (whitespace, quote style and a trailing period aside). */
export function quoteProblems(spec: ReelSpec, cardText: string): string[] {
  const card = normalize(cardText);
  return spec.key_claims
    .filter((c) => !card.includes(normalize(c.quote)))
    .map((c) => `claim ${c.id} quote is not a verbatim span of the source card: "${c.quote}"`);
}

export function describeVisual(v: Visual): string {
  if (v.kind === 'code') {
    const intent =
      v.check === 'should_error' || v.shows_mistake ? ' (shown as a deliberate mistake)' : '';
    return `${v.language} code${intent}:\n${v.code}`;
  }
  if (v.kind === 'flow') {
    const label = new Map(v.nodes.map((n) => [n.id, n.label]));
    const edges = v.edges.map(
      (e) => `${label.get(e.from)} -> ${label.get(e.to)}${e.label ? ` (${e.label})` : ''}`,
    );
    return `flow diagram: ${edges.join('; ')}`;
  }
  if (v.kind === 'image') return `image: ${v.prompt}`;
  if (v.kind === 'equation') return `equation: ${v.latex}`;
  return 'animated text';
}

function script(spec: ReelSpec): string {
  const lines = [`HOOK (spoken): ${spec.hook}`];
  spec.segments.forEach((s, i) => {
    lines.push(`SEGMENT ${i + 1} narration: ${s.narration}`);
    lines.push(`SEGMENT ${i + 1} on-screen text: ${s.on_screen_text}`);
    lines.push(`SEGMENT ${i + 1} visual: ${describeVisual(s.visual)}`);
  });
  return lines.join('\n');
}

const LETTERS = ['A', 'B', 'C', 'D'];

function questionsText(spec: ReelSpec): string {
  return spec.retrieval_items
    .map(
      (item, i) =>
        `Q${i + 1}: ${item.prompt}\n${item.choices.map((c, j) => `  ${LETTERS[j]}) ${c}`).join('\n')}`,
    )
    .join('\n');
}

/** G2: every claim is backed by the card, every answer key is right, and the script adds nothing unsupported. */
export async function gateG2(spec: ReelSpec, job: Job, reviewer: Reviewer): Promise<GateResult> {
  const quotes = quoteProblems(spec, job.concept.card.text);
  if (quotes.length) return { gate: 'G2', pass: false, issues: quotes };

  const questions: Record<string, Question> = {};
  for (const claim of spec.key_claims) {
    questions[`claim_${claim.id}`] = {
      type: 'choice',
      instructions: `Using only the SOURCE CARD, judge this claim: "${claim.text}"`,
      options: {
        supported: 'the source card states or directly implies it',
        unsupported: 'the source card does not establish it',
        contradicted: 'the source card contradicts it',
      },
    };
  }
  spec.retrieval_items.forEach((item, i) => {
    questions[`item_${i + 1}`] = {
      type: 'choice',
      instructions: `Using the SOURCE CARD, which choice correctly answers Q${i + 1}?`,
      options: {
        ...Object.fromEntries(item.choices.map((c, j) => [LETTERS[j]!, c])),
        none: 'no choice is correct, or more than one is',
      },
    };
  });
  questions.script_unsupported = {
    type: 'noul',
    instructions:
      'Does the script (hook, narration or on-screen text) state any fact or number that the SOURCE CARD does not support, or that contradicts it? Code and diagrams used as illustrations do not need to appear in the card.',
  };
  spec.segments.forEach((s, i) => {
    if (s.visual.kind !== 'code') return;
    questions[`code_${i + 1}`] = {
      type: 'choice',
      instructions: `Does the code in SEGMENT ${i + 1} actually do what its narration and on-screen text say?${s.visual.check === 'should_error' || s.visual.shows_mistake ? ' It is meant to show a mistake: answer "correct" if it really demonstrates the mistake described and the narration makes clear it is a mistake.' : ''}`,
      options: {
        correct: 'yes, the code matches what is said about it',
        incorrect: 'no, the code contradicts or does not show what is said',
        unclear: 'cannot tell',
      },
    };
    // Snippets shown as deliberate mistakes are supposed to be wrong.
    if (s.visual.check !== 'should_error' && !s.visual.shows_mistake) {
      questions[`bug_${i + 1}`] = {
        type: 'noul',
        instructions: `Does the code in SEGMENT ${i + 1} contain a bug or a bad practice an experienced reviewer would flag in code meant to teach good habits? Examples: treating valid falsy values such as 0 or an empty string as missing, ignoring errors where they matter, unsafe type assertions, mutating props or state.`,
      };
    }
  });

  const state = `SOURCE CARD:\n${job.concept.card.text}\n\nSCRIPT:\n${script(spec)}\n\nRETRIEVAL QUESTIONS:\n${questionsText(spec)}`;
  const answers = await reviewer.ask(spec.reel_id, 'G2', state, questions);

  const issues: string[] = [];
  for (const claim of spec.key_claims) {
    const a = answers[`claim_${claim.id}`];
    if (a?.type === 'choice' && a.choice !== 'supported')
      issues.push(`claim ${claim.id} is ${a.choice} by the source card: ${a.evidence}`);
  }
  spec.retrieval_items.forEach((item, i) => {
    const a = answers[`item_${i + 1}`];
    const expected = LETTERS[item.answer_index];
    if (a?.type === 'choice' && a.choice !== expected) {
      issues.push(
        `Q${i + 1}: the answer key says ${expected} but the reviewer picked ${a.choice}: ${a.evidence}`,
      );
    }
  });
  for (const [key, a] of Object.entries(answers)) {
    if (key.startsWith('code_') && a.type === 'choice' && a.choice === 'incorrect') {
      issues.push(`segment ${key.slice(5)} code does not match its narration: ${a.evidence}`);
    }
    if (key.startsWith('bug_') && a.type === 'noul' && a.probability >= 0.5) {
      issues.push(`segment ${key.slice(4)} code has a bug or bad practice: ${a.evidence}`);
    }
  }
  const extra = answers.script_unsupported;
  if (extra?.type === 'noul' && extra.probability >= 0.5)
    issues.push(`script states something the card does not support: ${extra.evidence}`);
  return { gate: 'G2', pass: issues.length === 0, issues, answers };
}

const LEVELS = ['very poor', 'poor', 'acceptable', 'good', 'excellent'];

/** G3: pedagogy rubric. Every item must be at least "acceptable" and the mean at least 3.5. */
export async function gateG3(spec: ReelSpec, job: Job, reviewer: Reviewer): Promise<GateResult> {
  const rubric: Record<string, string> = {
    hook: 'Does the hook create curiosity for a general audience in under 15 words?',
    one_idea: 'Does the reel stay on exactly one idea without drifting?',
    concrete:
      'Does it ground the idea in something concrete (an everyday scene, a number, a visual)?',
    angle_fit: `Does it deliver its "${spec.angle}" angle: ${ANGLE_BRIEFS[spec.angle]}`,
    questions_test_idea:
      "Do the retrieval questions test understanding of the reel's idea rather than trivia or wording recall?",
    distractors: 'Are the wrong choices plausible mistakes a learner might actually make?',
    spoken_clarity: 'Is the narration clear and natural when read aloud by a text-to-speech voice?',
  };
  const questions = Object.fromEntries(
    Object.entries(rubric).map(([k, instructions]) => [
      k,
      { type: 'score', instructions, levels: LEVELS } as Question,
    ]),
  );
  const state = `CONCEPT: ${job.concept.node.title}\n\nSCRIPT:\n${script(spec)}\n\nRETRIEVAL QUESTIONS:\n${questionsText(spec)}`;
  const answers = await reviewer.ask(spec.reel_id, 'G3', state, questions);
  const levels = Object.entries(answers).map(
    ([k, a]) => [k, a.type === 'score' ? a.level : 0] as const,
  );
  const issues = levels
    .filter(([, l]) => l < 3)
    .map(([k, l]) => `rubric "${k}" scored ${l}/5: ${answers[k]!.evidence}`);
  const mean = levels.reduce((sum, [, l]) => sum + l, 0) / levels.length;
  if (mean < 3.5) issues.push(`rubric mean ${mean.toFixed(2)} is below 3.5`);
  return { gate: 'G3', pass: issues.length === 0, issues, answers };
}

/** G4: safety. Fails when the reviewer thinks any flag is more likely than not. */
export async function gateG4(spec: ReelSpec, _job: Job, reviewer: Reviewer): Promise<GateResult> {
  const questions: Record<string, Question> = {
    insecure_practice: {
      type: 'noul',
      instructions:
        'Does the reel recommend or show an insecure practice without clearly calling it a mistake (for example hard-coding or committing secrets, running eval on untrusted or model-generated input, building SQL from user input, disabling TLS checks, trusting model output to take destructive actions)?',
    },
    inappropriate: {
      type: 'noul',
      instructions:
        'Does the reel contain offensive, hateful, sexual or otherwise inappropriate content for a general audience that includes teenagers?',
    },
    image_risk: {
      type: 'noul',
      instructions:
        'Could any image prompt produce inappropriate, frightening or misleading imagery, or depict a real company, product or person?',
    },
  };
  const answers = await reviewer.ask(spec.reel_id, 'G4', `SCRIPT:\n${script(spec)}`, questions);
  const issues = Object.entries(answers)
    .filter(([, a]) => a.type === 'noul' && a.probability >= 0.5)
    .map(([k, a]) => `safety flag "${k}" (p=${a.probability.toFixed(2)}): ${a.evidence}`);
  return { gate: 'G4', pass: issues.length === 0, issues, answers };
}

export type ReviewGateId = Exclude<GateId, 'G1'>;
export const REVIEW_GATES = { G2: gateG2, G3: gateG3, G4: gateG4 } as const;

/** Records what a gate asks instead of asking it, and answers favourably so the gate runs to the end. */
export class CaptureReviewer implements Reviewer {
  readonly provider = 'capture';
  readonly model = 'capture';
  readonly prompts: string[] = [];

  async ask(_reelId: string, _gate: string, state: string, questions: Record<string, Question>) {
    const prompt = buildReviewerPrompt(state, questions);
    this.prompts.push(`${prompt.system}\n${prompt.user}`);
    return Object.fromEntries(
      Object.entries(questions).map(([key, q]): [string, Answer] => [
        key,
        q.type === 'choice'
          ? { type: 'choice', choice: Object.keys(q.options)[0]!, probability: 1, evidence: '' }
          : q.type === 'score'
            ? { type: 'score', level: q.levels.length, probability: 1, evidence: '' }
            : { type: 'noul', probability: 0, evidence: '' },
      ]),
    );
  }
}

/**
 * Prompt version per review gate: a hash of everything the gate would send for
 * a placeholder spec at each angle, plus the reviewer's repair messages.
 */
export async function gatePromptVersions(): Promise<Record<ReviewGateId, string>> {
  const versions = {} as Record<ReviewGateId, string>;
  for (const id of Object.keys(REVIEW_GATES) as ReviewGateId[]) {
    const capture = new CaptureReviewer();
    for (const angle of Angle.options) {
      await REVIEW_GATES[id](placeholderSpec(angle), placeholderJob(angle), capture);
    }
    versions[id] = promptVersion([
      ...capture.prompts,
      REVIEWER_REPAIR.invalidJson,
      REVIEWER_REPAIR.problems(['<problem>']),
    ]);
  }
  return versions;
}

/** Runs G1-G4 in order and stops at the first failure. */
export async function runGates(
  spec: ReelSpec,
  job: Job,
  reviewer: Reviewer,
): Promise<GateResult[]> {
  const results = [gateG1(spec, job)];
  if (!results[0]!.pass) return results;
  for (const gate of [gateG2, gateG3, gateG4]) {
    const result = await gate(spec, job, reviewer);
    results.push(result);
    if (!result.pass) break;
  }
  return results;
}
