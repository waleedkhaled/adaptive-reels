# Reviewer eval

The reviewer model decides which lesson specs move on to rendering, so it is measured the way any classifier is: on cases whose right answer is known in advance. This page covers the method, the first live results, what the misses say, and how CI uses the recording.

## Why

The automatic gates had already passed reels with real errors. `rubber-duck-debugging--example` says its code "crashes" where it returns NaN, and a person found that, not a gate. Then, while this eval's golden set was being built, 5 of the 21 passed reels checked against their source cards turned out to have defects (listed [below](#found-while-building-the-set)). A pass rate of 119 of 120 says nothing about how often the reviewer is right.

## Method

**Good specs (16).** Real specs that passed every gate, frozen in `pipeline/evals/golden/` together with the concept and the source card they were written from, so the set doesn't change when `content/` or `library/` does. Each was checked against its card: every claim supported, every answer key right, every snippet doing what its narration says. They have not been approved in the review report yet.

**Planted defects (24).** Each takes one good spec and plants one plausible-but-wrong change of a known type, so its label is known by construction ([cases.ts](../pipeline/src/eval/cases.ts)). Every planted spec still passes the schema, G1 (including the TypeScript check of its snippets) and the verbatim-quote check, enforced by [cases.test.ts](../pipeline/src/eval/cases.test.ts), so only the model gates can catch it.

| Defect type                  | Owning gate | Example                                                                                     |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `contradicted_claim`         | G2          | The card says updates are batched; the claim and narration say React re-renders immediately |
| `unsupported_detail`         | G2          | Narration adds "about three times faster", a figure the card never gives                    |
| `wrong_answer_key`           | G2          | The key for Q2 moves to a distractor                                                        |
| `two_correct_choices`        | G2          | A distractor is replaced by a paraphrase of the right answer                                |
| `code_contradicts_narration` | G2          | Narration says props arrive as one object; the snippet takes a positional string            |
| `subtle_bug`                 | G2          | `return primary()` without `await` inside `try`, so the fallback never runs on a rejection  |
| `insecure_practice`          | G4          | Recommended code hard-codes an API key, evals a model reply, or builds SQL with an f-string |
| `trivia_questions`           | G3          | Q2 asks which word the example component displays instead of why text needs a `Text`        |

**Scoring.** Every gate runs on every case (no fail-fast), so each gate gets its own numbers. The pipeline's verdict, reject when any gate fails, is scored as a whole:

- **Recall:** share of planted defects rejected.
- **Specificity:** share of good specs passed.
- **Precision:** share of rejections that were right.

Cost and latency come from the ledger entries of the run.

## Results: 2026-10-05

Reviewer `deepseek-ai/DeepSeek-V4-Pro-0813` at temperature 0, prompt versions G2 `5b4b47952a22`, G3 `c9c01cb86780`, G4 `f067bcbf2f7b`. 120 calls, **$0.23** ($0.0058 per case), latency p50 4.4 s and p95 7.2 s, no retries. Full answers and evidence: [latest.json](../pipeline/evals/results/latest.json).

| Pipeline verdict | Score       |
| ---------------- | ----------- |
| Recall           | 16/24 (67%) |
| Specificity      | 15/16 (94%) |
| Precision        | 16/17 (94%) |

| Defect type                  | Caught | By its own gate | Flagged by   |
| ---------------------------- | ------ | --------------- | ------------ |
| `contradicted_claim`         | 3/3    | 3/3             | G2           |
| `wrong_answer_key`           | 3/3    | 3/3             | G2           |
| `code_contradicts_narration` | 3/3    | 3/3             | G2           |
| `insecure_practice`          | 3/3    | 3/3             | G4 ×3, G2 ×2 |
| `subtle_bug`                 | 2/3    | 2/3             | G2           |
| `unsupported_detail`         | 1/3    | 1/3             | G2           |
| `trivia_questions`           | 1/3    | 0/3             | G2 ×1        |
| `two_correct_choices`        | 0/3    | 0/3             | none         |

