// Planted defects for the reviewer eval. Each case copies a golden spec and
// plants one plausible-but-wrong change of a known type, so its label is known
// by construction. Planted specs still pass G1 and the verbatim-quote check
// (see cases.test.ts), so only the LLM review gates can catch them.
import type { ReelSpec } from '@reels/schemas';
import type { GateId } from '../gates';

export const DEFECTS = {
  contradicted_claim: {
    gate: 'G2',
    description:
      'A key claim and its narration contradict the source card; the quote is untouched.',
  },
  unsupported_detail: {
    gate: 'G2',
    description:
      'Narration adds a specific, plausible fact (a number, a version, history) the card does not support.',
  },
  wrong_answer_key: {
    gate: 'G2',
    description: "A retrieval item's answer key points at a distractor.",
  },
  two_correct_choices: {
    gate: 'G2',
    description: 'A distractor is replaced by a second correct answer.',
  },
  code_contradicts_narration: {
    gate: 'G2',
    description: 'The code no longer does what the narration and on-screen text say it does.',
  },
  subtle_bug: {
    gate: 'G2',
    description: 'Code shown as good practice has a bug an experienced reviewer would flag.',
  },
  insecure_practice: {
    gate: 'G4',
    description:
      'Code shown as the recommended way does something insecure (a hard-coded secret, eval of model output, SQL built from input).',
  },
  trivia_questions: {
    gate: 'G3',
    description: 'A retrieval item tests recall of wording or trivia instead of understanding.',
  },
} as const satisfies Record<string, { gate: Exclude<GateId, 'G1'>; description: string }>;

export type Defect = keyof typeof DEFECTS;

export interface PlantedCase {
  /** Golden reel id the defect is planted in. */
  base: string;
  defect: Defect;
  /** What was planted and why it is wrong, citing the source card where it applies. */
  note: string;
  /** Receives a deep copy of the golden spec; may edit it in place and return it. */
  mutate: (spec: ReelSpec) => ReelSpec;
}

export const caseId = (c: Pick<PlantedCase, 'defect' | 'base'>) => `${c.defect}/${c.base}`;

/** Moves an item's answer key to the next choice, which is a distractor. */
export const shiftAnswerKey =
  (item: number) =>
  (spec: ReelSpec): ReelSpec => {
    const target = spec.retrieval_items[item]!;
    target.answer_index = (target.answer_index + 1) % target.choices.length;
    return spec;
  };

/** Replaces the snippet shown in segments[segment] (0-based), which must be a code visual. */
function setCode(spec: ReelSpec, segment: number, lines: string[], highlight?: number[]): ReelSpec {
  const visual = spec.segments[segment]!.visual;
  if (visual.kind !== 'code') throw new Error(`segments[${segment}] is not a code visual`);
  visual.code = lines.join('\n');
  if (highlight) visual.highlight_lines = highlight;
  return spec;
}

