# AGENTS.md

Instructions for coding agents working in this repo.

## Overview

Adaptive Reels is a demo of an adaptive learning feed: short lesson videos for developers, mixed with retrieval questions, over a 40-concept knowledge graph.
An offline Node pipeline generates, reviews and renders the reels; a pure TypeScript agent picks the next item; an Expo app plays the feed on a phone.
Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first, then the status and owner decisions in [docs/PLAN.md](docs/PLAN.md).

## Setup

- Node 22.13 or newer (`.nvmrc`) and npm. Run `npm install` at the repo root; it installs every workspace.
- `ffmpeg` and `ffprobe` on `PATH`: the pipeline's TTS, render and encode-gate code and its tests call them.
- `.env` holds `DEEPINFRA_API_KEY` and is needed only by paid pipeline stages. Never read, print or commit it; `.env.example` lists the variables.
- `npm run pipeline -- setup` downloads the headless Chrome that Remotion renders with (about 95 MB). Needed for the `layout` and `render` stages, including a dry run of `all`.

## Commands (repo root)

| Command                                       | What it does                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                           | `tsc --noEmit` in every workspace                                                                          |
| `npm run lint`                                | ESLint for packages and pipeline, then the Expo app's own config                                           |
| `npm test`                                    | Vitest over `packages/*/src`, `pipeline/src` and `apps/*/src` (`*.test.ts`)                                |
| `npm run format` / `npm run format:check`     | Prettier, write or check                                                                                   |
| `npm run simulate`                            | Headless agent session trace; flags in `packages/agent/README.md`                                          |
| `npm run pipeline -- --help`                  | Pipeline stages and options                                                                                |
| `npm run pipeline -- all --dry-run --limit 2` | The dry run: fake providers, `fetch` blocked, writes only to `library/dry-run/`, prints the projected cost |
| `npm run analyze -- <log.jsonl>`              | Validates an exported event log against the schema and prints the demo's metrics                           |
| `npm run eval -- --dry-run`                   | The reviewer eval harness with a fake reviewer, offline ([docs/EVALS.md](docs/EVALS.md))                   |

**Paid commands spend real money on DeepInfra:** the pipeline stages `generate`, `review`, `tts`, `images` and `all` without `--dry-run`, `canary`, and `eval` without `--dry-run` or `--replay`. Do not run them unless the owner asks for it in the current session. `layout`, `render`, `gate`, `report`, `serve` and `approve` are offline.

## Running the app

```bash
npm run pipeline -- serve   # the reel library on port 8090 (PORT=... to change it)
npm run mobile              # Metro; open in Expo Go (SDK 57) or press i for the iOS Simulator
```

The app looks for the library on the Metro host at port 8090, or at `EXPO_PUBLIC_LIBRARY_URL` in `apps/mobile/.env.local`. Add native packages with `npx expo install <pkg>` from `apps/mobile`. Read [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md) before using an Expo API; it applies to everything under `apps/mobile`.

## Repo map

