# ADR 0004: Claims quote a verbatim span of a source card; deterministic checks run before model checks

- **Status:** Accepted
- **Decided:** 2026-10-03, extended 2026-10-04 · **Recorded:** 2026-10-05
- **Sources:** `docs/PLAN.md` (Assumptions, Schema refinements, Pipeline design step 2, Licences, Subject change of 2026-10-04), `pipeline/src/gates.ts`, `pipeline/src/codecheck.ts`

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- A writer model states facts it was not given. The plan lists "Reviewer passes subtly wrong physics" as a risk (the subject was optics at the time) with the mitigation "Claims tied to quoted source spans".
- The facts come from source cards: one Markdown file of short numbered facts per concept, `content/software-engineering/sources/<concept_id>.md`, 40 in all. They were drafted for this repo and, by the owner's call of 2026-10-03, are not hand-checked (`docs/PLAN.md` Assumptions). A textbook was ruled out by its licence (`docs/PLAN.md` Licences).
- Reviewer calls cost money and time; the plan orders the gates "cheapest first, fail fast" (`docs/PLAN.md` Pipeline design).
- Since the subject change of 2026-10-04, reels show TypeScript code, which can be checked by a compiler instead of a model.

## Decision

1. **Claims carry their evidence.** Each `key_claims` entry has `text` (the claim in the writer's words), `source_id` and `quote`. The schema requires known source ids, unique claim ids and retrieval items that cite existing claims (`packages/schemas/src/reel-spec.ts:48-55,110-143`). The writer is told to copy each quote verbatim from one numbered fact (`pipeline/src/writer.ts` system prompt).
2. **Order of checks**, stopping at the first failure (`pipeline/src/gates.ts` `runGates`):
   1. Schema: `ReelSpec.safeParse` on the writer's reply, with up to 2 repair calls (`writer.ts` `writeSpec`).
   2. **G1, no model:** spoken length against the target at 2.5 words per second; symbols and tokens like "n1" in narration; a known template; code at most 12 lines of 48 characters; ts and tsx snippets type-checked with the TypeScript compiler, where `compiles` must have no errors and `should_error` must have at least one (`pipeline/src/codecheck.ts`); flow-diagram limits; image prompts that ask for text, code or diagrams; 2 to 5 segments; at least 2 retrieval items; `sources` exactly the concept's card (`gates.ts` `gateG1`).
   3. **G2 step 1, no model:** every quote must be a substring of the card after both are lower-cased and whitespace, curly quotes, dashes and a trailing period are normalised. Any miss fails G2 and the reviewer is not called (`gates.ts` `quoteProblems`, `gateG2`).
   4. **G2 step 2, reviewer:** typed questions on each claim against the card, each answer key, unsupported statements in the script, and whether each code snippet matches its narration ([ADR 0003](0003-cross-family-reviewer-with-typed-questions.md)).
   5. **G3** pedagogy rubric and **G4** safety, both reviewer.
3. **A canary.** `npm run pipeline -- canary` runs G2 on a fixture spec and on a copy whose first claim is reversed while its quote stays verbatim. The control must pass and the planted claim must fail (`pipeline/src/canary.ts`).

## Alternatives considered

- **Open-ended fact-checking**, where the reviewer judges claims against its own knowledge or a web search. Rejected: there is no fixed text to judge against, so a verdict cannot be traced or reproduced, and every claim costs a model call.
- **A published textbook as the source.** OpenStax _University Physics_ was ruled out: CC BY-NC-SA, and the book forbids ingestion into LLMs without permission (`docs/PLAN.md` Licences). This is why the repo has its own cards.
- **Model checks first, deterministic checks later.** Rejected: every spec that a string match or the compiler would reject would still pay for up to three reviewer calls.

## Consequences

### Good

- An invented or misquoted source costs no reviewer call, and the failure message names the claim and the quote (`gates.test.ts`: "rejects a quote that is not in the card, without asking the reviewer").
- The reviewer judges each claim against one short card, the same text every time.
- Code on screen is known to compile, or known to fail when it shows a mistake (`gates.test.ts` "code checks").
- The canary shows that the model step catches what the string step cannot: a reversed claim behind a correct quote. The reviewer eval extends this with planted defects ([EVALS.md](../EVALS.md)).

### Bad

- A verbatim quote does not prove the claim. A claim can misstate a correctly quoted fact; only the G2 reviewer catches that.
- Reels can only teach what a card says, and card quality bounds reel quality. The cards were not hand-checked.
- Code and diagrams are illustrations outside the quote rule (G2 tells the reviewer so). Only ts and tsx get a compiler check; other languages must use `check: "none"`.
- The match ignores case, so a quote that changes capitalisation still passes.
- Editing a card does not re-check existing specs: stages skip reels that already have a record, and `npm run pipeline -- review` re-runs the gates as a paid call per reel.
