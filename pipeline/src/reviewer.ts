// Gates ask the reviewer typed questions instead of free text, so any backend
// that answers typed questions can stand in: the DeepSeek backend below (JSON
// mode) or, in M2, TypeSafe Jev (native typed answers with probabilities).
import * as z from 'zod';
import { MODELS } from './config';
import { extractJson, formatIssues } from './json';
import type { CostLedger } from './ledger';
import { requestHash } from './provenance';
import type { LLM } from './providers/types';

export type Question =
  | { type: 'choice'; instructions: string; options: Record<string, string> }
  | { type: 'score'; instructions: string; levels: string[] }
  | { type: 'noul'; instructions: string };

/** probability: the reviewer's confidence in its answer (choice/score) or that the statement is true (noul). */
export type Answer =
  | { type: 'choice'; choice: string; probability: number; evidence: string }
  | { type: 'score'; level: number; probability: number; evidence: string }
  | { type: 'noul'; probability: number; evidence: string };

export interface Reviewer {
  readonly provider: string;
  readonly model: string;
  ask(
    reelId: string,
    gate: string,
    state: string,
    questions: Record<string, Question>,
  ): Promise<Record<string, Answer>>;
}

const SYSTEM = `You are a strict reviewer of short software engineering lesson scripts. Judge only from the material given.
Answer every question. Reply with one JSON object: {"answers": {"<question key>": {"answer": ..., "confidence": <0..1>, "evidence": "<short quote or reason, max 30 words>"}}}.
- choice questions: "answer" is exactly one of the option keys.
- score questions: "answer" is the level number (1 = lowest).
- yes/no questions: "answer" is true or false.
"confidence" is your probability that your answer is correct.`;

function describe(key: string, q: Question): string {
  if (q.type === 'choice') {
    const options = Object.entries(q.options)
      .map(([k, d]) => `    "${k}": ${d}`)
      .join('\n');
    return `- "${key}" (choice): ${q.instructions}\n  options:\n${options}`;
  }
  if (q.type === 'score') {
    const levels = q.levels.map((l, i) => `    ${i + 1}: ${l}`).join('\n');
    return `- "${key}" (score 1-${q.levels.length}): ${q.instructions}\n  levels:\n${levels}`;
  }
  return `- "${key}" (yes/no): ${q.instructions}`;
}

function answerSchema(q: Question) {
  const answer =
    q.type === 'choice'
      ? z.enum(Object.keys(q.options) as [string, ...string[]])
      : q.type === 'score'
        ? z.coerce.number().int().min(1).max(q.levels.length)
        : z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
  return z.object({
    answer,
    // Missing or unreadable: undefined, and the answer is taken at face value (see ask).
    confidence: z.coerce.number().min(0).max(1).optional().catch(undefined),
    evidence: z.string().catch(''),
  });
}

/** The exact prompt the reviewer is sent on its first call for this material and these questions. */
export function buildReviewerPrompt(
  state: string,
  questions: Record<string, Question>,
): { system: string; user: string } {
  const user = `MATERIAL:\n${state}\n\nQUESTIONS:\n${Object.entries(questions)
    .map(([k, q]) => describe(k, q))
    .join('\n')}`;
  return { system: SYSTEM, user };
}

/** Appended to the first prompt when a reply has to be asked for again. */
export const REVIEWER_REPAIR = {
  invalidJson: '\n\nYour previous reply was not valid JSON. Reply with the JSON object only.',
  problems: (problems: string[]) =>
    `\n\nYour previous reply had these problems; answer again:\n- ${problems.join('\n- ')}`,
};

export class LLMReviewer implements Reviewer {
  constructor(
    private readonly llm: LLM,
    private readonly ledger: CostLedger,
    /** Gate id -> prompt version, recorded on each ledger entry (see gatePromptVersions). */
    private readonly promptVersions: Partial<Record<string, string>> = {},
  ) {}

  get provider() {
    return this.llm.provider;
  }
  get model() {
    return this.llm.model;
  }

  async ask(reelId: string, gate: string, state: string, questions: Record<string, Question>) {
    const schema = z.object({
      answers: z.object(
        Object.fromEntries(Object.entries(questions).map(([k, q]) => [k, answerSchema(q)])),
      ),
    });
    const base = buildReviewerPrompt(state, questions).user;
    let user = base;
    let problems: string[] = [];
    for (let call = 1; call <= 2; call++) {
      const req = {
        system: SYSTEM,
        user,
        maxTokens: MODELS.reviewer.maxTokens,
        json: true,
        temperature: 0,
      };
      const reply = await this.ledger.charge(
        {
          reelId,
          stage: `review:${gate}`,
          provider: this.llm.provider,
          model: this.llm.model,
          promptVersion: this.promptVersions[gate],
          requestSha256: requestHash(this.llm.model, req),
        },
        this.llm.estimateUsd(req),
        () => this.llm.complete(req),
      );
      let parsed;
      try {
        parsed = schema.safeParse(extractJson(reply.text));
      } catch (error) {
        problems = [(error as Error).message];
        user = base + REVIEWER_REPAIR.invalidJson;
        continue;
      }
      if (!parsed.success) {
        problems = formatIssues(parsed.error.issues);
        user = base + REVIEWER_REPAIR.problems(problems);
        continue;
      }
      const out: Record<string, Answer> = {};
      for (const [key, q] of Object.entries(questions)) {
        const a = parsed.data.answers[key] as {
          answer: string | number | boolean;
          confidence?: number;
          evidence: string;
        };
        // A default of 0.5 would sit on the yes/no flag threshold and turn a bare "no" into a flag.
        const confidence = a.confidence ?? 1;
        if (q.type === 'choice')
          out[key] = {
            type: 'choice',
            choice: String(a.answer),
            probability: confidence,
            evidence: a.evidence,
          };
        else if (q.type === 'score')
          out[key] = {
            type: 'score',
            level: Number(a.answer),
            probability: confidence,
            evidence: a.evidence,
          };
        else
          out[key] = {
            type: 'noul',
            probability: a.answer === true ? confidence : 1 - confidence,
            evidence: a.evidence,
          };
      }
      return out;
    }
    throw new Error(
      `Reviewer gave no usable answer for ${gate} on ${reelId}: ${problems.join('; ')}`,
    );
  }
}
