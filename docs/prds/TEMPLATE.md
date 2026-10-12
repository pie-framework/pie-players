# PRD Title

Status: Draft, YYYY-MM-DD

Owner:

Related architecture:

The status line is the first line after the title: one word from the
[status vocabulary](./README.md#status-vocabulary) and the date the PRD entered
that status. A contract spanning repos adds an implementation-status paragraph
directly beneath it that names, per repo, what has landed and what is
outstanding.

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
coverage. A proposed shape carries the sketch label below; an `Accepted` PRD
shows the shipped signatures without it.

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
or Caliper, and which adapter consumes it. Adapter ownership and the
conformance rule are in the [PRD ground rules](./README.md#ground-rules).

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

For custom-element, export-boundary, toolkit-core or player changes, also run
the [high-value checks](../../AGENTS.md#high-value-checks). Playwright-backed
tests run outside the sandbox; see
[Playwright and sandboxed execution](../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes/no.
- Migration notes:
- Documentation updates:
- Release risk:

## Open Questions

- [Open question]
