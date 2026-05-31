# Documentation

Every document in the repo, one line each. Paths are relative to this folder.

## Start here

- [../README.md](../README.md): what the project is, setup, commands, the review pass, running the app, installing on an iPhone.
- [ARCHITECTURE.md](ARCHITECTURE.md): the system from context to components, the data contracts, failure modes and trade-offs.
- [PLAN.md](PLAN.md): the implementation plan, milestones, the dated status and the owner's decisions.
- [PROCESS.md](PROCESS.md): how the project was built: the method, the decision log, and what went wrong.
- [../AGENTS.md](../AGENTS.md): instructions for coding agents: setup, commands, rules, testing expectations.
- [media/README.md](media/README.md): screenshots and the demo recording, and how they were captured.

## Design

- [../PRODUCT.md](../PRODUCT.md): who the product is for, the evidence rules, the fixed vocabulary and the product principles.
- [AGENTIC_DESIGN.md](AGENTIC_DESIGN.md): the offline writer and reviewer workflow, the on-device policy and the human approval, and why each loop has its shape.
- [UX.md](UX.md): screens, behaviour, the copy deck, accessibility, events and the 3-minute demo script.
- [../DESIGN.md](../DESIGN.md): the "Status Board" visual system: tokens, type, components and the reel safe-zone contract.
- [design-preview.html](design-preview.html): a static page that renders the design system's screens and tokens (open it in a browser).
- [research/README.md](research/README.md): the research notes behind the app design, with their fact-checks.
- [../packages/agent/README.md](../packages/agent/README.md): the learning agent's API and which call to make for which UI event.
- [../packages/fonts/README.md](../packages/fonts/README.md): the shared font files, their sources and licences.

## Decisions

- [adr/README.md](adr/README.md): index of the architecture decision records, with the template for new ones.
- [adr/0001](adr/0001-offline-generation-with-human-approval.md): reels are generated offline and approved by a human, not made at request time.
- [adr/0002](adr/0002-deterministic-pure-learning-agent.md): a deterministic, pure TypeScript learning agent instead of an LLM in the runtime loop.
- [adr/0003](adr/0003-cross-family-reviewer-with-typed-questions.md): writer and reviewer from different model families; the reviewer answers typed questions.
- [adr/0004](adr/0004-verbatim-quotes-and-deterministic-checks-first.md): claims quote a source card verbatim; deterministic checks run before model checks.
- [adr/0005](adr/0005-cost-ledger-and-dry-run.md): worst-case cost reservations against a budget cap; a dry run with fake providers.
- [adr/0006](adr/0006-zod-contract-and-source-only-workspaces.md): Zod schemas as the contract; npm workspaces that export TypeScript source.
- [adr/0007](adr/0007-separate-interest-and-mastery.md): interest from behaviour, mastery from answers; Learned needs a correct delayed answer.
- [adr/0008](adr/0008-feed-playback-pager-and-player-pool.md): FlatList pager, a pool of 3 players, activation and settle, file-first playback.
- [PLAN.md, owner decisions](PLAN.md#owner-decisions-2026-10-04): the owner's numbered decisions, which the ADRs cite.

## Operations

- [PERFORMANCE.md](PERFORMANCE.md): performance budgets, the feed and player design, encode settings, hosting, the measurement plan, and the simulator results (section 10).
- [EVALS.md](EVALS.md): how the reviewer is scored on a golden set and planted defects, and how to run the eval.
- [../apps/mobile/AGENTS.md](../apps/mobile/AGENTS.md): Expo-specific rules for the app: versioned docs, `npx expo install`, generated native folders.

## Licences

The repo's own code is under the MIT licence ([../LICENSE](../LICENSE)). Third-party assets keep their own licences: the fonts in `packages/fonts/files/` are under the SIL Open Font License 1.1 (the `*-OFL.txt` files next to them), and the terms for the models, Remotion and the rejected OpenStax text are listed in [PLAN.md, Licences](PLAN.md#licences).
