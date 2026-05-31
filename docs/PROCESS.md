# How this was built

Adaptive Reels went from an approved plan to a working demo between 2026-10-03 and 2026-10-05. This page describes the working method, how decisions were recorded, and what went wrong along the way. The decisions themselves are in [PLAN.md](PLAN.md) (owner decision tables) and [adr/](adr/README.md).

## Method

- **Plan first, with acceptance criteria.** Every milestone in PLAN.md has written acceptance criteria, risks and dependencies, and was approved before work on it started. A change of scope gets a new plan.
- **Decisions are written down.** Product questions that came up mid-build were answered and logged, with their date, in PLAN.md's owner decision tables. Architectural decisions are ADRs.
- **Contracts first.** Milestone M0 was the Zod schemas and their fixtures ([ADR 0006](adr/README.md)); every later piece was built against them.
- **Paid calls are opt-in and capped.** Every pipeline change ran as a dry run first (fake providers, network blocked). Real runs had a budget cap. The API key lives in a gitignored `.env` and is never printed. The whole library of 119 reels cost $3.31 in model calls.
- **Verify in the real runtime.** Unit tests are not the last word for an app: changes were checked by driving the iOS Simulator (taps, swipes, screenshots), reading Metro's logs, and validating the app's own event log against the schema.

## Techniques that carried the most weight

**A deterministic core.** The learning agent (`packages/agent`) is a pure reducer with seeded draws and no clock of its own, so any session replays exactly. That made two things cheap: a unit test for every rule, and randomized simulations that run hundreds of sessions looking for broken invariants.

**Bugs found by simulation, fixed test-first.** One example: the feed list sometimes held the same reel twice after a fast double swipe (React warned about duplicate keys in Metro's log). Replaying the app's list handling against the real agent over 300 seeded sessions with random flicks reproduced it headlessly and showed the cause: a flick that passed over items let a later item reuse their key. A regression test that failed came first, then the fix in `settle()`, then the simulation again: 0 duplicates in 300 runs. The test is in `packages/agent/src/queue.test.ts`.

**An eval for the model that judges content.** The reviewer model makes accept/reject decisions, so it is measured like a classifier: a golden set of good specs and planted plausible-but-wrong ones, recall and specificity per gate, cost per run, and an offline replay in CI ([EVALS.md](EVALS.md)).

## What went wrong

| What happened                                                                                                                                                                                                                                                                                          | What changed                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| To avoid an Xcode update, `expo-modules-jsi` was patched to build with Swift 6.2. Each fix exposed another Swift 6.3 feature; the attempt stopped after four layers and every file was reverted.                                                                                                       | The install script checks the Swift version first and says to update Xcode. Lesson: stop early when a toolchain gap goes deeper than one layer.  |
| The reviewer passed reels with real errors. `rubber-duck-debugging--example` says code "crashes" where it returns NaN, and 5 of the first 16 passed reels sampled for the eval had defects (mostly deliberately wrong code shown as if it were correct).                                               | The reason the reviewer now has an eval with planted defects ([EVALS.md](EVALS.md)). The flagged reels go to the approve/reject pass.            |
| A health check counted healthy reels as failed: it deleted a reel's first-frame record about 2 s after play, then checked for it at 5 s. Every reel restarted at 5 s, the reload deleted its offline copy, and the second time a "did not load" box covered it. It was found while recording the demo. | The record is kept until the check reads it, eviction drops only the oldest entries, and a moving player clock also counts as proof of playback. |
| Concurrent event-log writes failed with "database is locked" in SQLite.                                                                                                                                                                                                                                | One connection, writes in transactions, a busy timeout, and failed writes go back on the queue.                                                  |
| A review card could show a stale "answered 2 min ago": the text was computed when the card was planned, not when it was shown.                                                                                                                                                                         | The feed asks the agent to refresh a planned card as it scrolls into view (`agent.refreshItem`), with a test.                                    |

## Limits

- The app runs in Expo Go and the iOS Simulator; it is not in an app store, and the phone install waits on an Xcode update.
- The human approve/reject pass over all 119 reels has not happened yet. Until it does, the development build plays every reel that passed the automatic gates.
- Performance numbers come from the iOS Simulator on a Mac, not from a phone ([PERFORMANCE.md](PERFORMANCE.md#10-measured-results)).