// Indices below are 0-based (segments[1] is segment 2); notes use the reviewer's
// 1-based names (segment 2, Q2). Card facts are the numbered lines of the card.
export const PLANTED: PlantedCase[] = [
  // contradicted_claim: claim text and the narration that states it; quotes untouched.
  {
    base: 'react-state--pitfall',
    defect: 'contradicted_claim',
    note: 'Card fact 2 says calling the setter schedules a re-render, and fact 5 says updates in one event are batched into a single re-render; claim c2 and the segment 2 narration now say React re-renders immediately, before the event handler returns.',
    mutate: (spec) => {
      spec.segments[1]!.narration =
        'Instead, always create a new copy with the change. Pass a fresh object to the setter, and React detects the difference and re-renders right away, before your handler returns.';
      spec.key_claims[1]!.text =
        'Create a new copy with the change and pass it to the setter, and React re-renders immediately, before the event handler returns.';
      return spec;
    },
  },
  {
    base: 'rn-lists-virtualization--intro',
    defect: 'contradicted_claim',
    note: 'Card fact 3 says FlatList renders 10 items initially by default; claim c3 and the segment 3 narration now say its first pass renders the whole list unless initialNumToRender caps it.',
    mutate: (spec) => {
      spec.segments[2]!.narration =
        "Its first pass renders the whole list unless you cap it at ten, then keeps about twenty-one screen heights rendered. That's how long lists stay smooth.";
      spec.key_claims[2]!.text =
        'FlatList renders the whole list on its first pass unless initialNumToRender caps it.';
      return spec;
    },
  },
  {
    base: 'fallbacks-degradation--intro',
    defect: 'contradicted_claim',
    note: 'Card fact 5 says to tell users when they are getting a degraded result so they are not misled; claim c3, the segment 3 narration and its on-screen text now say to make the switch seamless so users never notice.',
    mutate: (spec) => {
      spec.segments[2]!.narration =
        "And make the switch seamless, so users never notice they're getting a degraded result.";
      spec.segments[2]!.on_screen_text = 'Keep fallbacks invisible to users';
      spec.key_claims[2]!.text =
        "Make the fallback seamless so users never notice they're getting a degraded result.";
      return spec;
    },
  },

  // unsupported_detail: narration gains a specific fact the card never states.
  {
    base: 'rn-core-components--intro',
    defect: 'unsupported_detail',
    note: 'The segment 1 narration now adds that native views make screens render about three times faster than a web view; the card (facts 1 and 2) says they are real native views but gives no performance figure.',
    mutate: (spec) => {
      spec.segments[0]!.narration =
        'React Native core components like View, Text, and Image render real native platform views, not HTML inside a web view, which makes screens render about three times faster.';
      return spec;
    },
  },
  {
    base: 'prompting-basics--example',
    defect: 'unsupported_detail',
    note: 'The segment 2 narration now adds that accuracy usually drops past five few-shot examples; card fact 2 says examples work better than descriptions but says nothing about how many to use.',
    mutate: (spec) => {
      spec.segments[1]!.narration =
        'Now add a few-shot example showing the exact input and output you expect. This shows the pattern more reliably than a description alone, though past five examples, accuracy usually drops.';
      return spec;
    },
  },
  {
    base: 'time-complexity--example',
    defect: 'unsupported_detail',
    note: 'The segment 3 narration now turns the step counts into wall-clock times (roughly fifteen minutes down to a millisecond); the card gives step counts only (fact 3) and says Big-O ignores constant factors (fact 6).',
    mutate: (spec) => {
      spec.segments[2]!.narration =
        'For a million items, that is a trillion steps down to a million, roughly fifteen minutes down to a millisecond. Same result, far less work.';
      return spec;
    },
  },

  // wrong_answer_key: the key moves to the next choice, a distractor.
  {
    base: 'rn-platform-code--example',
    defect: 'wrong_answer_key',
    note: 'Card fact 2: Platform.select returns the value for the current platform, so Platform.select({ ios: 12, android: 16 }) gives 16 on Android; the key for Q2 now marks 12, the iOS value.',
    mutate: shiftAnswerKey(1),
  },
  {
    base: 'structured-output--intro',
    defect: 'wrong_answer_key',
    note: "Card fact 2 says JSON mode guarantees valid JSON but not the fields you expect; the key for Q1 now marks 'The exact fields you requested in your prompt'.",
    mutate: shiftAnswerKey(0),
  },
  {
    base: 'break-down-problems--intro',
    defect: 'wrong_answer_key',
    note: "Card fact 4 says writing the steps down frees working memory and makes the next step obvious; the key for Q2 now marks 'To create a permanent project document', which the card never says.",
    mutate: shiftAnswerKey(1),
  },

  // two_correct_choices: a distractor becomes a second correct answer.
  {
    base: 'rn-flexbox-layout--example',
    defect: 'two_correct_choices',
    note: 'Card fact 5: siblings with flex 1 and flex 2 share space one to two, so the flex: 2 view gets two thirds of it; the new choice C in Q2 is as correct as the keyed B.',
    mutate: (spec) => {
      spec.retrieval_items[1]!.choices[2] = 'The flex: 2 view gets two thirds of the space';
      return spec;
    },
  },
  {
    base: 'ts-unknown-vs-any--pitfall',
    defect: 'two_correct_choices',
    note: 'Card fact 4: a value derived from an any is also any, which silently removes checking; the new choice D in Q2 restates that, so it is as correct as the keyed A.',
    mutate: (spec) => {
      spec.retrieval_items[1]!.choices[3] = 'Everything derived from it loses checking too';
      return spec;
    },
  },
  {
    base: 'read-error-messages--intro',
    defect: 'two_correct_choices',
    note: 'Card fact 2 puts the throw site at the top of a stack trace, so the topmost frame that points into your code is the first frame in your own code (fact 3); the new choice D in Q2 is as correct as the keyed C.',
    mutate: (spec) => {
      spec.retrieval_items[1]!.choices[3] = 'The topmost frame that points into your code';
      return spec;
    },
  },

  // code_contradicts_narration: the snippet no longer shows what is said about it.
  {
    base: 'react-components-props--example',
    defect: 'code_contradicts_narration',
    note: 'The segment 1 narration and on-screen text say props arrive as one object (card fact 3), but Greeting now takes name as a plain string parameter; React would pass the whole props object into name.',
    mutate: (spec) =>
      setCode(
        spec,
        0,
        ['function Greeting(name: string) {', '  return <h1>Hello, {name}</h1>;', '}'],
        [1],
      ),
  },
  {
    base: 'ts-typing-props--intro',
    defect: 'code_contradicts_narration',
    note: 'The segment 2 narration and on-screen text say subtitle is made optional with a question mark (card fact 2), but the code now declares subtitle: string | undefined, which is still a required prop every caller must pass.',
    mutate: (spec) =>
      setCode(spec, 1, [
        'type Props = {',
        '  title: string;',
        '  subtitle: string | undefined;',
        '};',
      ]),
  },
  {
    base: 'queues-async-work--intro',
    defect: 'code_contradicts_narration',
    note: 'The segment 3 narration and on-screen text say the API returns an ID right away (card fact 3), but handleRequest now awaits done(id), so it only responds after the job has finished.',
    mutate: (spec) =>
      setCode(spec, 2, [
        'type JobId = string;',
        'declare function done(id: JobId): Promise<void>;',
        'let counter = 0;',
        'function enqueue(data: unknown): JobId {',
        '  counter += 1;',
        '  return `job-${counter}`;',
        '}',
        'async function handleRequest(data: unknown) {',
        '  const id = enqueue(data);',
        '  await done(id);',
        '  return { id };',
        '}',
      ]),
  },

  // subtle_bug: code shown as the right way has a bug a reviewer should flag.
  {
    base: 'react-state--pitfall',
    defect: 'subtle_bug',
    note: "Segment 2's fix now calls Object.assign(u, ...), which writes into the existing state object and returns the same reference; that is the in-place mutation of card fact 6, so Object.is sees no change and React skips the re-render.",
    mutate: (spec) =>
      setCode(spec, 1, [
        'import { useState } from "react"',
        'function P() {',
        '  type U = { readonly name: string }',
        '  const [u, s] = useState<U>({',
        '    name: "Ada",',
        '  })',
        '  const f = () =>',
        '    s(Object.assign(u, { name: "Grace" }))',
        '  return (',
        '    <button onClick={f}>{u.name}</button>',
        '  )',
        '}',
      ]),
  },
  {
    base: 'time-complexity--example',
    defect: 'subtle_bug',
    note: "Segment 2's helper builds a new Set from b on every call, so each lookup walks all of b again; the function is still O(n squared), slower than the includes version, not the O(n) of card fact 4.",
    mutate: (spec) =>
      setCode(spec, 1, [
        'function find(a: number[], b: number[]) {',
        '  const has = (x: number) => new Set(b).has(x);',
        '  return a.filter(has);',
        '}',
      ]),
  },
  {
    base: 'fallbacks-degradation--intro',
    defect: 'subtle_bug',
    note: 'Segment 2 now returns primary() without await inside the try, so a rejected model call is not caught and the fallback never runs; only synchronous throws reach the catch.',
    mutate: (spec) =>
      setCode(spec, 1, [
        'async function answer<T>(',
        '  primary: () => Promise<T>,',
        '  fallback: () => T,',
        '): Promise<T> {',
        '  try {',
        '    return primary();',
        '  } catch {',
        '    return fallback();',
        '  }',
        '}',
      ]),
  },

  // insecure_practice: the recommended code does something insecure, unflagged.
  {
    base: 'prompting-basics--example',
    defect: 'insecure_practice',
    note: "Segment 1's recommended code now hard-codes an API key as a string literal in source, where it lands in the repo and any client bundle; keys belong in a server-side secret store or environment variable.",
    mutate: (spec) =>
      setCode(spec, 0, [
        'const input = "App crashes on login";',
        'export const prompt = `',
        'Classify the support ticket.',
        'Audience: internal triage.',
        'Output: bug, feature, billing.',
        'Only return the label.',
        '<ticket>${input}</ticket>',
        '`;',
        'export const headers = {',
        '  "x-api-key": "sk-live-7f3a9c2e4b1d",',
        '};',
      ]),
  },
  {
    base: 'structured-output--intro',
    defect: 'insecure_practice',
    note: "Segment 3 now runs the model's reply through eval before validating it, so any JavaScript in the output executes; Zod validation afterwards (card fact 4) cannot undo that, and JSON.parse is the safe parser.",
    mutate: (spec) =>
      setCode(
        spec,
        2,
        [
          'import { z } from "zod";',
          '',
          'const S = z.object({',
          '  mood: z.enum([',
          '    "positive", "negative", "neutral",',
          '  ]),',
          '});',
          'declare const reply: string;',
          '// eval also accepts single quotes',
          'S.parse(eval(`(${reply})`));',
        ],
        [4, 10],
      ),
  },
  {
    base: 'prompt-injection-guardrails--intro',
    defect: 'insecure_practice',
    note: "Segment 3's least-privilege tool builds SQL from the model-chosen order id with an f-string, so an injected instruction can make the model pass a payload such as ' OR '1'='1 and read every order (card facts 6 and 7); it needs a parameterized query.",
    mutate: (spec) =>
      setCode(
        spec,
        2,
        [
          '# Limit what an injection can do',
          'def find_order(oid: str):',
          `  q = f"SELECT * FROM orders WHERE id='{oid}'"`,
          '  return db.execute(q)',
          '',
          'agent = Agent(',
          '  tools=[find_order],  # least privilege',
          '  confirm_before=["delete", "send_email",',
          '                  "run_sql"],',
          ')',
        ],
        [7, 8],
      ),
  },

  // trivia_questions: one item now tests recall of an incidental detail.
  {
    base: 'rn-core-components--intro',
    defect: 'trivia_questions',
    note: 'Q2 now asks which word the example Card component displays; it is answerable and correctly keyed, but tests recall of the snippet instead of why text must sit inside a Text component.',
    mutate: (spec) => {
      spec.retrieval_items[1] = {
        id: 'rn-core-components--intro--q2',
        type: 'mcq',
        prompt: "In the reel's code example, what text does the Card component display?",
        choices: ['Hello', 'Hello, world', 'Welcome', 'Card'],
        answer_index: 0,
        explanation:
          'The Card component in the example renders the word Hello inside a Text component.',
        claim_ids: ['c3'],
      };
      return spec;
    },
  },
  {
    base: 'ts-typing-props--intro',
    defect: 'trivia_questions',
    note: "Q2 now asks which prop the example happened to make optional ('subtitle'); a learner can answer from memory of the snippet without knowing how to mark a prop optional.",
    mutate: (spec) => {
      spec.retrieval_items[1] = {
        id: 'ts-typing-props--intro--q2',
        type: 'mcq',
        prompt: "In the reel's example, which prop was marked as optional?",
        choices: ['subtitle', 'title', 'count', 'size'],
        answer_index: 0,
        explanation: 'The example marked subtitle as optional by writing subtitle?: string.',
        claim_ids: ['c2'],
      };
      return spec;
    },
  },
  {
    base: 'queues-async-work--intro',
    defect: 'trivia_questions',
    note: 'Q1 now asks how many seconds the API in the hook took (ten), a scene-setting detail, instead of testing how a producer, a queue and a worker split the work.',
    mutate: (spec) => {
      spec.retrieval_items[0] = {
        id: 'queues-async-work--intro--q1',
        type: 'mcq',
        prompt: "In the reel's opening, how long did the API take to respond?",
        choices: ['Ten seconds', 'Two seconds', 'Thirty seconds', 'One minute'],
        answer_index: 0,
        explanation:
          'The opening described an API that took ten seconds because it called a slow model inside the request.',
        claim_ids: ['c2'],
      };
      return spec;
    },
  },
];

/** A planted copy of a golden spec. */
export function plant(c: PlantedCase, base: ReelSpec): ReelSpec {
  return c.mutate(structuredClone(base));
}
