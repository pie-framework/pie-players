# PRD Title

Status: Draft

Owner:

Related architecture:

## Problem

Describe the concrete user, host, or implementation problem this PRD solves.
Keep this focused on one independently reviewable contract or feature.

## Goals

- [Goal]

## Non-Goals

- [Non-goal]

## Package And Export Ownership

- Owning package:
- Public export path:
- Consuming packages or apps:
- Runtime environment: browser, Node-safe, custom element, or adapter-only.

If this PRD introduces a public contract, this section must name exactly one
canonical owner. Consumers should import from that owner rather than redefining
parallel types.

## Contract Shape

Document the proposed TypeScript types, events, properties, methods, or wire
fields. Include enough detail for a reviewer to verify compatibility and test
coverage.

```ts
// Documentation sketch only.
```

## Compatibility

State whether this PRD touches any of these surfaces:

- PIE element runtime/controller contracts.
- Versioned `pie-*--version-*` tag names.
- Contract attributes such as `id`, `model-id`, `session-id`, `slot`, `data-*`,
  `aria-*`, `pie-*`, `config-*`, or `context-*`.
- `pie-item-player` properties, events, or imperative methods.
- `section-player` session/completion state.
- `assessment-player` routing, submission, or section rollup state.
- Persisted session data or host-facing wire data.

Required compatibility notes:

- Do not strip or normalize versioned PIE tag names.
- Do not synthesize, prefix, slug, or otherwise mutate contract identifiers.
- Do not add generic compatibility shims outside the `pie-item` client contract.
- If a `pie-item` compatibility exception is required, include the inline
  `pie-item contract compatibility: <reason>` comment in implementation and add
  a covering test.

## Data Ownership And Host Responsibilities

Separate PIE-owned behavior from host-owned behavior.

PIE owns:

- [PIE-owned behavior]

Hosts own:

- Durable persistence.
- Identity and authorization.
- Storage, retention, privacy, and product policy.
- Reporting, gradebooks, workflow, and standards certification unless a concrete
  tested adapter PRD says otherwise.

## Serialization And Versioning

For persisted or wire-facing contracts, define:

- Schema or contract version field.
- Validation owner.
- Unknown-field behavior.
- Unknown-version behavior.
- Migration or downgrade behavior.
- Round-trip fixtures required for compatibility.

If the PRD does not define persisted or wire-facing data, say so explicitly.

## Accessibility

Describe any focus, keyboard, screen-reader, captions/transcripts, reduced
motion, high contrast, or assistive technology impact. If there is no user-facing
runtime change, say so explicitly.

## Standards Or Adapter Impact

State whether this PRD produces adapter-friendly data for QTI/PCI, LTI, xAPI,
or Caliper.

Default rule: do not claim standards conformance unless this PRD scopes a
concrete adapter and validation suite.

Adapter ownership guidance:

- QTI/PCI adapters belong in `../pie-qti`.
- LTI, xAPI, and Caliper adapters may become separate `@pie-players/*` packages
  after the shared projection contracts exist.
- SCORM is out of scope for this planning track.

## Test Plan

Required test coverage:

- Contract fixtures for public or wire-facing data.
- Compatibility tests for preserved events, properties, methods, and identifiers.
- Round-trip tests for persisted session or projection data.
- Accessibility tests or manual evidence for user-facing runtime behavior.

Commands:

```sh
bun run typecheck
bun run test
```

For custom-element or export-boundary changes, also run:

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

For Playwright-backed tests, run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes/no.
- Migration notes:
- Documentation updates:
- Release risk:

## Open Questions

- [Open question]