| Gate | False alarms on good specs | Own defect types caught |
| ---- | -------------------------- | ----------------------- |
| G2   | 1/16                       | 12/18                   |
| G3   | 0/16                       | 0/3                     |
| G4   | 0/16                       | 3/3                     |

The one false alarm: G2 called claim c1 of `break-down-problems--intro` unsupported because the claim says "independently" where the card says "checked on their own". Defensible, but stricter than intended.

## What the misses say

1. **Two correct choices, 0/3.** G2 asks which choice answers each question, with "none" for zero or several right answers. The reviewer finds a correct choice and stops; it never checks that the others are wrong. Fix: ask about each choice on its own ("is choice C a correct answer, according to the card?") and require exactly one yes.
2. **Unsupported details, 1/3.** One yes/no question covers the whole script, and an added sentence in segment 3 gets lost. Fix: ask per segment.
3. **Trivia questions, 0/3 for G3.** The rubric scores both quiz questions together, and gave "questions test the idea" 5 of 5 to two trivia cases: one good question carries the pair. Fix: a yes/no per question.
4. **A missing `await` inside `try`** passed G2's bug check, whose examples are all synchronous. Adding this example now would tune the prompt to the very case that measures it; it waits for a larger set.

These fixes come from reading the misses, so the next run after them overstates recall unless it includes new planted cases written after the change.

## Found while building the set

Five passed reels were dropped from the good set because they had real defects:

| Reel                                   | Problem                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `rn-performance-rerenders--intro`      | The hook says the stutter "isn't the UI thread", which the card doesn't say, and Q1 marks a slow UI thread as the wrong answer |
| `react-state--example`                 | The double `setCount(count + 1)` bug is shown without being flagged as a mistake                                               |
| `ts-generics--intro`                   | The `any` version is shown without being flagged; the other two ts-generics reels need a look as well                          |
| `ts-unknown-vs-any--intro`             | A `data.nonexistent()` crash is shown without being flagged                                                                    |
| `prompt-injection-guardrails--example` | A vulnerable agent is shown without being flagged, and the "fix" uses an undefined `action`                                    |

The common pattern: code that is wrong on purpose, written with `shows_mistake: false`, so it renders and reads as recommended code. These go to the approve/reject pass. The pattern is also a candidate for a G1 rule: a snippet the narration calls a mistake must set `shows_mistake`.

## Running it

```bash
npm run eval -- --dry-run                                     # offline: the harness with a fake reviewer
npm run eval                                                  # live: about $0.23; writes pipeline/evals/results/
npm run eval -- --replay pipeline/evals/results/latest.json   # offline: re-score the recording with today's gate code
npm run eval -- --only two_correct_choices                    # a subset; writes no files
```

## How CI uses it

The replay test in [eval.test.ts](../pipeline/src/eval/eval.test.ts) re-scores `latest.json` with the current gate code, offline and for free:

- **A change to a gate's decision logic** (a threshold, how answers become issues) is re-scored against the recorded answers and must still meet the bar.
- **A change to any gate prompt** makes the recording stale: the gate would now send a different prompt than the one recorded, so the test fails until someone runs the live eval and commits the new results. A prompt change can't land without being measured.

The bar is a ratchet at this first run: recall at least 0.65 and specificity at least 0.9, so losing one catch or adding one false alarm fails. Raise it as the gates improve; the target is recall 0.8. (The recorded file says `passed: false` because the run was scored against a provisional 0.8/0.8 bar, before the ratchet was set.)

## Limits

- 40 cases is small. One case moves recall by about 4 points, so read a difference of one or two cases as noise.
- The good specs were checked against their source cards, and the cards themselves haven't been checked independently. A spec can be faithful to its card and still be wrong.
- One run at temperature 0. Repeated runs would show how much the reviewer varies.
- The planted defects are the mistakes this project thought to plant. Real writer errors (like the five above) are a better source of new cases than imagination.
