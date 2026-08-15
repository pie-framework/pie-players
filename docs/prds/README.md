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
- [`timed-media-section-contract.md`](./timed-media-section-contract.md) -
  section-level timed media with cue-driven item orchestration. Distinct from
  sign language despite both being video; each PRD fences the other out.

## Ground Rules

- Keep PRDs narrowly scoped to one independently reviewable contract or feature.
- Name one owning package and public export path for every public contract.
- Separate PIE-owned behavior from host-owned storage, identity, policy,
  reporting, standards certification, and backend workflow.
- Treat standards integrations as adapter consumers of PIE projections unless a
  PRD explicitly scopes and tests a concrete adapter.
- Do not claim standards conformance until the adapter and its validation suite
  exist.
