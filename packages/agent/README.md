# @reels/agent

The on-device learning agent: a pure, deterministic TypeScript module that decides what the feed shows next (reels, retrieval cards, a session summary), moves interest from behaviour and mastery from answers, and gives the app everything it needs for reasons, the knowledge map and gap sessions.

- Spec: `docs/PLAN.md` "Agent spec", amended by `docs/UX.md` section 9; the queue contract is `docs/PERFORMANCE.md` 2.5.
- Pure: no clock, no `Math.random`, no Node or React Native imports (lint-enforced). `now` (epoch ms) and the seed are inputs. Every random draw is a function of `(seed, ordinal, purpose)`, so a re-plan from unchanged state repeats its picks.
- The learner state is plain JSON, validated by `LearnerState` in `@reels/schemas` (`packages/schemas/src/learner-state.ts`). Updates are structurally shared: only changed entries are new objects.
- Every call that changes the plan returns a `Step`: `{ state, active, upcoming }`. `upcoming` is the planned tail after the item on screen: cards first (placed directly after the active item), then the committed reel, then 2 provisional items. Replace the unplayed tail of the list with it.

```ts
import { buildCatalog, createProfile, startSession, settle, DEMO_SEED } from '@reels/agent';

const catalog = buildCatalog(graph, manifest); // once per manifest
let state = createProfile({
  profileId: 'local',
  now: Date.now(),
  seed: DEMO_SEED,
  topicIds: ['react-native'],
  mode: 'focus',
  clock: 'demo',
});
let step = startSession(state, catalog, Date.now()); // slot 0 planned and settled
```

## Which call for which UI event

| UI event                                                          | Call                                                                                                | Persist / log                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Onboarding done, cold start, back after 30 min (`sessionExpired`) | `createProfile` (first time), then `startSession`                                                   | `session_start`, `reel_impression` / `card_shown` for `step.active`                                                      |
| Activation (60% visible)                                          | nothing                                                                                             |                                                                                                                          |
| Settle on a new item                                              | `settle(state, catalog, item, now, { ended })` with the reel being left in `ended`                  | `reel_end` from `step.ended`, then `reel_impression` / `card_shown` for `step.active` (its reason params are fixed here) |
| Settle on an item already shown (swipe back)                      | `settle` returns `revisit: true` and changes nothing: keep the tail                                 | `reel_impression { revisit: true }`                                                                                      |
| The single due timer fires                                        | `plan(state, catalog, now)`; re-arm with `nextDueAt(state, now)`                                    |                                                                                                                          |
| "More like this" / "Too easy" / "Not for me"                      | `quickAction` → `confirmation` names the next reel                                                  | `quick_action`                                                                                                           |
| "Undo" (4 s, or until the swipe)                                  | `undoQuickAction`                                                                                   | `quick_action_undone`                                                                                                    |
| "Check answer"                                                    | `answerCard(state, catalog, { key, choiceIndex }, now)` with the authored choice index              | `card_answered` from `result` (`box_before`, `box_after`, gaps, `options_order`, `source`)                               |
| "Later", or a card flicked past before it settled                 | `deferCard(state, catalog, card, now)`                                                              | `card_deferred`                                                                                                          |
| Mode / demo clock (You tab)                                       | `setMode`, `setClock` (`rescaledConceptIds` for `clock_changed`)                                    | `mode_changed`, `clock_changed`                                                                                          |
| Session ends while away (impression still open)                   | `reelEnded(state, catalog, { key, watchedMs, loops, endedBy: 'blur' }, now)`, before `startSession` | `reel_end { ended_by: 'blur' }`                                                                                          |
| A reel failed to load and the learner taps "Skip"                 | `settle(..., { ended: { ..., endedBy: 'skip_failed' } })`                                           | `reel_load_failed`                                                                                                       |
| Map: open, select, start                                          | `displayState`, `railOrder`, `suggestions`, `gapPlan`, `copy.dockContent`; `startGapSession`        | `map_opened`, `gap_session_started`                                                                                      |
| Map closed (after the replay)                                     | `markMapSeen`                                                                                       |                                                                                                                          |
| Gap session ends ("Back to feed", "Leave", back)                  | `leaveGapSession`                                                                                   | `gap_session_ended { reason: step.ended }`                                                                               |

Persist `step.state` (one snapshot) after each of these. The catalog is derived and never persisted. The app keeps its own `slots` list; `state.queue` only remembers the item on screen and the committed reel.

## API

### Catalog

`buildCatalog(graph: KnowledgeGraph, manifest: Manifest): Catalog` builds the lookup indices once: topics with short titles and rail order, concepts with prerequisites, dependents, RELATED_TO neighbours, ancestors and reels in angle order (a concept may have 2 reels), reels with durations and retrieval items, and `reelCount`. Manifest reels of unknown concepts are skipped and listed in `catalog.problems`.

