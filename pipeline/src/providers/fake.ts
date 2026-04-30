// Offline providers for --dry-run and tests. They never touch the network and
// cost nothing, but estimate with real prices so a dry run projects the cost
// of a real run. Output is deterministic and passes the gates.
import { deflateSync, crc32 } from 'node:zlib';
import { MODELS, WORDS_PER_SECOND } from '../config';
import type { Content } from '../content';
import type { Charged } from '../ledger';
import { DeepInfraFlux, DeepInfraKokoro, DeepInfraLLM } from './deepinfra';
import type {
  ChatRequest,
  ChatResult,
  ImageGen,
  ImageRequest,
  ImageResult,
  LLM,
  Providers,
  SpeechResult,
  TTS,
} from './types';

const SYMBOLS = /[=^_\\θΘλπ∑√±×÷<>{}|~°*+/]|\b[a-zA-Z][0-9]\b/;

const chatUnits = (r: ChatResult) => ({
  input_tokens: r.inputTokens,
  output_tokens: r.outputTokens,
});

/** Shares estimateUsd with the real backend so projections use real prices. */
class FakeLLM implements LLM {
  readonly provider = 'fake';
  private readonly priced: DeepInfraLLM;
  constructor(
    readonly model: string,
    price: { usdPerMTokIn: number; usdPerMTokOut: number },
    private readonly respond: (req: ChatRequest) => string,
  ) {
    this.priced = new DeepInfraLLM('', model, price);
  }
  estimateUsd(req: ChatRequest) {
    return this.priced.estimateUsd(req);
  }
  async complete(req: ChatRequest): Promise<Charged<ChatResult>> {
    const text = this.respond(req);
    const value = {
      text,
      inputTokens: Math.ceil((req.system + req.user).length / 4),
      outputTokens: Math.ceil(text.length / 4),
    };
    return { value, costUsd: 0, units: chatUnits(value) };
  }
}

export function fakeSpecJson(content: Content, reelId: string): string {
  const [conceptId, angle] = reelId.split('--') as [string, 'intro' | 'example' | 'pitfall'];
  const concept = content.concepts.find((c) => c.node.id === conceptId);
  if (!concept) throw new Error(`fake writer: unknown concept in ${reelId}`);
  const facts = concept.card.facts.filter((f) => !SYMBOLS.test(f.text)).slice(0, 4);
  const visuals = [
    { kind: 'kinetic_text' },
    {
      kind: 'code',
      language: 'tsx',
      code: 'function Hello({ name }: { name: string }) {\n  return <p>Hi {name}</p>;\n}\n\nconst el = <Hello name="Ada" />;',
      highlight_lines: [1],
      check: 'compiles',
    },
    {
      kind: 'flow',
      nodes: [
        { id: 'app', label: 'App' },
        { id: 'cache', label: 'Cache' },
        { id: 'model', label: 'Model API' },
      ],
      edges: [
        { from: 'app', to: 'cache', label: 'lookup' },
        { from: 'cache', to: 'model', label: 'miss' },
      ],
    },
    { kind: 'image', prompt: 'A tidy desk with a laptop and a cup of coffee by a sunny window' },
  ];
  const short = (s: string) => (s.length <= 80 ? s : `${s.slice(0, 77)}...`);
  const spec = {
    schema_version: 1,
    reel_id: reelId,
    concept_id: conceptId,
    lang: 'en',
    angle,
    template: 'visual-focus',
    target_duration_s: 30,
    hook: `Here is something surprising about ${concept.node.title.toLowerCase()}.`,
    segments: facts.map((f, i) => ({
      narration: f.text,
      on_screen_text: short(f.text).slice(0, 60),
      visual: visuals[i % visuals.length],
    })),
    key_claims: facts.slice(0, 2).map((f, i) => ({
      id: `c${i + 1}`,
      text: f.text,
      source_id: concept.card.id,
      quote: f.text,
    })),
    sources: [{ id: concept.card.id, title: concept.card.title, ref: concept.card.ref }],
    difficulty: 1,
    retrieval_items: facts.slice(0, 2).map((f, i) => ({
      id: `${reelId}--q${i + 1}`,
      type: 'mcq',
      prompt: `Which statement is true about ${concept.node.title.toLowerCase()}?`,
      choices: [short(f.text), 'The opposite of that statement', 'None of these is ever true'],
      answer_index: 0,
      explanation: f.text.slice(0, 300),
      claim_ids: [`c${i + 1}`],
    })),
  };
  return JSON.stringify(spec);
}

