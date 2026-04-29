---
description: Interview the plan relentlessly and resolve design-tree dependencies.
argument-hint: [plan-or-context]
---

# Grill Me Command

Run the `grill-me` skill now.

If `$ARGUMENTS` is non-empty, treat it as the initial plan context to interrogate.
If `$ARGUMENTS` is empty, ask for the plan first, then begin.

Execute a dependency-aware, branch-by-branch interview until shared understanding is explicit.

Required behavior:

1. Frame objective, success criteria, non-goals, and hard constraints.
2. Build the top-level decision tree and identify dependencies.
3. Traverse branches in dependency order, one branch at a time.
4. Ask questions one at a time; do not ask multiple unresolved primary questions in a single turn.
5. For each question, provide a recommended answer and brief rationale.
6. If a question can be answered by exploring the codebase, explore the codebase first and then ask only the residual ambiguity.
7. For each branch, challenge alternatives, assumptions, failure modes, and downstream impacts.
8. Mark each branch as `decided`, `open`, `blocked`, or `accepted-risk`.
9. Resolve cross-branch conflicts before proceeding.
10. End only when decisions, risks, and open questions are explicit and mutually understood.
