# Branching And Process Events

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)

## Problem

Branching scenarios, role-play, simulations, process-capture workflows, replay/debug views, and externally graded checkpoints need more than flat item session updates. They need a small shared vocabulary for decisions, paths, ordered steps, causality, resumability, and process state.

Without a shared contract, future section variants and adapters are likely to invent incompatible branch identifiers, path state, and event semantics.

## Goals

- Define additive process vocabulary that can be used by branching, simulations, replay/debug, and standards adapters.
- Build on the interaction event projection contract instead of replacing existing runtime events.
- Define how branch and process source references connect to assessment, section, item, element, and evidence sources.
- Make resumability and externally graded outcome references explicit.
- Require every section slice that persists process state to define typed merge, replace, hydrate, persist, and unknown-host behavior.

## Non-Goals

- No generic branching engine or complete role-play product surface.
- No simulation runtime, sandbox executor, or external grading service.
- No generic `profileState` or untyped persistence bag for future behavior.
- No host workflow, identity, audit, or reporting system.
- No standards conformance claim for xAPI, Caliper, QTI, or SCORM.

## Package And Export Ownership

- Owning package: open question; likely split between `@pie-players/pie-players-shared` for process/event types and `@pie-players/pie-assessment-toolkit` for section slice helpers.
- Public export path: open question; candidate shape is `<owner>/process-events` plus explicit slice exports only when owning PRDs ratify them.
- Consuming packages or apps: future branching section variants, simulation section variants, event debugger tools, assessment-player, standards adapters, and hosts.
- Runtime environment: browser and adapter-only; process types should be Node-safe.

This PRD should not create concrete branching or simulation slices without naming their owners and semantics. It defines shared vocabulary and requirements for later slice PRDs.

## Contract Shape

The final names are not ratified by this draft. The contract should define process references and event payload families.

Documentation sketch only:

```ts
interface ProcessRunRef {
  attemptId: string;
  runId: string;
  parentRunId?: string;
}

interface BranchDecisionPayload {
  scenarioId: string;
  branchId: string;
  decisionId: string;
  selectedPathId: string;
  previousPathId?: string;
}

interface ProcessStepPayload {
  processId: string;
  stepId: string;
  order: number;
  state: "entered" | "completed" | "skipped" | "failed" | "resumed";
  externalOutcomeRef?: string;
}

interface ResumabilityMarker {
  run: ProcessRunRef;
  resumeToken?: string;
  lastStableStepId?: string;
  createdAt: number;
}
```

Branching and process event payloads should be typed event families consumed by the interaction event projection contract.

Named section slices, when introduced later, must define:

- key name;
- owning PRD;
- owner package/export path;
- whether the slice is delivery state, scoring state, or telemetry;
- merge and replace semantics;
- hydrate and persist semantics;
- unknown-host behavior: reject, drop, or round-trip under the ratified key;
- tests for replace, merge, hydrate, persist, and round-trip behavior.

## Compatibility

This PRD is additive and must not change current section-player or assessment-player event dispatch behavior. Process projections observe existing runtime surfaces and future section variants; they do not create alternate internal dispatch paths.

No alias maps, fallback normalizers, or compatibility shims should map old branch ids or event names to new ones unless a future accepted PRD explicitly scopes a `pie-item` client compatibility exception.

Source references that include PIE elements must preserve versioned tag names and contract identifiers unchanged.

## Data Ownership And Host Responsibilities

PIE owns:

- process and branch vocabulary;
- typed payload requirements for process event projections;
- requirements for named process section slices.

Hosts own:

- durable scenario/run storage;
- identity and actor policy;
- replay retention and audit policy;
- external grading service integration;
- reporting and workflow;
- privacy decisions about which process events are persisted or emitted to analytics.

## Serialization And Versioning

Process event projections are wire-facing data and require:

- versioned event records through the interaction event projection contract;
- stable attempt/run identifiers;
- explicit parent-child causality fields;
- unknown-version rejection for state-bearing process events;
- fixtures for branch decisions, step entry/completion, resume markers, and external outcome references.

Future section slices that persist branch or process state must include their own schema version and round-trip fixtures. Unknown hosts must not invent generic preservation behavior.

## Accessibility

Branching and process workflows often change visible content or move the learner through steps. Runtime PRDs that consume this contract must define:

- focus handoff when a branch or process step reveals new content;
- screen-reader announcements for path changes, required decisions, errors, and completion;
- keyboard paths for every decision and process transition;
- reduced-motion behavior for animated transitions;
- accommodation overrides where path restrictions would otherwise trap a learner.

This PRD only defines projection and state vocabulary; it does not implement UI behavior.

## Standards Or Adapter Impact

This contract is intended to support adapter-friendly xAPI/Caliper process statements and QTI profile/extensions. It does not claim conformance.

SCORM remains out of scope for this planning track.

## Test Plan

Required test coverage:

- typed payload fixtures for branch decisions, process steps, resumability, and external outcomes;
- tests that process event projections preserve source identity;
- tests that no generic `profileState` or untyped process persistence bag is introduced;
- slice-specific merge, replace, hydrate, persist, unknown-host, and round-trip tests when a slice is accepted.

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
- Migration notes: additive projection vocabulary; no existing branching state exists to migrate in this PRD.
- Documentation updates: future branching, simulation, timed-media, and adapter PRDs should link here when they define process slices.
- Release risk: medium, because vague process vocabulary could become a long-lived adapter constraint.

## Open Questions

- Which package owns process event types?
- Should branching and simulation share one process vocabulary or define separate payload families with a common base?
- What is the minimum resumability marker that is useful without implying PIE-owned durable storage?
- Which first section slice should ratify these rules: timed media, branching, or simulation?