`railOrder(topicId, catalog): RailRow[]`: UX.md 3.5 "Order": `{ conceptId, level, parentId, needs, implied, stub }`. `needs` are the "+ needs" lines, `stub` the dashed inbound stub of a concept whose prerequisites are all in other topics.

```ts
railOrder('react-native', catalog).map((r) => r.conceptId); // Core components, Flexbox layout, Lists and virtualization, Performance and re-renders, ...
```

### Profile and session

`createProfile({ profileId, now, seed, topicIds?, skipped?, mode?, clock?, modeBeforeDemo? }): LearnerState`: priors 0.7 picked / 0.3 others, 0.5 everywhere after Skip (or an empty pick). Default mode Light, or Focus with the demo clock. Pass `DEMO_SEED` for profiles created under the demo clock (and on Reset with the demo clock on).

`startSession(state, catalog, now): Step`: a new session (empty history, no hidden concepts, no pending rule items), with slot 0 planned and settled. `sessionExpired(state, now)` is true after 30 minutes without activity.

`sampleProfile('fresh' | 'day3' | 'week2', profileInput, catalog): LearnerState`: UX.md 3.8 fixtures, due times as offsets from `now`, marked `sample`.

### The feed queue

`plan(state, catalog, now, trigger = 'keep'): Step`: re-plan with the current `now`. `'keep'` keeps the committed reel (due timer, correct answer, "Later", Undo); `'explicit'` re-picks it (the calls below use it for quick actions, wrong answers, mode, clock and gap-session changes).

`settle(state, catalog, item, now, { ended? }): SettleStep`: the scroll settled on `item` (one of the planned items). Closes the reel in `ended` first, applies `shown`, re-plans. Render `step.active`: a card's elapsed time and "reels ago" are fixed at settle. A flick that passed over the committed reel drops it.

```ts
const s = settle(state, catalog, upcoming[0], now, { ended: { key: reel.key, watchedMs, loops } });
log('reel_end', { outcome: s.ended?.outcome }); // completed | partial | early_skip
```

`reelEnded(state, catalog, { key, watchedMs, loops, durationMs?, endedBy? }, now): ReelEndResult`: one interest signal per impression: Completed (watched ≥ 90%), Rewatch (≥ 150%, replaces Completed), Early skip (no loop and under min(25%, 5 s)), Partial. `skip_failed` and `blur` change no interest; "Not for me" voids the impression's signals. Exposure (Seen, eligible for a first check one reel later) on any end that is not an early skip; never for `skip_failed`. A second call for the same key is ignored.

`quickAction(state, catalog, { key, action }, now): QuickActionStep`: on the reel on screen. `confirmation` has `next`, `nextReel`, `cardFirst` ("Next: X" or "After the question: X"), `countdownMs` (Too easy on a Checked concept that is not due) and `topicId` ("Less {topic}"). A second tap on the same reel replaces the first.

```ts
const q = quickAction(state, catalog, { key: active.key, action: 'more_like_this' }, now);
copy.plain(copy.confirmationText(q.confirmation, catalog)); // "Next: Components and props."
```

`undoQuickAction(state, catalog, { key }, now): Step`: restores interest, hidden state, the pending prove-it and echo, and the committed reel.

