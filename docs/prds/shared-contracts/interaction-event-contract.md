# Interaction Event Contract

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)

## Problem

Hosts and standards adapters need a stable way to observe learner interaction, media progress, branching decisions, tool usage, and process traces without replacing the runtime events that PIE elements and players already emit.

Today the canonical runtime events are useful for player orchestration, but hosts that need analytics, replay/debug, xAPI/Caliper mapping, or audit traces must infer source identity and event meaning from several package-specific surfaces.

## Goals

- Define an additive event projection vocabulary over existing PIE runtime events.
- Preserve canonical element, item-player, section-player, and assessment-player events.
- Provide stable source references for assessment, section, item, element, media, cue, tool, scenario, branch, simulation, step, evidence, and rubric sources.
- Separate state-bearing projections from analytics-only and debug-only events.
- Define process vocabulary for ordered steps, causality, branching paths, resumability, and externally graded outcomes.

## Non-Goals

- Do not rename or replace `session-changed`, `model-set`, `pie-item-player` events or methods, `SectionControllerEvent`, or assessment-player public events.
- Do not define a telemetry vendor integration, LRS client, Caliper sensor, or standards conformance suite.
- Do not add a generic `Record<string, unknown>` event bus as the primary public API.
- Do not normalize versioned PIE element tag names or synthesize replacement element identifiers.
- Do not make persisted storage, privacy policy, or reporting workflow a PIE responsibility.

## Package And Export Ownership

- Owning package: open question; likely `@pie-players/pie-players-shared` if the contract is runtime-neutral, or `@pie-players/pie-assessment-toolkit` if projection helpers depend on controller state.
- Public export path: open question; candidate shape is an explicit projection export such as `<owner>/event-projection`.
- Consuming packages or apps: `section-player`, `assessment-player`, future adapter packages, demo hosts, and `../pie-qti` adapter work.
- Runtime environment: browser and adapter-only; core projection types should be Node-safe.

If implementation introduces helper functions as well as types, this PRD should choose whether helpers live with the types or in player-specific adapter packages.

## Contract Shape

The final names are not ratified by this draft. The contract should include:

- a schema version field;
- a globally unique event projection id;
- a timestamp;
- a discriminated event type;
- a source reference;
- a category of `state`, `analytics`, or `debug`;
- typed payloads per event family;
- optional causality links to parent events or runs.

Documentation sketch only:

```ts
interface InteractionSourceRef {
  assessmentId?: string;
  sectionId?: string;
  itemId?: string;
  element?: {
    tagName: string;
    id: string;
    modelId?: string;
    sessionId?: string;
  };
  mediaId?: string;
  cueId?: string;
  toolId?: string;
  scenarioId?: string;
  branchId?: string;
  simulationId?: string;
  stepId?: string;
  evidenceId?: string;
  rubricId?: string;
}

interface InteractionEventProjection {
  version: 1;
  id: string;
  type: string;
  timestamp: number;
  source: InteractionSourceRef;
  category: "state" | "analytics" | "debug";
  causality?: {
    attemptId?: string;
    runId?: string;
    parentEventId?: string;
  };
  payload: TypedInteractionPayload;
}
```

Payload families should be discriminated unions, not one untyped bag. A narrow extension field may be allowed for analytics-only metadata, but state-bearing payloads must be typed.

## Compatibility

This PRD touches host-facing projected event data. It must not change:

- PIE element runtime/controller contracts;
- canonical element events;
- `pie-item-player` properties, events, or imperative methods;
- section controller event names;
- assessment-player public events.

Element source references must preserve the full rendered `pie-*--version-*` tag name and pass through `id`, `model-id`, `session-id`, `slot`, `data-*`, `aria-*`, `pie-*`, `config-*`, and `context-*` unchanged.

Projection adapters may observe existing events and produce new host-facing projections. They must not create duplicate dispatch paths that existing players consume internally.

## Data Ownership And Host Responsibilities

PIE owns:

- event projection vocabulary and source-reference shape;
- optional projection helpers over existing player events;
- compatibility tests proving canonical event names and contract identifiers are preserved.

Hosts own:

- durable event storage;
- privacy filtering and consent policy;
- user identity and authorization;
- analytics sinks, LRS/Caliper endpoints, reports, and audit-retention policy;
- deciding which analytics/debug events to drop.

## Serialization And Versioning

Projected events are wire-facing data and require:

- `version: 1` on every event;
- validation owned by the package that owns the exported type;
- unknown-field behavior that preserves known fields and ignores unknown analytics metadata unless a consuming adapter opts in;
- unknown-version behavior that rejects state-bearing events and may drop analytics/debug events;
- fixtures that prove element tag names and contract attributes round-trip unchanged.

Migration behavior is additive. A future version must not reinterpret existing event types without a new version or new discriminant.

## Accessibility

This PRD does not directly change UI. Event families that describe focus handoff, cue announcements, media state, or error states should carry enough source and state data for hosts to audit accessibility behavior, but the runtime behavior belongs to the accessibility runtime patterns PRD and implementation PRDs.

## Standards Or Adapter Impact

This contract is intended to be consumed by QTI/PCI, xAPI, and Caliper adapters. It does not claim conformance with any standard.

QTI/PCI mapping belongs in `../pie-qti` after projection types exist. xAPI and Caliper may become separate adapter packages after this contract is accepted and tested.

## Test Plan

Required test coverage:

- fixtures for each event family and source-reference shape;
- tests that canonical runtime events still dispatch with their current names;
- tests that projection helpers preserve versioned tag names and contract identifiers;
- tests that unknown state-bearing event versions are rejected;
- tests that analytics-only extension metadata cannot affect runtime state.

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

## Rollout And Release Notes

- Changeset required: yes, if public exports are added.
- Migration notes: additive projection surface only; existing hosts can ignore it.
- Documentation updates: adapter docs and player event docs should link to the accepted contract.
- Release risk: medium, because source identity mistakes can break analytics and standards mappings even without changing runtime behavior.

## Open Questions

- Which package owns the public projection types?
- Are projection helpers part of the first implementation, or does this PRD only ratify TypeScript types and fixtures?
- Which event families are required for the first accepted version: item/session, section/completion, media/cue, tool, branch/process, or all of them?
- Should timestamps use `number` epoch milliseconds, ISO strings, or a typed clock source?
