import { describe, expect, it } from 'vitest';
import { CaptureReviewer, gatePromptVersions, REVIEW_GATES } from './gates';
import { placeholderJob, placeholderSpec, requestHash } from './provenance';
import { WRITER_PROMPT_VERSION } from './writer';

describe('prompt provenance', () => {
  it('versions the writer prompt as a short content hash', () => {
    expect(WRITER_PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('versions each review gate separately and deterministically', async () => {
    const first = await gatePromptVersions();
    expect(Object.keys(first)).toEqual(['G2', 'G3', 'G4']);
    for (const v of Object.values(first)) expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(new Set(Object.values(first)).size).toBe(3);
    expect(await gatePromptVersions()).toEqual(first);
  });

  it('renders every gate past its deterministic checks, so the version covers the questions', async () => {
    for (const gate of Object.values(REVIEW_GATES)) {
      const capture = new CaptureReviewer();
      await gate(placeholderSpec('pitfall'), placeholderJob('pitfall'), capture);
      expect(capture.prompts).toHaveLength(1);
    }
    const capture = new CaptureReviewer();
    await REVIEW_GATES.G2(placeholderSpec('intro'), placeholderJob('intro'), capture);
    // Claims, answer keys, unsupported script, code match and the bug check are all asked.
    for (const key of ['claim_c1', 'item_2', 'script_unsupported', 'code_2', 'bug_2', 'code_3']) {
      expect(capture.prompts[0]).toContain(`"${key}"`);
    }
    expect(capture.prompts[0]).not.toContain('"bug_3"'); // segment 3 is a deliberate mistake
  });

  it('hashes the exact request', () => {
    const req = { system: 's', user: 'u', maxTokens: 10, json: true, temperature: 0 };
    expect(requestHash('m', req)).toBe(requestHash('m', { ...req }));
    expect(requestHash('m', req)).not.toBe(requestHash('m', { ...req, user: 'u2' }));
    expect(requestHash('m', req)).not.toBe(requestHash('other', req));
  });
});
