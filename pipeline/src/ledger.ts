// Cost ledger: every paid call reserves its worst-case cost first, so a run
// stops *before* the call that would cross the budget cap.

export class BudgetExceededError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly estimateUsd: number,
    readonly capUsd: number,
    readonly label: string,
  ) {
    super(
      `Budget cap reached: $${spentUsd.toFixed(4)} spent + $${estimateUsd.toFixed(4)} for ${label} ` +
        `would exceed the $${capUsd.toFixed(2)} cap. Stopping.`,
    );
    this.name = 'BudgetExceededError';
  }
}

export interface LedgerEntry {
  run_id: string;
  at: string;
  reel_id: string;
  stage: string;
  provider: string;
  model: string;
  /** Version of the prompt template (LLM calls): see provenance.ts. */
  prompt_version?: string;
  /** sha256 of the exact request (model, prompts, parameters), for replay and dedup. */
  request_sha256?: string;
  /** Worst-case cost reserved before the call. */
  estimate_usd: number;
  /** Actual cost (provider-reported when available). 0 in dry runs. */
  cost_usd: number;
  /** Tokens, characters or images, for the report. */
  units: Record<string, number>;
  /** Wall time of the call, retries and backoff included. */
  latency_ms: number;
  /** HTTP attempts the provider call took (1 = no retry). */
  attempts?: number;
  dry_run: boolean;
}

export interface ChargeMeta {
  reelId: string;
  stage: string;
  provider: string;
  model: string;
  promptVersion?: string;
  requestSha256?: string;
}

export interface Charged<T> {
  value: T;
  costUsd: number;
  units: Record<string, number>;
  /** HTTP attempts, when the provider reports them. */
  attempts?: number;
}

export class CostLedger {
  private spent = 0;
  private estimated = 0;
  private inFlight = 0;
  readonly entries: LedgerEntry[] = [];

  constructor(
    readonly capUsd: number,
    readonly runId: string,
    readonly dryRun: boolean,
    private readonly sink: (entry: LedgerEntry) => void = () => {},
  ) {}

  get spentUsd(): number {
    return this.spent;
  }

  /** Sum of worst-case estimates: in a dry run, the projected cost of a real run. */
  get estimatedUsd(): number {
    return this.estimated;
  }

  /**
   * Reserve `estimateUsd`, run `call`, then record what it actually cost.
   * Throws BudgetExceededError without calling when the reservation would cross the cap.
   */
  async charge<T>(
    meta: ChargeMeta,
    estimateUsd: number,
    call: () => Promise<Charged<T>>,
  ): Promise<T> {
    // In a dry run nothing is spent, so the cap is checked against projected cost instead.
    // Calls still in flight count at their worst case, so parallel calls cannot overshoot.
    const committed = (this.dryRun ? this.estimated : this.spent) + this.inFlight;
    if (committed + estimateUsd > this.capUsd) {
      throw new BudgetExceededError(
        committed,
        estimateUsd,
        this.capUsd,
        `${meta.stage} on ${meta.reelId}`,
      );
    }
    this.inFlight += estimateUsd;
    const started = performance.now();
    let result: Charged<T>;
    try {
      result = await call();
    } finally {
      this.inFlight -= estimateUsd;
    }
    const cost = this.dryRun ? 0 : result.costUsd;
    this.spent += cost;
    this.estimated += estimateUsd;
    const entry: LedgerEntry = {
      run_id: this.runId,
      at: new Date().toISOString(),
      reel_id: meta.reelId,
      stage: meta.stage,
      provider: meta.provider,
      model: meta.model,
      ...(meta.promptVersion ? { prompt_version: meta.promptVersion } : {}),
      ...(meta.requestSha256 ? { request_sha256: meta.requestSha256 } : {}),
      estimate_usd: estimateUsd,
      cost_usd: cost,
      units: result.units,
      latency_ms: Math.round(performance.now() - started),
      ...(result.attempts ? { attempts: result.attempts } : {}),
      dry_run: this.dryRun,
    };
    this.entries.push(entry);
    this.sink(entry);
    return result.value;
  }
}
