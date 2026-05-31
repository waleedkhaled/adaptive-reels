# ADR 0005: Every paid call reserves its worst-case cost against a budget cap; the dry run uses fake providers with the network blocked

- **Status:** Accepted
- **Decided:** 2026-10-03 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (Pipeline design, "Cross-cutting"; M1 acceptance), `pipeline/src/ledger.ts`, `pipeline/src/providers/`, `pipeline/src/network.ts`

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- Four paid models (writer, reviewer, TTS, images) are called by a CLI that processes up to 120 reels, 4 at a time, with repair calls and rewrites. A bug, a loop or a wrong flag could spend money unattended.
- The plan asks for a cost ledger that "halts before any call that would cross the cap" (default $10), and for a `--dry-run` that "swaps in fixture providers and makes zero network calls" (`docs/PLAN.md` Pipeline design). M1's acceptance adds "dry-run makes zero network calls and prints a cost estimate" and "a test proves the run halts at the cap".
- People and coding agents both change and run this CLI, and a change should be checkable without an API key and without spending money.

## Decision

1. **One gate for money.** Every paid call goes through `CostLedger.charge(meta, estimateUsd, call)` (`pipeline/src/ledger.ts`). The writer, the reviewer, TTS and images all call it (`writer.ts`, `reviewer.ts`, `media.ts`); providers sit behind the `LLM`, `TTS` and `ImageGen` interfaces (`providers/types.ts`).
2. **Reserve the worst case first.** Before the call, `charge` adds the estimate to what is already committed: the actual spend (in a dry run, the projected spend) plus the reservations of calls still in flight. If that would exceed the cap it throws `BudgetExceededError` and the call is not made. Otherwise it reserves the estimate, makes the call, releases the reservation and adds the actual cost.
3. **Worst-case estimates.** Chat: input tokens estimated at one per 3.5 characters plus the full `maxTokens` of output, at the list prices in `config.ts`. TTS: characters (at least 100) times the price per character. Images: megapixels times steps times the price (`providers/deepinfra.ts`).
4. **Actual cost.** The provider's reported cost when the response has one (`usage.estimated_cost`, `inference_status.cost`), else tokens or characters times the list price. Each call appends one JSON line to `library/ledger.jsonl` with the estimate and the actual cost; the report reads it for cost per reel.
5. **The cap.** `--budget`, else `BUDGET_CAP_USD`, else $10 (`cli.ts`, `config.ts`). On `BudgetExceededError` no new reel starts, calls in flight finish, the manifests and report are still written when those stages were requested, and the CLI exits with code 2 (`run.ts`, `cli.ts`).
6. **Dry run.** `--dry-run` uses `fakeProviders`: deterministic outputs that pass the gates, priced with the real backends' estimators, costing $0. `blockNetwork` replaces `globalThis.fetch` with a function that throws. Output goes to `library/dry-run/`, and the CLI prints the projected worst-case cost of the same run for real (`providers/fake.ts`, `run.ts`, `cli.ts`).
7. **Offline stages stay offline.** When a run has no paid stage, `guardNetwork` lets fetch and http reach loopback only (Remotion talks to its own server and browser) and refuses https (`pipeline/src/network.ts`).

## Alternatives considered

- **Record cost after each call and stop once over.** Rejected: with calls in flight the run crosses the cap before it notices.
- **Check the cap against actual spend only.** Rejected: 4 parallel calls could each pass the check and overshoot together; the ledger counts in-flight calls at their worst case (`ledger.ts` comment, `ledger.test.ts`: "counts calls still in flight against the cap").
- **Mock HTTP for the dry run (record and replay).** Not used: fakes sit behind the same interfaces as the real providers, so the dry run exercises the same stage code with no recorded responses to maintain.

## Consequences

### Good

- Tested: the ledger halts before the call that would cross the cap, without making it; a dry run spends nothing but enforces the cap on projected cost (`pipeline/src/ledger.test.ts`). The dry run projects a cost, writes a report, and stops at the cap while still writing the report (`pipeline/src/dryrun.test.ts`).
- Every paid call leaves an audit line with its estimate and actual cost, per reel and stage.
- Anyone, including a coding agent, can run the stages with no key and no spend: `npm run pipeline -- all --dry-run --limit 2` (the key is read only for a real run with a paid stage, `run.ts`).

### Bad

- The cap applies to one run. Each run starts a new ledger at $0; spend recorded in `ledger.jsonl` by earlier runs is not counted.
- Reservations assume the full `maxTokens` of output (8000 for the writer, 4000 for the reviewer), so the cap can stop a run while real spend is well below it, and the dry-run projection is an upper bound.
- One reservation covers a call's retries: `postJson` may try up to 4 times under one `charge` (`pipeline/src/retry.ts` `DEFAULT_RETRY`), and failed attempts are assumed to cost nothing.
- The dry-run block covers `fetch` only; the offline-stage guard also covers Node's `http` and `https`. A dry run of `all` still renders locally with Remotion, so it needs the headless Chrome from `npm run pipeline -- setup`.
