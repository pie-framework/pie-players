# Architecture Decision Records

One file per decision that is hard to reverse, surprising without its context, or
a genuine trade-off between named alternatives. Everything else belongs in a PRD
(what to build), an architecture note (how a subsystem works), or a commit
message (why this change).

A decision earns a record when a reader who finds the code later would otherwise
ask "why not the obvious thing?" and have nowhere to look.

Records are append-only. A superseded record keeps its number, gains a
`Superseded by` line, and is not edited into agreement with the newer one — the
sequence is the value.

Numbering is sequential from `0001`. The filename is
`NNNN-<kebab-case-decision>.md`.

## Record shape

`0001` and `0002` set the shape: a numbered title, then `Decision`, `Constraint`,
`Supporting reason`, `Trade-off`, `Consequences`, and a dated `History` or
`Outcome` section once reality reports back on the decision. A section that
carries nothing is dropped.

## What qualifies

- **Architectural shape.** "Assessment delivery is composed from
  assessment-player plus section-player runtimes, not a separate copied runtime
  stack."
- **Integration patterns between contracts.** "Tool policy decisions flow
  through the assessment toolkit contract rather than direct tool-package
  imports."
- **Technology choices that carry lock-in.** Custom-element packaging strategy,
  Svelte runes patterns, persisted session shape, release tooling — the choices
  that are expensive to unwind.
- **Boundary and scope decisions.** "PIE owns runtime projections; hosts own
  durable persistence, identity, policy, reporting, and standards certification
  unless an adapter PRD says otherwise." The explicit no-s are as valuable as
  the yes-s.
- **Deliberate deviations from the obvious path.** "We keep versioned
  `pie-*--version-*` tags in authored markup because custom elements cannot be
  redefined." Anything a reasonable reader might otherwise simplify away.
- **Constraints not visible in the code.** "Playwright must run outside a
  default agent tool sandbox." "All publishable packages release in lockstep as
  patch bumps."
- **Rejected alternatives whose rejection is non-obvious.** Normalizing model
  IDs, importing package source from a consumer, splitting package versions
  independently — record why each lost.

## Records

- [`0001-formative-delivery-before-timed-media.md`](./0001-formative-delivery-before-timed-media.md) — formative delivery ships before timed media, so cue policy composes with Try state instead of inventing a weaker gate
- [`0002-provider-contracts-are-not-parameterized-by-config.md`](./0002-provider-contracts-are-not-parameterized-by-config.md) — a config type parameter in argument position is neutralized by method bivariance, so provider contracts take none and adapters narrow in their own class signature
