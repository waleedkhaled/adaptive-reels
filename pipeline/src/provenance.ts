// Prompt provenance. A prompt's version is a hash of the template rendered for
// a fixed placeholder input, so any change to its wording, rules, repair
// messages or embedded JSON Schema gives a new version, with no number to
// remember to bump. Ledger entries, text records and eval results carry these
// versions; request hashes identify the exact text sent on each call.
import { createHash } from 'node:crypto';
import { ReelSpec, type Angle } from '@reels/schemas';
import type { Job } from './content';
import type { ChatRequest } from './providers/types';

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** 12 hex characters: short enough to read in a report, long enough not to collide here. */
export const promptVersion = (renderings: readonly string[]) =>
  sha256(renderings.join('\n\u0000\n')).slice(0, 12);

export const requestHash = (model: string, req: ChatRequest) =>
  sha256(
    JSON.stringify([model, req.system, req.user, req.maxTokens, req.json, req.temperature ?? null]),
  );

const ID = 'placeholder-concept';

/** A job whose every field is a placeholder, for rendering templates. */
export function placeholderJob(angle: Angle): Job {
  const node = (id: string, kind: 'topic' | 'concept') => ({
    id,
    kind,
    title: `<${kind} title>`,
    summary: `<${kind} summary>`,
  });
  return {
    reelId: `${ID}--${angle}`,
    angle,
    concept: {
      node: node(ID, 'concept'),
      topic: node('placeholder-topic', 'topic'),
      prerequisites: [node('placeholder-prerequisite', 'concept')],
      card: {
        id: `card-${ID}`,
        title: '<card title>',
        ref: '<card ref>',
        // Contains the placeholder spec's quotes, so the claims gate gets past its quote check.
        text: '<card text> <quote 1> <quote 2>',
        facts: [{ n: 1, text: '<fact>' }],
      },
    },
  };
}

/** A spec that exercises every question a review gate can ask. */
export function placeholderSpec(angle: Angle): ReelSpec {
  const code = (check: 'compiles' | 'should_error') => ({
    kind: 'code' as const,
    language: 'ts' as const,
    code: '<code>',
    check,
  });
  return ReelSpec.parse({
    schema_version: 1,
    reel_id: `${ID}--${angle}`,
    concept_id: ID,
    lang: 'en',
    angle,
    template: 'visual-focus',
    target_duration_s: 30,
    hook: '<hook>',
    segments: [
      { narration: '<narration 1>', on_screen_text: '<text 1>', visual: { kind: 'kinetic_text' } },
      { narration: '<narration 2>', on_screen_text: '<text 2>', visual: code('compiles') },
      { narration: '<narration 3>', on_screen_text: '<text 3>', visual: code('should_error') },
      {
        narration: '<narration 4>',
        on_screen_text: '<text 4>',
        visual: {
          kind: 'flow',
          nodes: [
            { id: 'a', label: '<a>' },
            { id: 'b', label: '<b>' },
          ],
          edges: [{ from: 'a', to: 'b', label: '<edge>' }],
        },
      },
      {
        narration: '<narration 5>',
        on_screen_text: '<text 5>',
        visual: { kind: 'image', prompt: '<image prompt>' },
      },
    ],
    key_claims: [
      { id: 'c1', text: '<claim 1>', source_id: `card-${ID}`, quote: '<quote 1>' },
      { id: 'c2', text: '<claim 2>', source_id: `card-${ID}`, quote: '<quote 2>' },
    ],
    sources: [{ id: `card-${ID}`, title: '<card title>', ref: '<card ref>' }],
    difficulty: 1,
    retrieval_items: [1, 2].map((n) => ({
      id: `${ID}--${angle}--q${n}`,
      type: 'mcq',
      prompt: `<question ${n}>`,
      choices: ['<choice a>', '<choice b>', '<choice c>'],
      answer_index: 0,
      explanation: '<explanation>',
      claim_ids: [`c${n}`],
    })),
  });
}