`answerCard(state, catalog, { key, choiceIndex }, now): AnswerStep`: `choiceIndex` is the authored index (`card.options[shownIndex]`). `result` = `{ correct, boxBefore, boxAfter, levelBefore, levelAfter, unlocked, scheduledGapMs, actualGapMs, isDelayed, nextDueAt, early, promoted, proveIt, retry, reteach, rested, optionsOrder, source, gapEnded }`. A wrong answer puts the reteach reel next (`reteach.replay` = no unplayed angle left). The second wrong feed answer on a concept in a session sets `rested`: no reteach, and no card for that concept until the next session (`RULES.missCap`, owner decision #8).

```ts
const a = answerCard(state, catalog, { key: card.key, choiceIndex: card.options[selected] }, now);
copy.progressConsequence(a.result, catalog, state.settings.clock, now); // "Back in about 1 min. Correct then: Learned."
```

`deferCard(state, catalog, card, now): Step`: "Later". No mastery or interest change; the card skips cadence and the overdue guard for 2 reels, then returns with its original sentence (`trigger: 'later'`).

`setMode(state, catalog, mode, now): Step` and `setClock(state, catalog, clock, now): ClockStep`: the demo clock stores the mode and sets Focus; switching it off restores the stored mode; both rescale every pending due time from the answer that scheduled it.

`nextDueAt(state, now): number | null`: the earliest due time after `now`, for the one timer (`now` is needed so an already-due review never re-arms an immediate timer).

`next(state, catalog, now)` and `shown(state, catalog, item, now)`: the single-slot decision and its reducer, used by `plan` (exported per PERFORMANCE.md 2.5).

### Items

Every item has `kind` (`'reel' | 'card' | 'summary'`), a unique stable `key`, `conceptId`, `pool` (null when a slot rule chose it) and `reason: { code, params }` with string params (`concept`, `topic`, `prereq`, `target`, `source`, `cause`, `seen`, `box`, `retry`, `elapsed_ms`, `reels_ago`, `later_reels`, `due_at`, `step`, `steps`, `replay`, and `trigger`: `more_like_this | too_easy | not_for_me | skips | wrong_answer | later`). Reels add `reelId`, `angle`, `ordinal`, `durationMs`; cards add `itemId`, the source `reelId`, `box`, `proveIt`, `retry` and `options` (authored choice indices in the order to show: 3 at box 0, 4 from box 1). Summary items carry `summary` and have `reason: null`. Gap-session items add `gap: { index, total }` ("Item 2 of 6") and `source`.

### Map

`displayState(conceptId, state, catalog, now): { level, locked, due, justUnlocked }`: level `none | seen | checked | learned | retained` (Learned = box 2, Retained = box 3-4); unlocks are sticky; due only from Checked up; `justUnlocked` until the next `markMapSeen`.

`suggestions(state, catalog, now, limit = 3): Suggestion[]`: due now, then just opened, then "opens the most" (ties: topic interest, then rail order): `{ conceptId, kind: 'due' | 'new' | 'opens', opens }`.

`gapPlan(targetId, state, catalog, now): GapPlan`: `{ kind: 'gap' | 'review' | 'rewatch' | 'none', pins, steps, items, reachesTarget, stop, blockedBy, firstStep }`, cut to whole steps within 6 items.

```ts
gapPlan('rn-performance-rerenders', state, catalog, now); // pins: Lists, Components and props, State, Memoization, itself; 6 items, stop 'cap'
```

`startGapSession(state, catalog, { targetId, source? }, now): GapStep` and `leaveGapSession(state, catalog, now): LeaveGapStep` (`ended`: `target_checked | plan_done | wrong_at_cap | left`). While a session runs, `plan`, `settle`, `reelEnded` and `answerCard` serve it.

`markMapSeen(state, catalog, now)`, `mapChanges(state, catalog)` (`levelChanged`, `seenAdded`, `unlocked`, `stagedTopicId` for the replay) and `mapCounts(state, catalog, now)` ("1/40 learned", "{n} watched", per topic learned, open, due).

### Copy (`copy.*`)

Pure functions that return the exact strings of UX.md 5.1 to 5.5, 3.2, 3.3 and 3.7. Sentences come back as segments, `[{ text: 'Unlocked by ' }, { text: 'Core components', strong: true }, { text: '.' }]`, so the app can set the cause in `text.primary`.

```ts
copy.leadWord(item); // 'Review' | 'Deepen' | 'Explore' | 'Lateral' | null
copy.reasonSentence(item.reason, catalog, item.kind); // the strip sentence
copy.reasonDetail(item.reason, catalog, { now, nextDueAt }); // the reason panel lines
copy.triggerLine(item.reason); // "You tapped Later 2 reels ago." and the other trigger lines
copy.changedMarker(item); // { target: 'lead' } or { target: 'span', text: 'More like this' }
copy.dockContent(conceptId, state, catalog, now, suggestion); // row-1 reason, lines, button, countdown
```

Also: `stripText`, `confirmationText`, `explanationSuffix`, `progressChange`, `progressConsequence`, `railWord`, `stateLongForm`, `needsLine`, `runningHead`, `summaryText`, `gapCounter`, the `QUIZ` strings, `LEGEND_LINE`, `RULE_LINE`, `DEMO_CLOCK_LINE`, and the formats `formatElapsed` ("45s", "1m 06s", "9m", "2d"), `formatCountdown` ("0:42") and `formatInterval` ("1 min").

## Simulate

```sh
npm run simulate -- --persona demo --mode focus --clock demo --seed 14 --slots 30
npm run simulate -- --compare            # personas x modes x clocks: pool mix, fallbacks, learned
npm run simulate -- --find-demo-seed     # seeds that give the pinned demo sequence
```

Personas: `demo`, `curious`, `skipper`, `struggler`, `too-easy`, `likes-<topic id>`, `skips-<topic id>`. Durations come from `library/reels/*/render.json` when present (`--synthetic` for 30 s everywhere).

## Tests

`npx vitest run packages/agent`. The demo sequence of UX.md section 7 is pinned in `src/demo.test.ts` with `DEMO_SEED` (14) and the documented durations; `src/perf.test.ts` guards the `plan()` budget on V8 (the phone budget is measured on device).
