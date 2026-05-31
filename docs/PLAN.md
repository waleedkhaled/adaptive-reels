# Adaptive lesson-reel demo — implementation plan

## Context

Demo of an adaptive learning app: a vertical feed of pre-generated lesson reels for developers that follows the learner's curiosity across a knowledge graph and only counts a concept as learned after a spaced retrieval check. The demo must prove one loop on a real phone in ~3 minutes: swipe → feed visibly adapts → retrieval check → an earlier concept resurfaces for review → mastery heatmap fills in.

Status: plan approved 2026-10-03. M0 done 2026-10-03. M1 done and signed off on a phone 2026-10-04. M2 generated 2026-10-04 (119 of 120 reels passed; $3.31 in total); the one approve/reject pass now runs after the re-render. Design phase done 2026-10-04 ([DESIGN.md](../DESIGN.md), [UX.md](UX.md), [PERFORMANCE.md](PERFORMANCE.md), [research/](research/README.md)); owner decisions recorded below. **Implementation of the app started 2026-10-04.** The reviewer comparison (DeepSeek vs Jev) is still open.

App status 2026-10-05 (iOS Simulator in Expo Go; the new 1080p library):

- **Built and working:**
  - M3 feed and playback.
  - M4: `@reels/agent` (198 tests, demo seed 14) wired in, with reasons, quick actions + Undo, Later and the due timer.
  - M5 cards, re-checks, the demo clock, and the miss cap (owner decision #8).
  - M6: the Matrix + Rail + dock map with its replay, gap sessions, one-card reviews and sample profiles.
  - M7 so far: "Save all for offline" in You (with stale-file cleanup at start), the tester log analysis (`npm run analyze -- <log.jsonl>`), and a phone install script.
- **Verified:** the UX.md §7 demo loop ran end to end in the simulator; the exported event log validates against the schema; reel start p95 198 ms in production-mode JS on the simulator (470 ms in development mode; pass line 500 ms; [PERFORMANCE.md](PERFORMANCE.md#10-measured-results)).
- **Re-render R done:** all 119 reels at 1080 x 1920 through the encode gate (the last 3 needed small content fixes). `llm-unreliable-dependency--example` was never generated (M2).
- **Hardening (2026-10-05):** a reviewer eval with planted defects ([EVALS.md](EVALS.md)), retries with backoff and `Retry-After`, prompt and request provenance on every model call, CI, and the architecture docs and ADRs ([ARCHITECTURE.md](ARCHITECTURE.md)). Two app bugs found while recording the demo were fixed: a health check that restarted every reel at 5 s (and deleted its offline copy), and the You tab scrolling under the status bar.
- **Paused by the owner (2026-10-05):** installing on the iPhone. Expo SDK 57 needs Xcode 26.4 or newer (Swift 6.3); this Mac has Xcode 26.0.1. After updating Xcode: `bash apps/mobile/scripts/install-iphone.sh`. Xcode's account has only a Personal Team, so the app stays signed for 7 days and the phone must trust the developer once.
- **Open:**
  - The approve/reject pass. Flag: `rubber-duck-debugging--example` says the code "crashes at runtime"; reading one past the end returns NaN instead. Also the five reels found while building the eval's golden set ([EVALS.md](EVALS.md#found-while-building-the-set)).
  - Device tests (Android, the 60-swipe spike, performance on a phone).
  - Hosting the library off this Mac for other testers (the phone build reads it from this Mac on the same Wi-Fi, or from its offline copy).

M1 results: 5/5 intro reels passed G1–G4 (one needed its single rewrite), 25–30 s each, $0.093 total ($0.019 per reel; writer 62%, reviewer 29%), so the full library projects to about $3. The G2 canary caught a planted false claim. Kokoro's word timestamps drift up to ~470 ms around sentence pauses, so the TTS stage now re-times words against the audio's own pauses (`pipeline/src/align.ts`); mid-sentence accuracy is about ±100–200 ms against Whisper, which is not ground truth either, so the phone check decides.

Subject change (2026-10-04): the demo now teaches 5 subjects instead of optics: React Native, React and TypeScript, problem solving, AI engineering, and systems design in the age of AI. They are the 5 topics of one "Software engineering in the age of AI" domain (40 concepts, 8 per subject; graph in `content/software-engineering/graph.json`). Optics output is archived in `library/archive-optics/`. Visuals changed with it: optics ray diagrams were replaced by syntax-highlighted `code` snippets (ts/tsx snippets are type-checked in G1, either must compile or, for pitfalls, must fail) and `flow` box-and-arrow diagrams; G2 also asks whether each snippet does what its narration says; G4 checks for insecure practices. Re-validated on 5 reels, one per subject: 5/5 passed (2 after one rewrite), $0.096.

Where the code differs from this plan (the code, [ARCHITECTURE.md](ARCHITECTURE.md) and the ADRs are authoritative):

- Stages skip a reel whose record already exists; they are not cached by content hash.
- Review decisions are saved by `npm run pipeline -- serve` to `library/decisions.json`; `approve` takes no file.
- `DeepSeek-V4.1-Flash` is not in the config.
- The learner state holds no RNG state: every draw is a stateless hash of the seed, a purpose and an ordinal or id, and `next()` became the reducer API in `packages/agent/README.md`.
- The budget cap applies per run, not to total spend.

## Assumptions

- Domain: software engineering for working developers (junior to mid level), 5 subjects as topics. Stack: React Native + Expo. English only.
- Repo lives at `~/Desktop/Projects/adaptive-reels` (working name, easy to rename).
- Source text for the claims gate: **our own "source cards"**, one short numbered fact sheet per concept, drafted by me. Per your call on 2026-10-03, they are not hand-checked for now; the reviewer gates and your approve/reject pass in the HTML report are the accuracy checks. I had planned to use OpenStax _University Physics Vol. 3_, but its licence rules that out (see §Licences).
- I draft the concept graph; you hand-check the prerequisite edges before M2 generates anything.
- One provider account covers almost everything: DeepInfra hosts the writer, reviewer, TTS and image models. OpenRouter is needed only for the optional Jev comparison.
- Media is served from a local static server during development and a static host for the tester build.

## Verified environment and versions (checked today, 2026-10-03)

| Item                   | Finding                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Local tools            | Node 22.22, npm 10.9, git 2.50, ffmpeg 8.0, Xcode 26.0. pnpm not installed.                                                                 |
| Expo                   | SDK 57 (`expo ~57.0.26`), React Native 0.86.3, React 19.2.3. New Architecture always on. SDK 58 is in beta; we stay on 57.                  |
| Xcode gap              | SDK 57 asks for Xcode 26.4+; this Mac has 26.0. Expo Go and EAS cloud builds are unaffected; a local `expo run:ios` needs the Xcode update. |
| expo-video             | Included in Expo Go. Preloading means creating several players and releasing them by hand; no documented player limit.                      |
| TypeScript             | Expo template pins `~6.0.3`; `typescript-eslint` requires `<6.1.0`. TS 7 is out but unusable here.                                          |
| Other                  | Zod 4.6, Vitest 5.0, Prettier 3.9, tsx 4.23, Remotion 4.0.x                                                                                 |
| Expo monorepo docs     | Metro auto-configures for workspaces since SDK 52; npm workspaces supported; duplicate React/RN versions are not.                           |
| Expo template guidance | Use Expo Router with routes in `src/app/`; add native packages with `npx expo install`; read the v57 docs before using any Expo API.        |

Model IDs, prices and licences were read from provider docs and APIs today; see §Models. Nothing was called with an API key, so "supports" means documented, not live-tested.

## Decisions I'm proposing (veto any)

| #   | Proposal                                                                                            | Why                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | npm workspaces, not pnpm                                                                            | Already installed; hoisted layout is what React Native wants; Expo supports it with zero Metro config.                            |
| 2   | Agent is its own package `@reels/agent`, not a folder in the app                                    | Runs under Vitest in plain Node, reused by a headless session simulator. No RN or Node imports allowed in it.                     |
| 3   | TypeScript 6.0.x repo-wide                                                                          | Matches Expo and the lint toolchain.                                                                                              |
| 4   | Remotion for rendering, FFmpeg only for final encode flags                                          | Word-timestamp-driven typography is frame-accurate React in Remotion and painful in FFmpeg filters. Depends on the licence check. |
| 5   | Physics diagrams are drawn by parametric SVG templates; FLUX is used only for non-technical imagery | Image models cannot draw a correct ray diagram, and garble text.                                                                  |
| 6   | Demo reels target 20–35 s (hard cap 60 s)                                                           | With 60 s reels the 3-minute loop fits three reels and cannot show adapt → check → delayed review.                                |
| 7   | M0 includes a v0 of the Zod schemas with fixture tests                                              | It is the contract every later milestone depends on, and it is what you review first. No other logic in M0.                       |

## Repo layout (M0)

```
adaptive-reels/
├─ package.json          workspaces: apps/*, packages/*, pipeline
├─ tsconfig.base.json    strict, noUncheckedIndexedAccess
├─ eslint.config.mjs · .prettierrc · .nvmrc · .gitignore
├─ .env.example          DEEPINFRA_API_KEY, OPENROUTER_API_KEY (optional, Jev only), BUDGET_CAP_USD=10
├─ vitest.config.ts      projects: packages/*, pipeline
├─ README.md             run commands
├─ docs/PLAN.md          this document
├─ packages/schemas/     @reels/schemas — Zod: reel spec, graph, manifest, events, learner state
├─ packages/agent/       @reels/agent — pure TS (placeholder in M0)
├─ pipeline/             @reels/pipeline — tsx scripts (placeholder CLI in M0)
├─ content/software-engineering/  graph.json, sources/*.md source cards (committed inputs)
├─ library/              rendered MP4s, manifest.json, report.html (gitignored)
└─ apps/mobile/          Expo SDK 57 app (exists)
```

Workspace packages export TypeScript source directly (`"main": "src/index.ts"`): Metro, Vitest and tsx all consume it, so there is no build step.

### Schema refinements to your starting shape

- Reel spec adds: `schema_version`; `angle` (`intro | example | pitfall`, the three reels per concept); `key_claims: [{ id, text, source_id, quote }]` so the claims gate checks each claim against a quoted span; `visual.kind` enum `kinetic_text | diagram | image | equation`; retrieval items add `id`, `explanation`, `claim_ids`.
- Manifest (pipeline → app): per reel `url, duration_s, bytes, sha256, captions (word timestamps), retrieval_items, concept_id, angle`. Only human-approved reels appear.
- Graph: nodes `{ id, kind: domain|topic|concept, title, summary }`, edges `{ from, to, type }`. Validator enforces: prerequisite edges form a DAG, every concept is PART_OF exactly one topic, RELATED_TO is symmetric, no dangling ids.
- Events (discriminated union): `session_start, onboarding_done, reel_impression {pool, reason}, reel_end {watched_ms, duration_ms, loops, outcome}, quick_action, card_shown, card_answered {correct, latency_ms, box_before, box_after, scheduled_gap_ms, actual_gap_ms, is_delayed}, mode_changed, clock_changed, gap_session_started`. These answer your two questions directly: do testers keep swiping, and do they get delayed reviews right.
- Learner state: interest maps, per-concept mastery record, recent history, settings, RNG state. Plain JSON.

## Pipeline design

Stages are idempotent and cached by content hash, so reruns only pay for what changed.

1. **generate** — writer LLM gets the concept node, its source card and the template catalogue, returns reel spec JSON; Zod-parse, up to 2 repair retries.
2. **review gates**, cheapest first, fail fast:
   - G1 schema and lint (deterministic): Zod, words vs target duration, on-screen text length, valid `answer_index`, distinct choices, narration free of symbols TTS cannot read.
   - G2 claims vs source (reviewer LLM): each claim supported / unsupported / contradicted with quoted evidence; narration makes no claim missing from `key_claims`.
   - G3 pedagogy rubric: hook, one idea per reel, concrete example, question tests the concept, plausible distractors.
   - G4 safety: insecure practices shown without a warning (secrets in code, eval of model output, SQL from user input), inappropriate content, risky image prompts.
3. **tts** — Kokoro narration plus word timestamps.
4. **images** — FLUX schnell, only for `image` visuals.
5. **render** — Remotion template per `template`, H.264 MP4, 720×1280, AAC, faststart.
6. **manifest + report** — single static HTML report: video, spec text, gate verdicts, cost, approve/reject per reel. Decisions export as `decisions.json`; `pipeline approve decisions.json` writes the final manifest.

Cross-cutting: every provider behind an interface (`LLM`, `Reviewer`, `TTS`, `ImageGen`), model IDs and prices in one config file; a cost ledger logs cost per call and per reel (using the cost the provider returns, falling back to tokens × configured price) and halts before any call that would cross the cap (default $10); `--dry-run` swaps in fixture providers and makes zero network calls; `--limit 5` for M1.

**Reviewer interface is shaped as typed questions, not text.** Jev is not a chat model: you send a state plus named questions of type `choice`, `score` or `noul` (yes/no), and get typed answers with probabilities. So every gate is written once as a set of typed questions (claim → `choice: supported | unsupported | contradicted`; rubric items → `score`; safety → `noul`). The Jev backend sends them as they are; the DeepSeek backend answers the same questions through JSON-schema output. Both run on a labelled set, and the report compares each against your labels: agreement, precision and recall on "reject", plus a calibration table for Jev's probabilities. Jev returns no explanations, so DeepSeek stays the default and supplies the quoted evidence shown in the report.

## Models (from provider docs, 2026-10-03)

| Role            | Model ID                                     | Price                              | Notes                                                                                                  |
| --------------- | -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Writer          | DeepInfra `zai-org/GLM-5.2`                  | $0.56 in / $1.80 out per 1M tokens | JSON mode listed. GLM-5.3 exists at about 2.5× the price; not needed.                                  |
| Reviewer        | DeepInfra `deepseek-ai/DeepSeek-V4-Pro-0813` | $1.30 in / $2.60 out per 1M        | Different family from the writer. `DeepSeek-V4.1-Flash` ($0.20 / $0.60) is the cheap option in config. |
| Second reviewer | OpenRouter `typesafe/jev-1.13`               | $0.042 per 1M input, output free   | `POST /api/alpha/decisions`; 32k context; English-first; alpha endpoint, may change.                   |
| TTS             | DeepInfra `hexgrad/Kokoro-82M`               | $0.62 per 1M characters            | `return_timestamps: true` returns word start/end times, so no separate alignment step.                 |
| Images          | DeepInfra `black-forest-labs/FLUX-1-schnell` | $0.0005 per 1024² image            |                                                                                                        |

Estimated cost from these list prices: about $0.03 per reel, so roughly $0.15 for the 5-reel run and $4–6 for 150 reels including rework. That fits under the $10 cap, with the ledger as the real check.

Not yet verified: JSON-schema output for GLM-5.2 on DeepInfra specifically (inferred from OpenRouter's metadata); Jev rate limits through OpenRouter. Both get tested in the first hour of M1, and I re-read the Jev API reference when integrating it.

## Owner decisions (2026-10-04)

| #   | Question                                                                                | Decision                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Paid Apple Developer account; App Store / TestFlight                                    | Account exists; App Store and TestFlight work is deferred. Develop in Expo Go; keep Expo Go auto-update off on test phones until an EAS development build replaces it. |
| 2   | The "Status Board" look, typefaces and the reel re-render                               | Approved                                                                                                                                                               |
| 3   | Sound default                                                                           | **Sound on by default**; a labelled Sound control turns it off and the choice persists                                                                                 |
| 4   | Quiz rules: select then "Check answer"; pager locked on an unanswered question; "Later" | Approved                                                                                                                                                               |
| 5   | Reel resolution                                                                         | **1080 x 1920**                                                                                                                                                        |

Everything else in UX.md section 10 and DESIGN.md "Open decisions" takes the recommended default. The changes below come from UX.md section 9 and PERFORMANCE.md section 9; those sections hold the detail.

## Owner decisions from the agent build (accepted 2026-10-05: "continue until the end")

| #   | Question                                                                                          | Decision                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Strip copy when no unplayed angle is left for a reteach                                           | "Same reel again. Your last answer here was wrong." (in the copy deck)                                                                                                                                                                                     |
| 7   | M6 acceptance "Focus serves at least 2x Light's cards + Deepen" (measured 1.3-1.4x over 40 slots) | Bar lowered to 1.3x; the PLAN weights stay                                                                                                                                                                                                                 |
| 8   | Repeated wrong answers looped reteach and re-check about every 45 s on the demo clock             | Cap: the second wrong feed answer on a concept in a session rests it (no reteach, no card) until the next session; the line reads "Moving on. It comes back next session." The map can still start it; gap-session misses don't count. `RULES.missCap = 2` |
| 9   | Real clock, fresh profile: 28-33% fallback reels                                                  | Accepted for now: the demo runs on the demo clock                                                                                                                                                                                                          |
| 10  | The honesty gap raises demo-clock fallbacks in Focus from 4.5% to 11.8%                           | Kept: it removes "a reel right before its own review" (18 cases to 0)                                                                                                                                                                                      |

## Milestones

Dependency order: M0 → M1 → M2. M4's agent core can start right after M0 (pure TS on a fixture graph) and M3 right after M1 (needs only 5 real reels). M3 + M4 → M5 → M6. M7 needs M2 and M6.

| M   | Scope                          | Size | Depends on                                      |
| --- | ------------------------------ | ---- | ----------------------------------------------- |
| M0  | Setup                          | S    | —                                               |
| M1  | Pipeline on 5 reels            | L    | M0, DeepInfra key (in place), 2–3 source cards  |
| M2  | Full library and review report | L    | M1, your sign-off on the 5 reels, checked graph |
| M3  | Feed and playback              | M    | M0, M1                                          |
| M4  | Signals and agent              | M    | M0 (core), M3 (wiring)                          |
| M5  | Retrieval and demo clock       | M    | M4                                              |
| M6  | Dashboard and modes            | M    | M5                                              |
| M7  | Polish and tester build        | M    | M2, M6                                          |

**M0 Setup.** Tasks: root workspace, TS/ESLint/Prettier/Vitest config, `@reels/schemas` v0 with valid and invalid fixtures, placeholder entry points for agent and pipeline, app imports one constant from schemas, `.env.example`, README, this plan in `docs/`.
Accept: `npm run typecheck`, `npm run lint`, `npm test` all pass; `npx expo export` bundles the app including the workspace import; `npm run pipeline -- --help` lists the stages; only `.env.example` is tracked.

**M1 Pipeline on 5 reels.** Tasks: provider interfaces and config; cost ledger, budget cap, dry-run; writer; gates G1–G4; TTS and word timing; two Remotion templates (kinetic text, diagram); encode; manifest; report v1.
Accept: dry-run makes zero network calls and prints a cost estimate; the real run yields 5 MP4s under 60 s that play on a phone with captions within 100 ms of the audio; the report shows gate verdicts and cost per reel; a spec with a planted false claim is rejected by G2; a test proves the run halts at the cap.

**M2 Full library and report.** Tasks: source cards for the remaining 35 concepts (version-sensitive facts checked against current docs); three angles per concept; remaining templates (3–4 total); resume and caching; report v2 with approve/reject and decisions export; reviewer comparison on about 30 labelled specs including planted errors.
Accept: every concept has at least 2 approved reels and 3 retrieval items; graph validator passes; total cost under the cap and logged per reel; comparison table (DeepSeek vs Jev vs your labels) produced.

**R Re-render to the safe-zone contract (new, before M3 UI polish).** Tasks: shared `packages/tokens` and `packages/fonts`; Remotion templates on the Status Board look (flat `#181612` ground, Barlow Semi Condensed + JetBrains Mono NL, no baked chip or progress bar, text inside the safe zone, code floor 26 px); 1080 x 1920 output, BT.709 tagging, mono AAC with loudness normalisation; hashed file names; the encode gate as a stage; manifest gains `transcript`, `on_screen_text` and `code`; render 5 test reels, then all 119; then the one approve/reject pass.
Accept: the encode gate passes on every reel; the 5 test reels play on the phones.

**M3 Feed and playback.** Tasks: Expo Router migration and `app.json` baseline (dark, React Compiler, typed routes); shared fonts and tokens; custom tab bar (Feed, Map, You); onboarding topic picker; FlatList pager with chrome outside the picture; a pool of 3 `expo-video` players keyed by video ordinal plus a disk download queue; running head, concept panel with transcript, Sound control (on by default), paused mark; manifest loader; local profile in Zustand; expo-sqlite event log with export through the share sheet; loading, offline and error states.
Accept, on a real phone: p95 time from activation to playback under 500 ms over 50 swipes; at most 3 decoders; audio never overlaps; exported log validates against the event schema; state survives backgrounding.

**M4 Signals and agent.** Tasks: implement the spec below with the amendments of UX.md section 9 (queue re-plan, keyed random draws, quick actions with Undo, exposure rules, no-repeat filter, honesty gap, demo clock); fixture graph and unit tests; `npm run simulate` prints a session trace; a test pins the demo sequence of UX.md section 7; wire into the feed; the reason strip and reason panel; quick actions that name the next item, with Undo; the changed marker; agent budget measured on the phones.
Accept: agent tests pass with at least 90% line coverage; in simulation a "likes lenses" persona gets at least twice the lens share of a "skips lenses" persona over 30 slots; on the phone "More like this" changes the next reel and the chip says why; a watch-only session leaves mastery untouched.

**M5 Retrieval and demo clock.** Tasks: card UI (select then "Check answer", "Later", pager lock, 3 options at box 0 and 4 from box 1) with feedback and explanation; the progress panel; the item rule; mastery update; scheduler with both interval tables; demo clock setting (also switches to Focus); cadence and overdue guard; reteach and prove-it flows.
Accept: with the demo clock on, a correctly answered concept returns as a review card 60–120 s later; a correct delayed answer marks it learned; a wrong answer leads to a reteach reel then a re-check; the log records scheduled vs actual gap; headless end-to-end test passes.

**M6 Knowledge map and modes.** Tasks: the Matrix + Rail + dock map as a pushed route (UX.md 3.5), with the replay after an answer; tap a concept to start a gap session (UX.md 3.6); Light/Focus in You; the pool lead word and glyph in the reason strip so the mix is visible; sample profiles; the device checklist.
Accept: the map updates immediately after an answer and replays the change when opened; a gap session serves the prerequisite chain, the target, then a check; over 40 simulated slots Focus serves at least 1.3 times Light's share of cards plus Deepen (owner decision #7).

**M7 Polish and tester build.** Tasks: full library on a static host with immutable caching headers; EAS internal build (App Store and TestFlight deferred by the owner); demo script (UX.md section 7); offline and missing-media states; reset profile; log analysis script (reels per session, skip rate, delayed-review accuracy); Maestro smoke flow; performance pass.
Accept: the definition of done, run on a real phone by a fresh profile in about 3 minutes; three testers install unaided; their exported logs load in the analysis script.

## Agent spec (for your review)

`next(state, graph, manifest, config, now) → { item, pool, reason, state' }`. Pure: clock and seeded RNG are inputs; `Date.now` and `Math.random` are lint-banned in the package.

### Interest (moves only from behaviour)

`I(c) = clamp01(topicInterest[topic(c)] + conceptOffset[c])`. Onboarding sets the prior: picked topics 0.7, others 0.3.

| Signal         | Definition                | Concept                       | Topic | RELATED_TO neighbours |
| -------------- | ------------------------- | ----------------------------- | ----- | --------------------- |
| Completed      | watched ≥ 90%             | +0.05                         | +0.03 | +0.02                 |
| Rewatch        | an extra loop ≥ 50%       | +0.10                         | +0.05 | +0.03                 |
| Early skip     | left before min(25%, 5 s) | −0.10                         | −0.05 | 0                     |
| Partial        | anything else             | 0                             | 0     | 0                     |
| More like this | tap                       | +0.25                         | +0.15 | +0.10                 |
| Not for me     | tap                       | −0.40, hidden for the session | −0.15 | 0                     |
| Too easy       | tap                       | 0                             | 0     | 0                     |

Amendments adopted 2026-10-04 (UX.md section 9, items 1 to 11) take precedence over this section where they differ. "Too easy" never grants mastery. It queues an immediate "prove it" card and makes the next reel for that concept the `pitfall` angle.

### Mastery (moves only from retrieval answers)

Per concept: `box 0–4`, `dueAt`. Intervals after reaching a box:

|            | retry after wrong | box 1  | box 2 | box 3  | box 4  |
| ---------- | ----------------- | ------ | ----- | ------ | ------ |
| Real clock | 1 min             | 10 min | 1 day | 3 days | 7 days |
| Demo clock | 20 s              | 60 s   | 3 min | 6 min  | 12 min |

- Correct at box 0 → box 1. Correct at box ≥ 1 on or after `dueAt` → box + 1. Correct before `dueAt` → no promotion.
- Wrong → box − 1 (floor 0), due after the retry interval, reteach reel queued (a different angle).
- **Learned means box ≥ 2**, which needs at least one correct delayed answer. Only learned concepts unlock dependents. Unlocks are sticky.
- A concept's first check comes at least one reel after its exposure.

### Slot procedure (first match wins)

1. Reteach reel if the last card was wrong.
2. Prove-it card if "Too easy" was tapped.
3. Overdue guard: a due review has waited past the mode's limit → review card.
4. Cadence: enough reels since the last card → card (due review first, else oldest pending first check).
5. Echo: previous reel got "More like this" → nearest related or sibling concept.
6. Change of pace: two early skips in a row → Explore.
7. Weighted draw over non-empty pools; take the top-scored candidate, ties broken by seeded RNG.

### Pools

| Pool    | Members                                                                                                                                              | Score                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Review  | box ≥ 1 and due                                                                                                                                      | how overdue, relative to its interval                  |
| Deepen  | not learned, all prerequisites learned (roots always qualify), `I(c) ≥ 0.5`                                                                          | `I(c)` + 0.2 if just unlocked + 0.1 if already started |
| Explore | unlocked concepts in topics with ≤ 1 reel seen and topic interest > 0.15                                                                             | least-seen topic first, + 0.25·`I(c)`                  |
| Lateral | RELATED_TO neighbours of concepts liked in the last 5 reels; if a neighbour is locked, substitute its first unlocked unmet prerequisite (a "bridge") | interest in the source × recency                       |

Filters on every pool: no concept twice within 3 reels (reteach excepted), no reel twice per session, hidden concepts excluded. Empty pools give their weight to the rest. If all are empty, serve the least recently seen unlocked reel, so the feed never dead-ends.

### Default weights per mode

| Mode  | Review | Deepen | Explore | Lateral | Card every | Overdue guard  |
| ----- | ------ | ------ | ------- | ------- | ---------- | -------------- |
| Light | 0.15   | 0.25   | 0.35    | 0.25    | 4 reels    | within 2 slots |
| Focus | 0.35   | 0.45   | 0.05    | 0.15    | 2 reels    | next slot      |

### Reasons ("why this reel")

Each decision carries a code and parameters; the app renders the text. `REVIEW_DUE` "Review: you learned {concept} {elapsed} ago" · `FIRST_CHECK` · `RETEACH` "Another angle on {concept}" · `PROVE_IT` · `DEEPEN_UNLOCKED` "Unlocked by {prereq}" · `DEEPEN_INTEREST` "Going deeper into {topic}" · `EXPLORE_NEW` "New topic: {topic}" · `LATERAL_RELATED` "Related to {concept}" · `LATERAL_BRIDGE` "Builds toward {target}" · `MORE_LIKE_THIS` · `CHANGE_OF_PACE` · `GAP_SESSION` · `FALLBACK`.

### Gap session (dashboard tap)

Targets are the concept's unlearned prerequisites in topological order, then the concept. Each gets an intro reel, one intervening item, then a card. Ends after the target's first correct check or 6 items, then returns to the previous mode.

### Prefetch vs adaptivity

The agent keeps a provisional queue of 3. A quick action re-plans the very next slot (the current reel is still playing, so there is time to fetch). A skip re-plans from the slot after next, so the already-buffered reel is not wasted.

## Test plan

- **Fixture graph**: 12 concepts in 3 topics, containing a depth-3 prerequisite chain, a diamond, cross-topic RELATED_TO edges and one isolated root; fixture manifest with 3 reels and 3 retrieval items per concept.
- **Agent unit tests**: pool membership; weight renormalisation when pools are empty; draw distribution over 10k seeded slots within ±2% of the weights for each mode; same seed gives the same sequence; no-repeat and hidden-concept filters; bridge substitution; rule priority order; a reason code on every decision; the feed never returns nothing.
- **Mastery unit tests**: table-driven over (box, correct, early/on time); invariant test that any sequence of watch and quick-action events leaves mastery byte-identical.
- **Scheduler unit tests**: due times under both interval tables with a fake clock; overdue guard; lapse and reteach; no promotion on early answers.
- **Schema and graph tests**: valid and invalid fixtures; validator rejects cycles, orphans, asymmetric RELATED_TO.
- **Pipeline tests**: gates against good and deliberately bad specs with mocked providers; budget cap halts; dry-run makes no provider calls; ledger totals add up.
- **End-to-end smoke of the demo loop**: headless simulation in Vitest with a scripted learner and fake clock asserting, within 180 simulated seconds and in order: an interest change alters the next pick, a first check appears, the same concept returns as a delayed review, its heatmap level becomes learned. In M7 the same path runs on a device as a Maestro flow, plus a written manual demo script.

## Risks

| Risk                                                              | Mitigation                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Source cards are only as good as their check                      | Cards are short numbered facts; you verify them once, before any generation                          |
| Word timestamps from DeepInfra Kokoro are documented but untested | First task of M1; Whisper alignment is the fallback                                                  |
| Jev runs on an alpha endpoint                                     | Optional backend behind the interface; the pipeline never depends on it                              |
| Xcode 26.0 is below what SDK 57 wants                             | Develop in Expo Go, build with EAS; update Xcode only if a local native build is needed              |
| Reviewer passes subtly wrong physics                              | Claims tied to quoted source spans; planted-error set; your approval in the report is the final gate |
| 3-minute demo budget is tight                                     | 20–35 s reels, demo interval table, overdue guard guarantees the review shows up                     |
| Prefetch fights adaptivity                                        | Re-plan rule above; measure start latency in M3                                                      |
| Player limits on Android (concurrent decoders)                    | Small player pool, test on a mid-range Android early in M3                                           |
| TTS mispronounces symbols and units                               | G1 bans symbols in narration; pronunciation overrides in config                                      |
| Strict prerequisite gating starves pools on a small graph         | Bridge rule, weight renormalisation, fallback; simulate before wiring UI                             |
| Human review time (up to 150 reels)                               | Report sorted by lowest gate scores; review text before rendering                                    |
| Requested models missing or renamed                               | Interfaces plus config; verification table before M1                                                 |
| iOS tester distribution needs a paid Apple account                | Android APK first; iOS via Expo Go or TestFlight depending on your account                           |

## Licences

Checked today:

| Item                               | Finding                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenStax University Physics Vol. 3 | **Not usable.** CC BY-NC-SA, and the book states it may not be "ingested into large language models or generative AI offerings without OpenStax's prior written permission".             |
| Kokoro-82M                         | Apache-2.0                                                                                                                                                                               |
| FLUX.1 schnell                     | Apache-2.0 weights, commercial use allowed; the model card is silent on output ownership                                                                                                 |
| Remotion 4.0                       | Free for individuals and companies of up to 3 people; larger companies need a paid licence ($25/month per seat or $0.01 per render, $100/month minimum). Terms are due to change in 5.0. |
| Jev                                | Proprietary, hosted only; the customer agreement itself is unread                                                                                                                        |

Still to verify before M2: DeepInfra's terms for commercial use of GLM-5.2 and DeepSeek outputs; fonts (plan: OFL families only); music (plan: CC0 or explicitly licensed tracks, with proof of licence kept in `content/`).

## Open questions for you

1. ~~Source text~~: answered 2026-10-03: source cards, no hand check for now.
2. Tester phones: iOS, Android or both, and do you have an Apple Developer account?
3. Is 20–35 s per reel acceptable for the demo?
4. Are you a solo developer or a company of up to 3 for the Remotion free tier?
5. Agent spec: are "Too easy → prove-it card", the Lateral bridge rule and "learned = box ≥ 2" what you want?
6. How many specs will you label by hand for the reviewer comparison (I suggest about 30)?

None of these block M0. Question 1 blocks M1; 2–4 block M2, M3 and M7 respectively.

## Verifying M0

From the repo root: `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run pipeline -- --help`. From `apps/mobile`: `npx expo export --platform ios`, which proves Metro resolves the workspace package.
