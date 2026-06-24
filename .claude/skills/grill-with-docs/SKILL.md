---
name: grill-with-docs
description: Use when the user asks to grill or stress-test a plan/design, especially when terminology, domain language, CONTEXT.md, or ADR updates may matter.
disable-model-invocation: true
---

# Grill With Docs

Interview the user until the plan is clear enough to implement, and capture durable terminology or decisions only when they genuinely crystallize.

## Operating Mode

1. Restate the plan briefly.
2. Build a decision tree across goals, constraints, contracts, data/state, UX, tests, rollout, and operations.
3. Resolve upstream decisions before downstream ones.
4. Ask exactly one primary question per turn.
5. Include a concise recommended answer and rationale with each question.
6. Explore the codebase first when the answer can be found there.
7. Track each branch as `decided`, `open`, `blocked`, or `accepted-risk`.

## Domain Awareness

- During exploration, check for existing `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/`.
- Challenge overloaded or conflicting terms immediately.
- Propose a canonical term when the user uses vague language.
- Use concrete scenarios to expose edge cases and concept boundaries.
- Cross-check claims against code when the code can answer them.

## Documentation Capture

- Create or update `CONTEXT.md` lazily when a domain term is resolved and worth preserving.
- Keep `CONTEXT.md` as domain language only; do not include implementation notes or scratch-pad details.
- Offer an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off.
- Do not create glossary or ADR files just to satisfy the workflow; no durable decision means no doc update.

## Session Output

Maintain this structure as the conversation progresses:

- **Resolved Decisions**: choice and rationale.
- **Open Decisions**: unresolved blockers.
- **Dependency Map**: `decision -> depends on`.
- **Risks and Mitigations**: top risks with fallback.
- **Ready Check**: explicit yes/no on whether implementation can begin.
