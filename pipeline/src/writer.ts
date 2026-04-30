// Stage 1: the writer LLM drafts a reel spec from the concept's source card.
import * as z from 'zod';
import { Angle, ReelSpec, SCHEMA_VERSION } from '@reels/schemas';
import { catalogueForPrompt } from './catalogue';
import { MODELS, WORDS_PER_SECOND } from './config';
import type { Job } from './content';
import { extractJson, formatIssues } from './json';
import type { CostLedger } from './ledger';
import { placeholderJob, promptVersion, requestHash } from './provenance';
import type { LLM } from './providers/types';

export const TARGET_DURATION_S = 30;

export const ANGLE_BRIEFS = {
  intro:
    'First encounter with the concept. Open with a relatable developer moment or puzzle, then give the core idea plainly.',
  example:
    'A concrete worked example: a short realistic code snippet, a flow, or a scenario from building a real app.',
  pitfall:
    'A common mistake or misconception, why it bites, and what to do instead. Showing the broken code is encouraged.',
} as const;

const reelSpecJsonSchema = JSON.stringify(z.toJSONSchema(ReelSpec, { io: 'input' }));

const SYSTEM = `You write scripts for 20-40 second vertical lesson videos ("reels") that teach working software developers (junior to mid level) one idea.
Return exactly one JSON object that matches the JSON Schema provided. No prose before or after it.

Hard rules:
- Every fact you state must come from the SOURCE CARD. Do not add facts, version numbers, product claims or history that are not in it. Code and diagrams may illustrate a card fact.
- Each key_claims entry: "text" is the claim in your words; "quote" is copied VERBATIM from one numbered fact of the source card (an exact substring, without the leading number); "source_id" is the source card id.
- "narration" is read aloud by a text-to-speech voice: plain spoken English with no code, symbols or punctuation-heavy syntax. Say identifiers the way a developer would say them out loud ("use state", "flex direction", "J S X"); never read code character by character. Digits are fine.
- "on_screen_text" is at most 60 characters and may use real identifiers and symbols.
- The hook is spoken first and must make a developer want to keep watching. Keep it under 15 words.
- One idea per reel. 2 to 5 segments.
- Prefer a "code" visual whenever code makes the idea concrete, and a "flow" visual for request paths, pipelines and architecture. Keep code minimal and realistic; it must type-check as described in the catalogue.
- retrieval_items: 2 multiple-choice questions that test understanding of this reel's idea, answerable from the narration. 3 or 4 short choices, exactly one correct, distractors plausible (mistakes developers actually make). claim_ids lists the key claims each question tests.`;

export function buildWriterPrompt(job: Job): { system: string; user: string } {
  const { concept, angle } = job;
  const words = Math.round(TARGET_DURATION_S * WORDS_PER_SECOND);
  const user = `Write the "${angle}" reel for this concept.

CONCEPT: ${concept.node.title} (id "${concept.node.id}") — ${concept.node.summary}
TOPIC: ${concept.topic.title}
ASSUMED PRIOR KNOWLEDGE: ${concept.prerequisites.map((p) => p.title).join(', ') || 'none'}
ANGLE "${angle}": ${ANGLE_BRIEFS[angle]}

SOURCE CARD (id "${concept.card.id}", title "${concept.card.title}", ref "${concept.card.ref}"):
${concept.card.text}

Fixed fields: schema_version ${SCHEMA_VERSION}, reel_id "${job.reelId}", concept_id "${concept.node.id}", lang "en", angle "${angle}", target_duration_s ${TARGET_DURATION_S}.
sources must be exactly [{"id": "${concept.card.id}", "title": "${concept.card.title}", "ref": "${concept.card.ref}"}].
Length: hook plus all narration together about ${words} words (${TARGET_DURATION_S} seconds at ${WORDS_PER_SECOND} words per second).
Retrieval item ids: "${job.reelId}--q1", "${job.reelId}--q2".

${catalogueForPrompt()}

JSON Schema:
${reelSpecJsonSchema}`;
  return { system: SYSTEM, user };
}

/** What the writer is told when its draft is sent back: by review, by the parser, or by the schema. */
export const REPAIR = {
  review: (previous: unknown, issues: string[]) =>
    `\n\nYour previous draft was rejected by review:\n${JSON.stringify(previous)}\n\nFix every one of these problems and return the full corrected JSON:\n- ${issues.join('\n- ')}`,
  invalidJson: (message: string) =>
    `\n\nYour previous reply was not valid JSON (${message}). Return only the JSON object.`,
  schema: (candidate: unknown, problems: string[]) =>
    `\n\nYour previous reply:\n${JSON.stringify(candidate)}\n\nIt failed schema validation. Fix these and return the full corrected JSON:\n- ${problems.join('\n- ')}`,
};

/** Changes whenever the system prompt, user template, catalogue, schema or repair messages change. */
export const WRITER_PROMPT_VERSION = promptVersion([
  ...Angle.options.map((angle) => {
    const p = buildWriterPrompt(placeholderJob(angle));
    return `${p.system}\n${p.user}`;
  }),
  REPAIR.review('<previous>', ['<issue>']),
  REPAIR.invalidJson('<error>'),
  REPAIR.schema('<candidate>', ['<problem>']),
]);

export interface WriteResult {
  spec: ReelSpec | null;
  /** Model calls used, including repairs. */
  calls: number;
  problems: string[];
}

/**
 * Draft (or redraft, when `feedback` is given) a spec. Retries up to twice when
 * the output does not parse or fails the schema, feeding the errors back.
 */
export async function writeSpec(
  writer: LLM,
  ledger: CostLedger,
  job: Job,
  feedback?: { previous: unknown; issues: string[] },
): Promise<WriteResult> {
  const prompt = buildWriterPrompt(job);
  // A repair during a rewrite keeps the reviewer's feedback in view.
  const base = feedback
    ? prompt.user + REPAIR.review(feedback.previous, feedback.issues)
    : prompt.user;
  let user = base;
  let problems: string[] = [];
  for (let call = 1; call <= 3; call++) {
    const req = {
      system: prompt.system,
      user,
      maxTokens: MODELS.writer.maxTokens,
      json: true,
      temperature: 0.6,
    };
    const reply = await ledger.charge(
      {
        reelId: job.reelId,
        stage: 'generate',
        provider: writer.provider,
        model: writer.model,
        promptVersion: WRITER_PROMPT_VERSION,
        requestSha256: requestHash(writer.model, req),
      },
      writer.estimateUsd(req),
      () => writer.complete(req),
    );
    let candidate: unknown;
    try {
      candidate = extractJson(reply.text);
    } catch (error) {
      problems = [`output was not valid JSON: ${(error as Error).message}`];
      user = base + REPAIR.invalidJson((error as Error).message);
      continue;
    }
    const parsed = ReelSpec.safeParse(candidate);
    if (parsed.success) return { spec: parsed.data, calls: call, problems: [] };
    problems = formatIssues(parsed.error.issues);
    user = base + REPAIR.schema(candidate, problems);
  }
  return { spec: null, calls: 3, problems };
}