| Path                           | What                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/schemas`             | `@reels/schemas`: Zod contract for reel specs, the graph, the manifest, events and the learner state                                                       |
| `packages/agent`               | `@reels/agent`: the pure learning agent; API in its `README.md`; `scripts/simulate.ts`                                                                     |
| `packages/tokens`              | `@reels/tokens`: design tokens and layout maths shared by the app and the reel templates                                                                   |
| `packages/fonts`               | OFL font files shared by the app and the renderer                                                                                                          |
| `pipeline/src`                 | `cli.ts` entry, `run.ts` stages, `writer.ts`, `gates.ts`, `reviewer.ts`, `ledger.ts`, `providers/`, `render/`, `encode-gate.ts`, `manifest.ts`, `serve.ts` |
| `apps/mobile/src`              | `app/` routes, `feed/` (pager, controller, engine, players), `lib/` (store, SQLite, library, downloads), `map/`                                            |
| `content/software-engineering` | `graph.json` and one source card per concept: the only facts a reel may state                                                                              |
| `library/`                     | Pipeline output: MP4s, manifests, report, cost ledger, decisions. Gitignored                                                                               |
| `docs/`                        | Plan, design, architecture, ADRs; index in `docs/README.md`                                                                                                |

## Rules

1. **`packages/agent` stays pure and deterministic.** No `Date.now()`, `Math.random()`, `new Date()` without arguments, and no `node:*`, `react`, `react-native` or `expo` imports (enforced in `eslint.config.mjs`). Time and the seed are parameters. Random choices use `keyedRandom` or `keyedShuffle` with a key that names the purpose plus an ordinal or id; never add RNG state. Return new state objects; never mutate an input.
2. **The app reaches the agent's queue API only through `apps/mobile/src/feed/engine.ts`.** Activation (60% visible) changes play state only; agent calls, logging, player loads and SQLite writes happen at settle.
3. **`packages/schemas` is the contract.** Change the schema first, then its producers, consumers, fixtures and tests, then run `npm run typecheck`. Bumping `SCHEMA_VERSION` invalidates every manifest and saved learner state; the app's snapshot has its own `SNAPSHOT_VERSION` in `apps/mobile/src/lib/db.ts`.
4. **Paid calls only through `CostLedger.charge`** with a worst-case estimate. A new provider implements the interfaces in `pipeline/src/providers/types.ts` and gets a fake in `providers/fake.ts`, so the dry run and the tests keep working offline.
5. **Keep the gate order:** schema parse, G1 (no model), the verbatim quote check, then the reviewer gates G2 to G4; cheapest first, stop at the first failure, all on text before any media. Never move a model check ahead of a deterministic one, and keep every claim tied to a verbatim quote of its source card.
6. **Never commit `.env`, `.env.*` (other than `.env.example`), `apps/mobile/.env.local` or `library/`.** They are gitignored; keep them that way.
7. **Do not edit `apps/mobile/ios` or `apps/mobile/android` by hand.** They are generated from `app.json` by `npx expo prebuild`.
8. **Owner decisions are listed in `docs/PLAN.md`.** Do not reverse one silently; propose a change and record it as an ADR in `docs/adr/`.

## Testing expectations

- Every change to an agent rule (`decide`, `queue`, `mastery`, `interest`, `gap`, `items`, `copy`) comes with a test in `packages/agent/src/*.test.ts`.
- The demo sequence of `docs/UX.md` section 7 is pinned in `packages/agent/src/demo.test.ts` with `DEMO_SEED`. If a change to draw keys or candidate order breaks it, find a new seed with `npm run simulate -- --find-demo-seed`, update `DEMO_SEED` in `config.ts`, and say so.
- Pipeline tests use the fake providers or a scripted reviewer (`gates.test.ts`, `dryrun.test.ts`). No test may call a real provider.
- Before you call a task done: `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check` all pass.
- CI (`.github/workflows/ci.yml`) runs the same checks with no secrets configured, plus a pipeline dry run and the offline eval, and bundles the app.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, for example `fix(agent): keep the committed reel after Later`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`. Scopes: `agent`, `schemas`, `tokens`, `fonts`, `pipeline`, `mobile`, `content`, `docs`. One logical change per commit, and commit only when asked.

## Docs

- [docs/README.md](docs/README.md): index of every document.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the decision records in [docs/adr/](docs/adr/README.md).
- [packages/agent/README.md](packages/agent/README.md): agent API and which call to use for which UI event.
- This file and `apps/mobile/AGENTS.md` are the agent instructions.

## Licences

The repo's own code is MIT ([LICENSE](LICENSE)). The fonts in `packages/fonts/files/` keep their SIL Open Font License 1.1; the licence texts (`*-OFL.txt`) must stay next to them. Terms for the models, Remotion and other third-party parts are listed in `docs/PLAN.md`, section Licences.
