# ADR 0006: Zod schemas are the single contract; npm workspaces; packages export TypeScript source with no build step

- **Status:** Accepted
- **Decided:** 2026-10-03 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (decisions 1, 3 and 7; Repo layout), `package.json`, `packages/schemas/`

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- Four programs share data: the pipeline writes reel specs and manifests; the agent and the app read the manifest and the graph; the app writes events and the learner state; the log analysis script reads the events.
- The data crosses boundaries where TypeScript types do not exist at runtime: JSON from a language model, JSON files served over HTTP, a SQLite snapshot, a JSON Lines export.
- The plan made the schemas the first deliverable: "It is the contract every later milestone depends on, and it is what you review first" (`docs/PLAN.md` decision 7).
- One TypeScript version has to work for Expo and the lint toolchain: `~6.0.3` (`docs/PLAN.md` decision 3, environment table).

## Decision

1. **One schema package.** `@reels/schemas` (`packages/schemas/src/`) defines `ReelSpec`, `KnowledgeGraph` (with `graphProblems`), `Manifest`, `LearnerEvent` and `LearnerState` (with `FeedItem`) in Zod 4 and exports the inferred types. Versioned top-level schemas carry `schema_version`, a literal of `SCHEMA_VERSION = 1` (`common.ts:4-5`). Cross-field rules live in the schemas: the graph's validator, claim and item references in a spec, unique reel ids in a manifest.
2. **Parse at every boundary:** the writer's reply (`ReelSpec.safeParse`, `pipeline/src/writer.ts`), the graph (`pipeline/src/content.ts`, `apps/mobile/src/lib/library.ts:9`), the manifest before it is written (`pipeline/src/manifest.ts`) and after the app reads it (`library.ts:60,73`), the saved learner state at app boot (`apps/mobile/src/lib/store.ts:130`), and each exported event line (`pipeline/src/analyze-log.ts`).
3. **One schema for the writer and the validator.** The JSON Schema in the writer's prompt is generated from the Zod schema (`z.toJSONSchema(ReelSpec, { io: 'input' })` in `writer.ts`).
4. **npm workspaces.** The root `package.json` lists `apps/*`, `packages/*` and `pipeline`.
5. **No build step.** Each package points `main`, `types` and `exports` at `src/index.ts`. Metro, Vitest and tsx compile TypeScript directly (`README.md`, `docs/PLAN.md` Repo layout).
6. **Fixtures.** Valid fixtures and tests sit next to the schemas (`packages/schemas/fixtures/`, `schemas.test.ts`, `learner-state.test.ts`); the canary reuses the spec fixture.

## Alternatives considered

- **pnpm workspaces.** Rejected (`docs/PLAN.md` decision 1): npm was already installed, a hoisted layout is what React Native expects, and Expo supports npm workspaces with no Metro configuration.
- **Build each package to JavaScript before use.** Rejected: every consumer already compiles TypeScript, and a build or watch step would sit between every change and every test.
- **TypeScript interfaces without runtime validation.** Rejected: the data arrives as JSON from a model, from HTTP and from SQLite, where a type is only a claim.
- **`zod/mini` in the app.** Rejected (`docs/PERFORMANCE.md` section 5): it saves under 10 kB and would fork the shared schema.
- **JSON Schema as the source of truth.** Not used; it is generated from Zod where a model needs it (decision 3).

## Consequences

### Good

- A schema change shows up as type errors in every workspace in one `npm run typecheck`.
- The writer's instructions and the validator cannot drift apart.
- The pipeline cannot write, and the app will not load, a manifest that breaks the contract: it fails at the boundary with a Zod error instead of deep in the feed.
- No build output to keep in sync; a change to `packages/agent` is live in the app, the tests and the simulator at once.

### Bad

- `SCHEMA_VERSION` is one literal for all schemas, so bumping it invalidates every manifest and every saved learner state at once. The app's snapshot has its own `SNAPSHOT_VERSION` (`apps/mobile/src/lib/db.ts:9`); a mismatch drops the profile and returns to onboarding.
- Events are not validated when the app writes them (`store.ts` `log()` relies on the type). A bad event is found only by `npm run analyze`.
- Five event types are defined but not yet logged by the app: `map_topic_selected`, `map_cell_tapped`, `swipe_frames`, `agent_next`, `replan_ready`.
- Workspace dependencies are partly undeclared: `pipeline` imports `@reels/tokens` and `@reels/fonts` but `pipeline/package.json` lists only `@reels/schemas`, and the app loads the font files by relative path (`apps/mobile/src/lib/theme.ts:21-24`). It works through the links npm creates in `node_modules/@reels/`.
- The manifest records `graph_sha256`, but the app does not compare it with its bundled `graph.json`; reels of concepts the graph does not know are dropped into `catalog.problems` (`packages/agent/src/catalog.ts:146`).
- Pipeline-internal records (`library/reels/<reel_id>/*.json`, ledger lines) are plain TypeScript interfaces (`pipeline/src/store.ts`, `ledger.ts`), read back without validation.
- The packages cannot be published or consumed outside the monorepo without adding a build.
