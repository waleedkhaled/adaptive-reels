# ADR 0007: Interest moves only from behaviour, mastery only from retrieval answers; Learned needs a correct delayed answer

- **Status:** Accepted
- **Decided:** 2026-10-03, amended 2026-10-04 and 2026-10-05 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (Agent spec: Interest, Mastery; owner decision 8), `docs/UX.md` section 9 (adopted 2026-10-04), `PRODUCT.md` (Product Purpose, Product Principles)

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- Watching is not learning. `PRODUCT.md` cites Roediger and Karpicke (2006): learners who were tested beat learners who restudied after a week, while the study-only group rated its own future recall highest. "The app therefore counts watching as exposure only."
- The feed still has to follow curiosity: what the learner finishes, rewatches, skips or asks for.
- The demo must show the difference on screen: a concept answered once is Checked, and only a later correct answer makes it Learned (`docs/PLAN.md` Context and M5).
- Two questions the event log must answer: do testers keep swiping, and do they get delayed reviews right (`docs/PLAN.md` Schema refinements).

## Decision

The learner state keeps separate records with separate inputs (`packages/schemas/src/learner-state.ts:293-330`):

1. **Interest** (topic interest plus a per-concept offset) moves only from behaviour (`packages/agent/src/interest.ts`, `config.ts:49-73`):
   - one watch signal per impression when a reel ends: Completed (watched at least 90%), Rewatch (at least 150%, replaces Completed), Early skip (no loop and under min(25%, 5 s)), else Partial;
   - quick actions: More like this, Not for me (which also hides the concept for the session). Too easy moves nothing;
   - deltas for the concept, its topic and its `RELATED_TO` neighbours, e.g. More like this +0.25, +0.15, +0.10;
   - onboarding priors 0.7 for picked topics and 0.3 for the others, or 0.5 everywhere after Skip.
   - A reel that failed to load (`skip_failed`) or a session that ended while away (`blur`) gives no signal (`interest.ts:35-52`).
2. **Exposure** (Seen, and eligibility for a first check) comes from a reel end that is not an early skip (`packages/agent/src/queue.ts:411-471`).
3. **Mastery** is a Leitner box from 0 to 4 with a due time, and moves only in `answerCard` through `applyAnswerRule` (`packages/agent/src/mastery.ts:30-70`):
   - correct at box 0: box 1, due after the box-1 interval;
   - correct at box 1 or more on or after the due time: one box up, at most 4;
   - correct before the due time: nothing changes;
   - wrong: one box down (not below 0), due again after the retry interval, and a reteach reel comes next: an angle not yet shown when one is left, else the reel the question came from (`packages/agent/src/items.ts` `chooseReteachReel`);
   - a prove-it card ("Too easy") never lifts a concept above box 1.
   - Intervals after reaching boxes 1 to 4: 10 min, 1 day, 3 days, 7 days, retry 1 min; on the demo clock 60 s, 3 min, 6 min, 12 min, retry 20 s (`config.ts:43-46`).
4. **Learned means box 2 or more** (`packages/agent/src/state.ts:126-128`). The first correct answer can reach box 1 only, and box 2 needs a correct answer on or after the due time it set, so Learned always needs a correct delayed answer. Only Learned concepts unlock their dependents, and unlocks are sticky (`mastery.ts:76-84`, `queue.ts:706-713`).
5. **A miss cap** (owner decision 8, 2026-10-05): the second wrong feed answer on a concept in a session rests it, with no reteach and no card, until the next session (`config.ts` `RULES.missCap = 2`, `queue.ts:745-754`).

## Alternatives considered

- **One score from watching and answering.** Rejected: watching would raise a number that only answers should move (`PRODUCT.md` Product Principles 1, "Honest mastery").
- **Learned after the first correct answer.** Rejected: a first check can come one reel after the concept's reel (`RULES.firstCheckAfterReels = 1`), which tests short-term recall. The plan defines "Learned means box ≥ 2, which needs at least one correct delayed answer".
- **"Too easy" grants mastery.** Rejected (`docs/PLAN.md` Agent spec): it queues a prove-it card instead and makes the concept's next reel the pitfall angle, and that card can reach Checked at most.
- **A rewatch signal for every extra loop of 50% or more** (the first interest table). Replaced by one rewatch per impression at 150% watched and a pause after two idle loops (`docs/UX.md` 9.6, `PRODUCT.md` Operating Context).

## Consequences

### Good

- The separation is tested: any sequence of watch and quick-action events leaves mastery byte-identical (`packages/agent/src/queue.test.ts:559`); a watch-only session leaves mastery untouched (`simulate.test.ts:55`); the answer rule is table-tested for both clocks (`mastery.test.ts`).
- The map can show two kinds of evidence, Seen from watching and Checked, Learned or Retained from answers (`packages/agent/src/state.ts:152-159`).
- Each `card_answered` event records the box before and after, the scheduled and actual gap, and `is_delayed`, so delayed-review accuracy can be computed from a tester's log (`npm run analyze`, `pipeline/src/analyze-log.ts`).

### Bad

- On the real clock, Learned takes at least 10 minutes after the first correct answer, so a short session cannot show it. The demo runs on the demo clock in Focus mode (`docs/UX.md` section 7).
- A fresh profile has 6 open root concepts and nothing else opens until a root is Learned (`PRODUCT.md` Capabilities and Constraints); on the real clock that means 28 to 33% fallback reels for a fresh profile (`docs/PLAN.md` owner decision 9).
- A wrong answer drops a box even on a Learned concept, and with the miss cap a concept can rest for the rest of the session.
- The interest deltas and thresholds are hand-set in `config.ts`; nothing learns them from data.