/** Answers every reviewer question favourably: "supported", choice A, score 4, flags false. */
export function fakeReviewerJson(prompt: string): string {
  const answers: Record<string, unknown> = {};
  for (const m of prompt.matchAll(/^- "([\w-]+)" \((choice|score [^)]*|yes\/no)\)/gm)) {
    const [, key, type] = m;
    if (type === 'choice')
      answers[key!] = {
        answer: key!.startsWith('claim_')
          ? 'supported'
          : key!.startsWith('code_')
            ? 'correct'
            : 'A',
        confidence: 0.9,
        evidence: 'fake reviewer',
      };
    else if (type!.startsWith('score'))
      answers[key!] = { answer: 4, confidence: 0.8, evidence: 'fake reviewer' };
    else answers[key!] = { answer: false, confidence: 0.9, evidence: 'fake reviewer' };
  }
  return JSON.stringify({ answers });
}

/**
 * 16-bit mono PCM: a quiet 220 Hz tone, or silence with amplitude 0. The fake
 * narration uses the tone so the render's loudness normalisation has a signal to
 * work on and a dry run passes the encode gate; pure silence measures -70 LUFS.
 */
export function silentWav(durationMs: number, sampleRate = 24_000, amplitude = 0): Uint8Array {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  if (amplitude > 0) {
    for (let i = 0; i < samples; i++) {
      const value = amplitude * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
      buf.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
    }
  }
  return buf;
}

/** A solid-colour PNG, enough for the renderer to load. */
export function solidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => rgb).flat()),
  ]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

class FakeTTS implements TTS {
  readonly provider = 'fake';
  readonly model = MODELS.tts.model;
  private readonly priced = new DeepInfraKokoro('');
  estimateUsd(text: string) {
    return this.priced.estimateUsd(text);
  }
  async speak(text: string): Promise<Charged<SpeechResult>> {
    const words = text.split(/\s+/).filter(Boolean);
    const per = 1000 / WORDS_PER_SECOND;
    return {
      value: {
        audio: silentWav(words.length * per + 200, 24_000, 0.1),
        format: 'wav',
        words: words.map((w, i) => ({
          text: w,
          startMs: Math.round(i * per),
          endMs: Math.round((i + 0.85) * per),
        })),
      },
      costUsd: 0,
      units: { characters: text.length },
    };
  }
}

class FakeImages implements ImageGen {
  readonly provider = 'fake';
  readonly model = MODELS.images.model;
  private readonly priced = new DeepInfraFlux('');
  estimateUsd(req: ImageRequest) {
    return this.priced.estimateUsd(req);
  }
  async generate(req: ImageRequest): Promise<Charged<ImageResult>> {
    const shade = 60 + (req.seed % 120);
    return {
      value: {
        bytes: solidPng(Math.round(req.width / 16), Math.round(req.height / 16), [shade, 90, 140]),
        ext: 'png',
      },
      costUsd: 0,
      units: { images: 1 },
    };
  }
}

export function fakeProviders(content: Content): Providers {
  return {
    writer: new FakeLLM(MODELS.writer.model, MODELS.writer, (req) => {
      const reelId = /reel_id "([^"]+)"/.exec(req.user)?.[1];
      if (!reelId) throw new Error('fake writer: no reel_id in prompt');
      return fakeSpecJson(content, reelId);
    }),
    reviewer: new FakeLLM(MODELS.reviewer.model, MODELS.reviewer, (req) =>
      fakeReviewerJson(req.user),
    ),
    tts: new FakeTTS(),
    images: new FakeImages(),
  };
}

/** Makes any network call throw, so a dry run provably stays offline. */
export function blockNetwork(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    throw new Error(`Network call blocked in dry run: ${String(input)}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
