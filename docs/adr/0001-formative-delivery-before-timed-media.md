# 0001 — Formative delivery before timed media

Status: Accepted, 2026-08-15

Owner: PIE Players maintainers

## Decision

Formative delivery — Try state, feedback reveal, mastery rollup — is built and
released before timed media. The [formative delivery
contract](../prds/formative-delivery-contract.md) is `Ready`; the [timed media
section contract](../prds/timed-media-section-contract.md) stays `Draft` until
Try state has shipped.

## Constraint

A cue's interesting condition is "the learner answered this correctly", and
correctness at the section layer requires a per-item evaluation seam that PIE
does not have. Timed media first would therefore define `responded` as its only
gate condition — the one thing a cue can evaluate alone — and be revised when
gate-on-correct arrives. That revision lands on a shipped section slice with a
persisted session, so it is a contract change rather than an addition.

In the other order, cue policy composes: a cue names a condition over state that
already exists, and `correct` costs nothing extra.

## Supporting reasons

The formative half is standardized and the timed half is not. QTI 3 already
carries item session control with max-attempts, show-feedback and show-solution,
per-item `numAttempts`, and `completionStatus`. Timed media has no standard at
all, so every field there is a PIE profile to invent and maintain. Spending the
design budget on the half with an inherited vocabulary is strictly better, and it
moves PIE toward QTI conformance rather than deeper into a custom profile.

The formative build is also smaller than it looks, because the evaluation half
ships: `scorePieItem(...)` and `pie-item-player.provideScore()` already score an
item in the browser. What is left is three section-layer additions, no new
evaluation machinery.

## Trade-off

A deliberate trade: the more demonstrable feature waits. A video timeline with
questions appearing at cues is legible to a stakeholder in seconds, where
check-answer-and-retry is not. The formative work is independently shippable and
needs no media, so the cost is demo impact rather than delivered value — and if
the demo audience specifically needs video-linked assessment, that is an audience
fact that would reverse this order and nothing else about the design.

## Consequences

- Branching is explicitly out of scope for the formative contract even though the
  state machine is being designed. Making the next thing shown depend on
  correctness is [`branching-and-process-events`](../prds/shared-contracts/branching-and-process-events.md)
  ground, it drags in path state and resumability, and it would swallow a
  contract that is otherwise three additions. Try state is its prerequisite
  either way, so nothing is wasted by deferring it.
- `FormativeCorrectness` is the vocabulary a cue gate will name. Its four values
  — including `"unknown"` for a not-auto-scorable item — are the conditions a cue
  can be authored against, which is why they are settled here rather than in the
  timed-media PRD.
- The timed-media PRD's remaining blocking decisions (where the section flavor
  attaches, where cue and playback policy runs) are unaffected by this record and
  stay open.
