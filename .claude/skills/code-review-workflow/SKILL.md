---
name: code-review-workflow
description: Run a structured three-independent-reviewer code review for any substantial change set, merging findings into a single response. Use when the user asks for a code review, when a multi-file feature, cross-package change, or non-trivial refactor is complete, or before opening a PR. Trigger on cues like "review my changes", "code review", "review this", "PR ready", "review the diff", "audit my work".
---

# Code Review Workflow

Canonical rule: [`.cursor/rules/code-review-workflow.mdc`](../../../.cursor/rules/code-review-workflow.mdc).

## When to run a review

- The user explicitly asks for a code review.
- After completing a substantial change set: multi-file feature,
  cross-package work, non-trivial refactor, or anything you would put in
  a PR description.

Treat a review as **required follow-up** unless the user explicitly opts
out.

## Three independent reviewers

Spin up **three independent** review passes (e.g. three Cursor `Task`
calls with `subagent_type: "code-reviewer"`, or equivalent) over the
same change set. They must not see one another's outputs. Vary focus
when useful:

- Reviewer 1: correctness, API contracts, types.
- Reviewer 2: UI / persistence / state lifecycle.
- Reviewer 3: tests, docs, observability, accessibility.

Each reviewer needs enough context to review without re-deriving scope:

- Paths touched (or commit / PR ref).
- Intent of the change in 1–3 sentences.
- Constraints (e.g. "must not break the `pie-item` client contract", "no
  Svelte effect mutations", "lockstep release implications").

## Merge and coordinate

In one coordinated response back to the user:

- **Consensus issues** — flagged by 2+ reviewers, highest priority.
- **Unique catches** — single-reviewer findings worth surfacing.
- **De-duplicated** — collapse near-duplicates into one item.
- **Filter** — keep high-signal items: bugs, contract breaks, security
  issues, misleading API/UX, missing tests for new behavior. Drop pure
  style nits unless project rules call for them (Biome already enforces
  most of those).

## Action plan

After merging findings, produce a short ordered plan:

1. Concrete file/area pointer per item.
2. Suggested fix (or "investigate" if unclear).
3. Severity (blocker / nice-to-fix).

Implement fixes when in scope. Skip implementation only when the user
asked for review-only.

## Disagreement handling

When reviewers disagree and there is **no clear technical or product
rule** that breaks the tie:

- Stop. Surface the disagreement to the user with both positions and
  the trade-offs.
- Do **not** guess.
- Do **not** silently pick the more conservative option.

## Post-fix sanity

After fixes from a review, a quick sanity pass is appropriate:

- `bun run lint:fix` (Biome auto-fix).
- `bun run typecheck`.
- `bun run check`.
- `bun run test` (and the relevant `bun run test:e2e:*` with
  `required_permissions: ["all"]` if CE / e2e behavior was touched).

A full second three-agent round is optional — only repeat it when the
fix set is itself substantial.

## Scope limiter for explicit requests

If the user asks for a review of specific files or commits, scope all
three reviewers to that reference only — do not expand the review surface.
