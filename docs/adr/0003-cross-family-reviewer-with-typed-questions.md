# ADR 0003: Writer and reviewer from different model families; the reviewer answers typed questions

- **Status:** Accepted
- **Decided:** 2026-10-03 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (Models; "Reviewer interface is shaped as typed questions, not text"), `pipeline/src/config.ts`, `pipeline/src/reviewer.ts`, `pipeline/src/gates.ts`

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- Three gates need judgments a string check cannot make: whether a claim follows from the source card, whether the answer key is right, whether code does what the narration says, pedagogy, and safety (G2 to G4).
- A reviewer from the writer's model family may share the writer's blind spots. The plan picked the reviewer for being a "different family from the writer" (`docs/PLAN.md` Models).
- A free-text review has to be parsed before it can pass or fail a reel, and two backends' free text cannot be compared. The plan also named a possible second backend, TypeSafe Jev, which only answers named questions of type `choice`, `score` or `noul` (yes or no).

## Decision

1. **Two families.** Writer: `zai-org/GLM-5.2` on DeepInfra, temperature 0.6, JSON mode, up to 8000 output tokens. Reviewer: `deepseek-ai/DeepSeek-V4-Pro-0813` on DeepInfra, temperature 0, JSON mode, up to 4000 output tokens (`pipeline/src/config.ts` `MODELS`, `writer.ts` `writeSpec`, `reviewer.ts` `LLMReviewer.ask`).
2. **Typed questions.** A gate calls `reviewer.ask(reelId, gate, material, questions)`. A question is `choice` (one of named options), `score` (a level from 1 to n) or `noul` (yes or no). Each answer comes back with a probability and a short evidence string (`reviewer.ts` `Question`, `Answer`).
3. **Validated answers.** `LLMReviewer` builds a Zod schema from the question set, validates the JSON reply and asks once more with the problems if it does not fit; a second failure throws for that reel. For a yes/no question the probability is the chance that the statement is true (`reviewer.ts`).
4. **Fixed pass rules in code** (`pipeline/src/gates.ts`):
   - G2: each claim must be `supported` by the card; each retrieval item's answer must equal the authored key letter; a code snippet must not be `incorrect`; a yes/no flag (unsupported statement in the script, a bug in teaching code) fails at probability 0.5 or more.
   - G3: seven rubric items scored 1 to 5; every item at least 3 and the mean at least 3.5.
   - G4: three safety flags; any at probability 0.5 or more fails.
5. **Evidence goes back to the writer.** A failed gate's issues, which quote the reviewer's evidence, are sent to the writer for one rewrite (`run.ts` `textStage`, `MAX_REWRITES = 1`), and are shown in the report.

## Alternatives considered

- **The writer reviews its own output.** Rejected: same family, same blind spots (`docs/PLAN.md` Models).
- **Free-text review ("list the problems").** Rejected: it needs a second parsing step and gives no thresholds; typed questions let "any backend that answers typed questions" stand in (`reviewer.ts` header).
- **TypeSafe Jev as the reviewer.** Kept as an optional second backend, not built. It is in `config.ts` (`MODELS.reviewerJev`), but returns no explanations, so DeepSeek stays the default because it supplies the evidence shown in the report (`docs/PLAN.md`). The comparison between the two is still open (`docs/PLAN.md` status).
- **A larger writer (GLM-5.3) or a cheaper reviewer (DeepSeek-V4.1-Flash).** Listed in `docs/PLAN.md` Models; not chosen (GLM-5.3 costs about 2.5 times as much). The Flash model is not in `config.ts`.

## Consequences

### Good

- Pass and fail are decided by thresholds in code, not by the model's wording, and every answer with its evidence is stored in `text.json` and shown in the report (`GateResult.answers`).
- A backend that answers typed questions can be added behind the `Reviewer` interface without touching the gates.
- Prompts are structured lists of named questions, so the gates can be tested with a stub reviewer that returns typed answers (`pipeline/src/gates.test.ts`).
- A reviewer from another family is a second, independent check on the writer; the reviewer eval measures how well it does that ([EVALS.md](../EVALS.md)).

### Bad

- The probability is DeepSeek's self-reported confidence, not a calibrated probability, and the 0.5 thresholds rest on it.
- A missing or invalid confidence becomes 0.5 (`reviewer.ts` `answerSchema`, `.catch(0.5)`). On a yes/no question that gives a probability of 0.5, which meets the flag threshold, so such a reply fails the gate (fail closed).
- Evidence is requested (at most 30 words) but not enforced: a missing evidence string becomes empty.
- Each draft costs up to three reviewer calls (G2, G3, G4, fewer when a gate fails early), and one more per malformed reply; all are billed through the ledger ([ADR 0005](0005-cost-ledger-and-dry-run.md)).
- Two model families means two sets of prices and behaviours to track (`config.ts`).
