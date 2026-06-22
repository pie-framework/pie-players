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

## Structure

- [`TEMPLATE.md`](./TEMPLATE.md) - required PRD sections and review checklist.
- [`shared-contracts/`](./shared-contracts/) - PRDs for shared event, session,
  scoring, media, evidence, accessibility, and adapter-facing contracts.

## Ground Rules

- Keep PRDs narrowly scoped to one independently reviewable contract or feature.
- Name one owning package and public export path for every public contract.
- Separate PIE-owned behavior from host-owned storage, identity, policy,
  reporting, standards certification, and backend workflow.
- Treat standards integrations as adapter consumers of PIE projections unless a
  PRD explicitly scopes and tests a concrete adapter.
- Do not claim standards conformance until the adapter and its validation suite
  exist.
