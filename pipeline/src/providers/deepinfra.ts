// DeepInfra backends. Chat uses the OpenAI-compatible endpoint; TTS and images
// use the native inference API. Response shapes were read from DeepInfra's
// model schemas on 2026-10-04.
import { MODELS } from '../config';
import {
  backoffMs,
  DEFAULT_RETRY,
  isRetryableStatus,
  parseRetryAfter,
  type RetryPolicy,
} from '../retry';
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
import type { Charged } from '../ledger';

const BASE = 'https://api.deepinfra.com';

/** Rough upper bound: English averages about 4 characters per token. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface PostOptions {
  timeoutMs: number;
  retry?: RetryPolicy;
  /** Injected by tests so retries don't wait in real time. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * POST with retries (see retry.ts). Returns the parsed body and how many
 * attempts it took, which the ledger records. A timed-out attempt may still be
 * billed by the provider; the ledger only sees the cost of the attempt that answered.
 */
export async function postJson<T>(
  apiKey: string,
  url: string,
  body: unknown,
  opts: PostOptions,
): Promise<{ data: T; attempts: number }> {
  const policy = opts.retry ?? DEFAULT_RETRY;
  const sleep = opts.sleep ?? wait;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      text = await res.text();
    } catch (error) {
      // Network failure or timeout.
      if (attempt >= policy.attempts) throw error;
      await sleep(backoffMs(attempt, policy, opts.random));
      continue;
    }
    if (res.ok) return { data: JSON.parse(text) as T, attempts: attempt };
    const error = new ProviderError(
      `${url} -> HTTP ${res.status} after ${attempt} attempt(s): ${text.slice(0, 300)}`,
      res.status,
    );
    if (!isRetryableStatus(res.status) || attempt >= policy.attempts) throw error;
    const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
    if (retryAfter !== null && retryAfter > policy.maxRetryAfterMs) throw error;
    await sleep(retryAfter ?? backoffMs(attempt, policy, opts.random));
  }
}

interface ChatResponse {
  choices: { message: { content: string | null }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; estimated_cost?: number };
}

export class DeepInfraLLM implements LLM {
  readonly provider = 'deepinfra';
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly price: { usdPerMTokIn: number; usdPerMTokOut: number },
  ) {}

  private cost(inTok: number, outTok: number) {
    return (inTok * this.price.usdPerMTokIn + outTok * this.price.usdPerMTokOut) / 1e6;
  }

  estimateUsd(req: ChatRequest): number {
    return this.cost(estimateTokens(req.system + req.user), req.maxTokens);
  }

  async complete(req: ChatRequest): Promise<Charged<ChatResult>> {
    const body = {
      model: this.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.4,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    };
    const { data, attempts } = await postJson<ChatResponse>(
      this.apiKey,
      `${BASE}/v1/openai/chat/completions`,
      body,
      { timeoutMs: 300_000 },
    );
    const choice = data.choices[0];
    const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(req.system + req.user);
    const outputTokens = data.usage?.completion_tokens ?? req.maxTokens;
    const costUsd = data.usage?.estimated_cost ?? this.cost(inputTokens, outputTokens);
    if (!choice?.message.content) {
      throw new ProviderError(
        `${this.model} returned no content (finish_reason: ${choice?.finish_reason})`,
      );
    }
    return {
      value: { text: choice.message.content, inputTokens, outputTokens },
      costUsd,
      units: { input_tokens: inputTokens, output_tokens: outputTokens },
      attempts,
    };
  }
}

interface KokoroResponse {
  audio: string;
  words?: { text: string; start: number; end: number }[];
  input_character_length?: number;
  inference_status?: { cost?: number };
}

/** Accepts either a data URL or bare base64. */
function decodeBase64Payload(payload: string): Uint8Array {
  const comma = payload.startsWith('data:') ? payload.indexOf(',') : -1;
  return Buffer.from(payload.slice(comma + 1), 'base64');
}

export class DeepInfraKokoro implements TTS {
  readonly provider = 'deepinfra';
  readonly model = MODELS.tts.model;
  constructor(private readonly apiKey: string) {}

  estimateUsd(text: string): number {
    // Billed per character; a small floor covers rounding on short chunks.
    return Math.max(text.length, 100) * (MODELS.tts.usdPerMChars / 1e6);
  }

  async speak(text: string): Promise<Charged<SpeechResult>> {
    const { data, attempts } = await postJson<KokoroResponse>(
      this.apiKey,
      `${BASE}/v1/inference/${this.model}`,
      { text, output_format: 'mp3', return_timestamps: true, preset_voice: [MODELS.tts.voice] },
      { timeoutMs: 120_000 },
    );
    if (!data.words?.length) throw new ProviderError('Kokoro returned no word timestamps');
    const chars = data.input_character_length ?? text.length;
    return {
      value: {
        audio: decodeBase64Payload(data.audio),
        format: 'mp3',
        words: data.words.map((w) => ({
          text: w.text,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        })),
      },
      costUsd: data.inference_status?.cost ?? chars * (MODELS.tts.usdPerMChars / 1e6),
      units: { characters: chars },
      attempts,
    };
  }
}

interface FluxResponse {
  images: string[];
  nsfw_content_detected?: boolean[];
  inference_status?: { cost?: number };
}

export class DeepInfraFlux implements ImageGen {
  readonly provider = 'deepinfra';
  readonly model = MODELS.images.model;
  constructor(private readonly apiKey: string) {}

  estimateUsd(req: ImageRequest): number {
    return (
      MODELS.images.usdPerMegapixelStep *
      (req.width / 1024) *
      (req.height / 1024) *
      MODELS.images.steps
    );
  }

  async generate(req: ImageRequest): Promise<Charged<ImageResult>> {
    const { data, attempts } = await postJson<FluxResponse>(
      this.apiKey,
      `${BASE}/v1/inference/${this.model}`,
      { ...req, num_images: 1, num_inference_steps: MODELS.images.steps },
      { timeoutMs: 120_000 },
    );
    const image = data.images[0];
    if (!image) throw new ProviderError('FLUX returned no image');
    if (data.nsfw_content_detected?.[0]) throw new ProviderError('FLUX flagged the image as NSFW');
    const mime = /^data:image\/(\w+)/.exec(image)?.[1] ?? 'png';
    return {
      value: {
        bytes: decodeBase64Payload(image),
        ext: mime === 'jpeg' ? 'jpg' : (mime as ImageResult['ext']),
      },
      costUsd: data.inference_status?.cost ?? this.estimateUsd(req),
      units: { images: 1 },
      attempts,
    };
  }
}

export function deepInfraProviders(apiKey: string): Providers {
  return {
    writer: new DeepInfraLLM(apiKey, MODELS.writer.model, MODELS.writer),
    reviewer: new DeepInfraLLM(apiKey, MODELS.reviewer.model, MODELS.reviewer),
    tts: new DeepInfraKokoro(apiKey),
    images: new DeepInfraFlux(apiKey),
  };
}
