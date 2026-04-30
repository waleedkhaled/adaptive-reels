// Every model sits behind one of these interfaces. Real backends live in
// deepinfra.ts; fake.ts holds the offline fixtures used by --dry-run and tests.
import type { Charged } from '../ledger';

export interface ChatRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Ask for a single JSON object (provider JSON mode). */
  json: boolean;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLM {
  readonly provider: string;
  readonly model: string;
  estimateUsd(req: ChatRequest): number;
  complete(req: ChatRequest): Promise<Charged<ChatResult>>;
}

export interface SpokenWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SpeechResult {
  audio: Uint8Array;
  format: 'mp3' | 'wav';
  words: SpokenWord[];
}

export interface TTS {
  readonly provider: string;
  readonly model: string;
  estimateUsd(text: string): number;
  speak(text: string): Promise<Charged<SpeechResult>>;
}

export interface ImageRequest {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}

export interface ImageResult {
  bytes: Uint8Array;
  ext: 'png' | 'jpg' | 'webp';
}

export interface ImageGen {
  readonly provider: string;
  readonly model: string;
  estimateUsd(req: ImageRequest): number;
  generate(req: ImageRequest): Promise<Charged<ImageResult>>;
}

export interface Providers {
  writer: LLM;
  reviewer: LLM;
  tts: TTS;
  images: ImageGen;
}
