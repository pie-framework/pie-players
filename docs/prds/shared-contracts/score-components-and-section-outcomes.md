# Score Components And Section Outcomes

Status: Draft, 2026-06-25

Not implemented and not scheduled. [Framework-completing work](../../architecture/framework-completing-work.md#classification) ranks the related cross-section mastery rollup separately.

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)
- [Scoring and rubrics](../../item-player/scoring-and-rubrics.md)

## Problem

PIE already has leaf scoring primitives, item session updates, section completion state, and assessment session snapshots. What is missing is a host-consumable projection that can explain how leaf outcomes contribute to item, section, and assessment outcomes without changing element-owned scoring or treating completion as correctness.

Without this contract, hosts and standards adapters must infer score authority, denominator policy, manual-score state, and aggregation behavior from package-specific session shapes.

The [formative delivery contract](../formative-delivery-contract.md) (`Accepted`) ships an item-level aggregation and a section rollup for one purpose: deciding whether a learner mastered an item. It settles three rules this contract inherits: aggregation follows the [persisted API scoring](../../item-player/scoring-and-rubrics.md#persisted-api-scoring) policy (a single outcome counts directly, several are averaged as normalized fractions); an item that cannot be auto-scored is `unknown`, never zero; and the rollup leaves items whose last outcome is `unknown` out of its denominator instead of asserting correctness it cannot know. It carries none of what this contract adds: `FormativeTryOutcome` has no provenance and no authority, since it is always a browser-derived preview, and the formative layer has no source reference, no manual or external state and no assessment-level projection. The formative rollup is one concrete consumer whose semantics `ScoreComponent` must be able to express: a projection that cannot represent "excluded because not scorable" would regress against shipped behavior.

## Goals

- Preserve element-owned leaf scoring through existing `OutcomeResponse` and related scoring primitives.
- Define score components that carry source, score, denominator, provenance, and authority.
- Define section and assessment outcome projections without forcing score fields into existing session snapshots.
- Keep absent score, zero score, not scorable, manual pending, preview, external, and final scores distinguishable.
- Define completion rollup separately from score aggregation.

## Non-Goals

- No changes to PIE element controller scoring APIs.
- No replacement for `pie-item-player.provideScore()` or `scorePieItem(...)`.
- No requirement that every item, section, or assessment be auto-scorable.
- No persisted gradebook, reporting, manual scoring workflow, or server-authoritative storage contract.
- No single universal aggregation policy for all hosts.

## Package And Export Ownership

- Owning package: proposed `@pie-players/pie-players-shared` for projection types that wrap existing scoring vocabulary.
- Public export path: open question; candidate shape is `<owner>/score-projection` or an addition to the package's type exports.
- Consuming packages or apps: `item-player`, `section-player`, `assessment-toolkit`, `assessment-player`, future adapters, and host applications.
- Runtime environment: browser, Node-safe, and adapter-only.

Controller methods or helper functions that compute projections may live in `assessment-toolkit` or player packages, but the public data shape should have one canonical type home.

The session shapes a projection reads are already canonical in that package: `AssessmentSession` lives in `@pie-players/pie-players-shared/types`, and the `@pie-players/pie-assessment-toolkit` root re-exports it.

## Contract Shape

The final names are not ratified by this draft. The contract should wrap leaf outcomes and optional aggregate fields with explicit source and authority.

Documentation sketch only:

```ts
type ScoreAuthority = "preview" | "auto" | "manual" | "external" | "server-authoritative";

type ScoreState =
  | "not-scorable"
  | "score-absent"
  | "manual-pending"
  | "scored";

interface ScoreComponent {
  source: InteractionSourceRef;
  state: ScoreState;
  authority: ScoreAuthority;
  outcome?: OutcomeResponse;
  points?: number;
  max?: number;
  weight?: number;
}

interface OutcomeProjection {
  version: 1;
  source: InteractionSourceRef;
  components: ScoreComponent[];
  aggregate?: {
    policy: "sum" | "average" | "weighted" | "host-defined";
    points?: number;
    max?: number;
    authority: ScoreAuthority;
  };
  completion?: CompletionProjection;
}
```

`InteractionSourceRef` is the source-reference sketch from the Draft [interaction event contract](./interaction-event-contract.md#contract-shape); no such type exists in code.

Completion projections should include source, authority, and terminal/provisional state. They must not imply correctness unless a score projection explicitly does so.

## Compatibility

This PRD may touch host-facing score and completion projections. It must not change:

- PIE element runtime/controller contracts;
- `pie-item-player` properties, events, or imperative methods;
- existing section session snapshots unless a later implementation PRD ratifies an additive field;
- existing assessment routing or submission behavior.

Projection sources that reference PIE elements must preserve versioned tag names and contract identifiers unchanged.

This PRD does not authorize fallback payload normalizers or compatibility shims for old score shapes. Any `pie-item` client compatibility exception must be explicitly justified in implementation and covered by tests.

## Data Ownership And Host Responsibilities

PIE owns:

- projection types for score components, aggregate outcomes, and completion provenance;
- optional helper functions for player-owned preview or aggregate projections;
- tests that distinguish score states and completion states.

Hosts own:

- authoritative persisted scores unless a future player PRD introduces an explicit persisted score snapshot field;
- manual scoring workflows;
- gradebook/reporting policy;
- rubric review, scorer identity, and audit logs;
- mapping score projections into product or standards-specific outcome records.

## Serialization And Versioning

Score and outcome projections are wire-facing data and require:

- `version: 1` on projection records;
- explicit interpretation of omitted fields, `undefined`, `null`, `0`, omitted `outcome`, and omitted `max`;
- validation by the owning package;
- unknown-version rejection for state-bearing projections;
- fixtures for zero score, absent score, not scorable, manual pending, preview score, external score, and final score.

Aggregation policy must state whether denominators are summed, averaged, weighted, or host-defined. A host-defined aggregate must not be interpreted by a generic adapter as a standard sum.

## Accessibility

This PRD has no direct UI change. Score and completion projections should preserve enough source data for accessible review and remediation workflows, but UI behavior belongs to player and host implementations.

## Standards Or Adapter Impact

This PRD should produce adapter-friendly data for QTI/PCI, LTI, xAPI, and Caliper. It does not claim standards conformance.

QTI outcome mapping belongs in [pie-qti](https://github.com/pie-framework/pie-qti) and should consume the accepted score projection rather than redefining score authority or denominator policy.

## Test Plan

Required test coverage:

- fixtures for every score state and authority;
- projection tests that wrap existing `OutcomeResponse` values without changing leaf scoring;
- aggregation tests for sum, average, weighted, and host-defined policies;
- completion projection tests proving completion and correctness remain separate;
- compatibility tests that current item scoring APIs still behave unchanged.

Commands:

```sh
bun run typecheck
bun run test
```

For custom-element, export-boundary, toolkit-core or player changes, also run the [high-value checks](../../../AGENTS.md#high-value-checks). Playwright-backed tests run outside the sandbox; see [Playwright and sandboxed execution](../../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes, if public exports are added.
- Migration notes: additive projection surface; existing session snapshots remain valid.
- Documentation updates: update scoring docs and adapter docs once accepted.
- Release risk: medium-high, because score authority and denominator mistakes can produce user-visible reporting errors.

## Open Questions

- Should `@pie-players/pie-players-shared` be the canonical type home?
- Should section score projections be controller methods, helper functions, host adapters, or a separate package?
- Which aggregation defaults, if any, should PIE provide?
