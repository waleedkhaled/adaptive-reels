# ADR 0002: A deterministic, pure TypeScript learning agent instead of an LLM in the runtime loop

- **Status:** Accepted
- **Decided:** 2026-10-03, amended 2026-10-04 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (decision 2, Agent spec), `docs/UX.md` section 9 (amendments adopted 2026-10-04), `docs/PERFORMANCE.md` 2.5

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- The feed must adapt on every swipe and say why each item is there: "Never a reason the agent did not use" (`PRODUCT.md`, Product Principles 2).
- The decision runs on the phone at every settle. The target is p95 2 ms per `next()` call and 10 ms per re-plan (`docs/PERFORMANCE.md` section 1; a target, measured on the phones only).
- The 3-minute demo follows a script that depends on an exact sequence of items (`docs/UX.md` section 7).
- The agent must run under Vitest in plain Node and in a headless session simulator (`docs/PLAN.md` decision 2).

## Decision

1. **A pure package.** `@reels/agent` (`packages/agent`) exports functions of `(state, catalog, input, now)` that return new state; nothing reads a clock, a random source or the platform. `eslint.config.mjs:16-43` enforces it for `packages/agent/src/**`: it bans `Date.now`, `Math.random`, `new Date()` with no arguments, and imports of `node:*`, `react`, `react-native` and `expo*`. (`packages/agent/scripts/simulate.ts` is outside `src/` and reads files with `node:fs`.)
2. **Keyed draws, no RNG state.** `keyedRandom(seed, ...key)` hashes the seed and a key with FNV-1a and mixes it with one mulberry32 step (`packages/agent/src/random.ts:25-27`). Keys name the purpose and an ordinal: `'pool'` and the reel ordinal, `'tie'`, `'echo'`, `'pace'`, `'item'` and the card ordinal, `'drop'` and `'shuffle'` with the item id and its presentation count. The learner state stores only the seed (`packages/schemas/src/learner-state.ts:298-299`).
3. **A reducer API.** Each UI event maps to one call that returns a `Step { state, active, upcoming }`: `createProfile`, `startSession`, `settle`, `reelEnded`, `quickAction`, `undoQuickAction`, `answerCard`, `deferCard`, `setMode`, `setClock`, `startGapSession`, `leaveGapSession`, `plan` (`packages/agent/src/queue.ts`). `shown()` is the reducer for "this item is on screen" (`queue.ts:65-185`). `plan()` simulates the next items on a throwaway copy of the state and keeps only the committed reel (`queue.ts:209-243`).
4. **Rules, not a model.** One slot decision checks, in order: reteach after a wrong answer, prove-it, the overdue guard, a returning "Later" card, cadence, echo after More like this, the session summary, change of pace, a weighted draw over the Review, Deepen, Explore and Lateral pools, and a fallback that never returns nothing (`packages/agent/src/decide.ts:120-147`).
5. **Reason codes.** Every reel and card carries `reason: { code, params }` from a fixed enum of 13 codes (`packages/schemas/src/common.ts:43-64`); summary items have none. The copy deck turns code and params into the sentence on screen (`packages/agent/src/copy.ts`), and the reason is logged with each `reel_impression` and `card_shown`.
6. **One file of tunables.** Weights, intervals, interest deltas, thresholds and the demo seed (14) are in `packages/agent/src/config.ts`.

## Alternatives considered

- **An LLM ranker that picks the next item.** Rejected. It adds a network call and a cost to every swipe, inside the start budget; its output is not reproducible, so the demo sequence could not be pinned; and its stated reason would be generated text, not the rule that fired.
- **A seeded RNG whose state is stored in the learner state.** This was the first plan ("Learner state: ... RNG state", `docs/PLAN.md` Schema refinements). Replaced by keyed draws (`docs/UX.md` 9.3): with a stateful RNG, a card inserted by a re-plan or an Undo advances the generator and changes every later pick.
- **The agent as a folder inside the app.** Rejected (`docs/PLAN.md` decision 2): it could not run in plain Node under Vitest or be shared with the simulator.

## Consequences

### Good

- Same inputs, same outputs, and it is tested: a re-plan from unchanged state repeats its picks (`packages/agent/src/queue.test.ts:39`); an inserted card never moves a later reel pick (`decide.test.ts:422`); the UX.md section 7 sequence is pinned with `DEMO_SEED` (`demo.test.ts`).
- Properties that are hard to test with a model are tested here: each pool is drawn within 2% of its weight over 10,000 seeded slots (`decide.test.ts:228`), the feed never returns nothing (`decide.test.ts:411`), every item carries a reason that parses (`decide.test.ts:438`).
- The same code runs in the app, in Vitest and in `npm run simulate`, which compares personas, modes and clocks before a rule change ships (`packages/agent/README.md`, Simulate).

### Bad

- Behaviour is limited to hand-written rules and hand-set weights. Tuning goes through simulation and owner calls: Focus serves 1.3 to 1.4 times Light's share of cards plus Deepen, so the bar was lowered from 2x to 1.3x; with the real clock a fresh profile gets 28 to 33% fallback reels (`docs/PLAN.md` owner decisions 7 and 9).
- The agent knows the graph (prerequisites, `RELATED_TO`, topics), not what a reel says.
- A change to draw keys or candidate order changes the demo sequence and needs a new seed (`config.ts` comment on `DEMO_SEED`; `npm run simulate -- --find-demo-seed`).
- The lint rule covers the listed globals and imports only; for example `performance.now()` is not banned (a test uses it in `perf.test.ts`).
