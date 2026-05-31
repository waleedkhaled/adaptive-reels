# ADR 0001: Generate reels offline with human approval, not at request time

- **Status:** Accepted
- **Decided:** 2026-10-03 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (Context, Assumptions, Pipeline design, Risks; plan approved 2026-10-03)

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- The demo must prove one loop on a real phone in about 3 minutes: swipe, the feed adapts, a retrieval check, a delayed review, the map fills in (`docs/PLAN.md` Context).
- A reel is a 20 to 35 s video with narration, captions and a code, flow or text visual (`docs/PLAN.md` decision 6). Making one takes several model calls (writer, up to three reviewer gates, one TTS call per narrated part, images for image visuals), a Remotion render and an ffmpeg audio pass (`pipeline/src/run.ts`).
- The start budget is p95 under 500 ms from activation to playback (`docs/PLAN.md` M3, `docs/PERFORMANCE.md` section 1).
- Accuracy: the source cards are not hand-checked (owner's call, 2026-10-03), so "the reviewer gates and your approve/reject pass in the HTML report are the accuracy checks" (`docs/PLAN.md` Assumptions). The risk table names the owner's approval as the final gate.

## Decision

1. An offline CLI makes every reel ahead of time: `npm run pipeline -- all` runs generate with gates G1 to G4, TTS, images, layout, render, the encode gate and the report over 40 concepts x 3 angles (`pipeline/src/cli.ts`, `pipeline/src/content.ts` `jobsFor`).
2. The output is static files in `library/`: content-hashed MP4s (`reels/<reel_id>/<reel_id>.<sha256[0:12]>.mp4`), `manifest.all.json` (passed the gates and the encode gate), `manifest.json` (the same, approved by the owner) and `report.html` (`pipeline/src/manifest.ts`, `pipeline/src/report.ts`).
3. Human approval: `npm run pipeline -- serve` serves the report on the local network; Approve or Reject, with an optional note, posts to `/api/decisions` and is stored in `library/decisions.json` with the video's sha256 (`pipeline/src/serve.ts`, `pipeline/src/decisions.ts`). `npm run pipeline -- approve` rebuilds `manifest.json`. A decision applies only to the file it was made on (`decisions.ts` `currentDecision`), so a re-render goes back to review.
4. The app never calls a model. It fetches a manifest and MP4 files from a static URL; development builds read `manifest.all.json`, production builds `manifest.json` (`apps/mobile/src/lib/library.ts:13-24`).

## Alternatives considered

- **Generate at request time, per learner or per slot.** Rejected. A generation is several model calls plus a render, which cannot fit the 500 ms start budget; the owner could not see a reel before a learner did; a provider error would reach the feed; and the cost would grow with every learner instead of being paid once.
- **Gates only, no human pass.** Rejected. With unchecked source cards, the plan makes the owner's approval the final accuracy check (`docs/PLAN.md` Risks: "your approval in the report is the final gate").
- **Generate specs offline and render on the phone.** Not possible with this stack: the templates are Remotion compositions rendered by headless Chrome under Node (`pipeline/src/render/render.ts`, `npm run pipeline -- setup`).

## Consequences

### Good

- No model latency, cost or failure inside the learner's loop. The app's only network work is the manifest and the video files, and saved files play offline ([ADR 0008](0008-feed-playback-pager-and-player-pool.md)).
- Every reel the app can play passed G1 to G4 and the encode gate; production builds play only reels approved for that exact file (`manifest.ts` `buildManifest`).
- Cost is paid once and logged per call: M2 produced 119 of 120 planned reels for $3.31 in total (`docs/PLAN.md` status; [ADR 0005](0005-cost-ledger-and-dry-run.md)).
- Hashed file names never change content, so the server can mark videos `immutable` (`serve.ts` `cacheControl`) and the phone can key its file cache on the name (`apps/mobile/src/lib/downloads.ts`).

### Bad

- The library is fixed. Adaptivity means choosing and ordering existing reels; a new concept needs a source card, a pipeline run and a review pass.
- Gaps are permanent until the next run: `llm-unreliable-dependency--example` was never generated, so the app and the agent must handle a concept with 2 reels (`docs/PLAN.md` status).
- The approval pass is a manual bottleneck. As of 2026-10-05 it has not been run (`docs/PLAN.md` status: "Open"), so `manifest.json` lists no reels and a production build shows "No reels yet." unless `EXPO_PUBLIC_REEL_SET=all` (`apps/mobile/src/components/StartError.tsx`, `README.md`).
- Storage and hosting are needed for every reel; the encode gate caps the average bitrate at 900 kb/s at 1080p and the length at 39.5 s (`pipeline/src/video.ts` `VIDEO.gate`).
