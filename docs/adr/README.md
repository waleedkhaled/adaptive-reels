# Architecture decision records

Each record describes one decision: its context, the decision, the alternatives considered and why they were rejected, and the consequences, good and bad. The format is Michael Nygard's ADR with the options section of MADR.

The first eight decisions were made between 2026-10-03 and 2026-10-05 and are recorded in [docs/PLAN.md](../PLAN.md), [docs/UX.md](../UX.md) and [docs/PERFORMANCE.md](../PERFORMANCE.md). These records were written on 2026-10-05, after the fact, from those documents and the code. Each one says so, gives both dates and describes what the code does on that date.

| ADR                                                            | Decision                                                                                                                    | Decided                             | Status   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| [0001](0001-offline-generation-with-human-approval.md)         | Generate reels offline and gate them on a human approval, not at request time                                               | 2026-10-03                          | Accepted |
| [0002](0002-deterministic-pure-learning-agent.md)              | A deterministic, pure TypeScript learning agent instead of an LLM in the runtime loop                                       | 2026-10-03, amended 10-04           | Accepted |
| [0003](0003-cross-family-reviewer-with-typed-questions.md)     | Writer and reviewer from different model families; the reviewer answers typed questions with evidence                       | 2026-10-03                          | Accepted |
| [0004](0004-verbatim-quotes-and-deterministic-checks-first.md) | Claims quote a verbatim span of a source card; deterministic checks run before model checks                                 | 2026-10-03, extended 10-04          | Accepted |
| [0005](0005-cost-ledger-and-dry-run.md)                        | Every paid call reserves its worst-case cost against a budget cap; the dry run uses fake providers with the network blocked | 2026-10-03                          | Accepted |
| [0006](0006-zod-contract-and-source-only-workspaces.md)        | Zod schemas are the single contract; npm workspaces; packages export TypeScript source with no build step                   | 2026-10-03                          | Accepted |
| [0007](0007-separate-interest-and-mastery.md)                  | Interest moves only from behaviour, mastery only from answers; Learned needs a correct delayed answer                       | 2026-10-03, amended 10-04 and 10-05 | Accepted |
| [0008](0008-feed-playback-pager-and-player-pool.md)            | FlatList pager, a pool of 3 players, activation and settle thresholds, file-first playback                                  | 2026-10-04                          | Accepted |

The system they shape is described in [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Adding a record

1. Copy the template below to `docs/adr/NNNN-short-slug.md` with the next number.
2. Write it when the decision is made, with status **Proposed**; change it to **Accepted** once the owner agrees.
3. Never rewrite an accepted record to change its decision. Write a new record and set the old one to **Superseded by ADR NNNN**. Corrections of fact are fine.
4. Add a row to the table above, and link the record from the code or document it affects.

```markdown
# ADR NNNN: <decision in one line>

- **Status:** Proposed | Accepted | Superseded by ADR NNNN
- **Decided:** YYYY-MM-DD · **Recorded:** YYYY-MM-DD
- **Sources:** <documents, issues or files>

## Context

What forces the decision: requirements, constraints, facts with their sources.

## Decision

What we do, specific enough to check against the code, with paths.

## Alternatives considered

- **<Option>.** What it is, and why it was rejected or deferred.

## Consequences

### Good

### Bad
```
