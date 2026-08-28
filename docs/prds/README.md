# PRDs

This folder is the home for product requirement documents that turn architecture
notes into implementation-ready contracts. PRDs should be concrete enough for a
reviewer to verify scope, ownership, compatibility, and test coverage before
code lands.

Architecture notes may describe direction before names and package boundaries
are final. A PRD owns the implementation decision: exact TypeScript names,
exports, wire fields, migration behavior, host responsibilities, and acceptance
tests.

## Status Vocabulary

Use one of these statuses at the top of each PRD:

- `Draft` - under discussion; implementation should not start from this without
  maintainer approval.
- `Ready` - scoped and reviewable; implementation can start.
- `Accepted` - implemented and kept as the current contract reference.
- `Superseded` - replaced by a newer PRD or contract document.

## Retention And Cleanup

Do not delete a PRD merely because its implementation is complete. An `Accepted`
PRD is part of the current contract documentation: it records ownership,
boundaries, rejected alternatives, compatibility decisions, and acceptance
criteria that are not recoverable cheaply from code alone.

Delete a PRD only when it was abandoned before it governed shipped behavior and
has no decision-history value. Mark it `Superseded` when a newer document owns
the contract, link to the replacement at the top, and remove it only in a later
cleanup if no current document or code comment refers to it. Keep implementation
journals concise: once a contract is accepted, prefer current behavior and the
reasons for non-obvious decisions over branch chronology or stale rollout prose.

The live development backlog is the set of `Draft`, `Ready`, and `Active`
documents, not every file in this directory. `Accepted` and `Superseded`
documents are reference/history and should not be presented as planned work.

A contract spanning repos qualifies the status on the same line — `Accepted for
the pie-players contract` — and names what is outstanding, and where, in the
implementation-status paragraph beneath it. An architecture note that carries a
live per-slice record is `Active`.

## Structure

- [`TEMPLATE.md`](./TEMPLATE.md) - required PRD sections and review checklist.
- [`shared-contracts/`](./shared-contracts/) - PRDs for shared event, session,
  scoring, media, evidence, accessibility, and adapter-facing contracts.
- [`pie-727-broad-theming-contract.md`](./pie-727-broad-theming-contract.md) -
  the `--pie-*` token contract, colour-scheme runtime, and generated CSS
  adapters. Per-surface slice and WCAG records live in `../architecture/`.
- [`tts-highlight-target-resolver.md`](./tts-highlight-target-resolver.md) -
  focused implementation PRD for runtime TTS highlight target remapping.
- [`sign-language-asl-support.md`](./sign-language-asl-support.md) -
  item-level signed alternate representations through accessibility catalogs and
  PNP gating.
- [`audio-accommodations.md`](./audio-accommodations.md) -
  audio transcript as a policy-gated catalog card, replacing a pre-toolkit
  CSS-class gate by transforming content rather than accommodating the class;
  plus why autoplay is a content property and not a PIE feature.
- [`formative-delivery-contract.md`](./formative-delivery-contract.md) -
  accepted contract for Try state, feedback reveal as a per-item `env`
  projection, and section mastery. Consumes the shipped client-side scoring path
  rather than replacing it.
- [`timed-media-section-contract.md`](./timed-media-section-contract.md) -
  accepted contract for section-level timed media with cue-driven item
  orchestration. It consumes formative state for cue gate conditions and remains
  distinct from sign language despite both using video.
- [`assessment-authoritative-submission.md`](./assessment-authoritative-submission.md) -
  draft contract for a host-supplied terminal assessment operation with
  idempotency, typed receipts, retry semantics, and observable controller state;
  ordinary assessment snapshots remain on the existing persistence strategy.
- [`speech-to-text.md`](./speech-to-text.md) -
  dictation as the first production accommodation: it writes the response rather
  than re-presenting content, so it needs an element-facing insertion contract
  that the presentation accommodations never did. No QTI/AfA term exists to map
  to.
- [`open-source-calculator-provider.md`](./open-source-calculator-provider.md) -
  a fully bundled basic, scientific, and focused graphing provider built from
  MathLive, CortexJS Compute Engine, and JSXGraph, selected additively as
  `calculator-cortex` after the GeoGebra provider seam lands.

Decisions that span PRDs — sequencing, rejected alternatives, trade-offs a reader
would otherwise have to reconstruct — live in [`../adr/`](../adr/).

## Ground Rules

- Keep PRDs narrowly scoped to one independently reviewable contract or feature.
- Name one owning package and public export path for every public contract.
- Separate PIE-owned behavior from host-owned storage, identity, policy,
  reporting, standards certification, and backend workflow.
- Treat standards integrations as adapter consumers of PIE projections unless a
  PRD explicitly scopes and tests a concrete adapter.
- Do not claim standards conformance until the adapter and its validation suite
  exist.
