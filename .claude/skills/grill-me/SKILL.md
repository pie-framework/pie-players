---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

# Grill Me

## Goal

Interview the user relentlessly about every aspect of their plan until there is clear, shared understanding and no unresolved blocking decisions.

## Operating Mode

1. Restate the plan briefly to confirm baseline understanding.
2. Build a decision tree across: goals, constraints, architecture, APIs/contracts, data model, UX, testing, rollout, and operations.
3. Walk each branch of the tree and resolve decision dependencies one-by-one.
4. Ask questions one at a time.
5. For each question, provide your recommended answer.
6. If an answer is vague, challenge it and ask for specifics.
7. Track open decisions and close them explicitly before moving on.

## Questioning Rules

- Ask exactly one primary question per turn.
- Include a concise "Recommended answer" with each question.
- Prefer concrete trade-off prompts such as "A vs B; why?"
- Cover failure modes and edge cases, not just happy paths.
- Require measurable acceptance criteria before marking a branch resolved.
- If a question can be answered by exploring the codebase, explore first and then ask a sharper question or propose the answer directly.

## Dependency-First Flow

For each branch, resolve in this order:

1. **Intent**: What problem is being solved, for whom, and how success is measured.
2. **Constraints**: Technical, product, legal/compliance, timeline, team ownership.
3. **Core decisions**: Interface/contracts, data flow, persistence, state ownership.
4. **Risks**: What can fail, detectability, blast radius, mitigation.
5. **Validation**: Test strategy, observability, rollout and rollback plan.

Do not move to downstream branches when upstream dependencies are unresolved.

## Session Output Format

Maintain and update this structure during the conversation:

- **Resolved Decisions**: Decision, chosen option, rationale.
- **Open Decisions**: Blocking questions still unanswered.
- **Dependency Map**: `decision -> depends on`.
- **Risks & Mitigations**: Top risks with mitigation/fallback.
- **Ready Check**: Explicit yes/no on whether implementation can begin.

## Stop Condition

Only stop grilling when:

- all blocking decisions are resolved,
- acceptance criteria are testable,
- rollout/rollback is defined,
- and both sides confirm shared understanding.
