# Attempt Session Alignment Implementation Plan

## Goal

Implement a player-side alignment that introduces explicit `TestAttemptSession` naming while preserving compatibility with existing activity-oriented backend payloads (`activity`, `activityDefinition`, `activitySession`).

## Current Baseline

- `pie-players` currently uses `TestSession` naming in the assessment toolkit attempt runtime.
- Rollback removed or bypassed prior `TestAttemptSession` migration work.
- Existing section player runtime already centers around `itemSessions` and can consume backend-shaped payloads, but there is no explicit adapter contract that maps backend activity payloads into toolkit attempt/session semantics.

## Scope

- In scope:
  - Rename and re-export toolkit attempt/session runtime contracts to `TestAttemptSession` naming.
  - Introduce a dedicated backend-to-player adapter boundary in `pie-players`.
  - Update section player integration points to use adapter output and unified naming.
  - Document canonical mapping and migration notes for maintainers.
- Out of scope:
  - Backend API contract changes.
  - Datastore model/schema changes.

## Implementation Phases

## Phase 1: Introduce `TestAttemptSession` Contracts (Toolkit)

- Update `packages/assessment-toolkit/src/attempt/TestSession.ts`:
  - Rename core interfaces and helper APIs from `TestSession*` to `TestAttemptSession*`.
  - Keep temporary type aliases for backwards compatibility during migration:
    - `type TestSession = TestAttemptSession`
    - `type TestSessionNavigationState = TestAttemptSessionNavigationState`
  - Keep behavior identical; this phase is naming-only.
- Confirm all exports in `packages/assessment-toolkit/src/index.ts` include new symbols and preserve compatibility aliases.

### Deliverables

- Canonical runtime contracts available as `TestAttemptSession*`.
- No functional behavior changes in storage/restore/update helpers.

## Phase 2: Add Explicit Backend Adapter Boundary

- Create a focused adapter module in toolkit, for example:
  - `packages/assessment-toolkit/src/attempt/adapters/activity-to-test-attempt-session.ts`
- Define explicit inputs:
  - `activityDefinition`
  - `activitySession`
  - item session map / item refs
- Define explicit outputs:
  - `TestAttemptSession` snapshot
  - helper update payloads for section/item progress changes
- Ensure adapter is deterministic and side-effect free.
- Export adapter surface from toolkit entrypoint.

### Deliverables

- A single canonical transformation path from backend activity payloads to player attempt runtime.
- Strongly typed interface that prevents ad-hoc mapping in section player components.

## Phase 3: Integrate Section Player with Adapter

- Update `packages/section-player/src/PieSectionPlayer.svelte` to:
  - Consume adapter output where attempt/session state is initialized and updated.
  - Use `testAttemptSession` naming internally at integration points (allow transitional aliases only at boundary edges).
  - Keep `itemSessions` handoff behavior stable for child layout/item renderers.
- Keep external element API stable unless a coordinated breaking change is approved.

### Deliverables

- Section player uses one mapping path and one canonical runtime naming convention.
- No regressions in existing item navigation and item-session propagation.

## Phase 4: Public API and Migration Cleanup

- Remove temporary aliases from toolkit only after all consumers in repo are migrated.
- Verify no remaining `TestSession` imports in active package sources (except optional compatibility shim if retained intentionally).
- Add migration note in:
  - `packages/assessment-toolkit/README.md`
  - `packages/section-player/README.md`

### Deliverables

- Finalized naming consistency across player-facing runtime APIs.
- Clear migration notes for downstream integrators.

## Verification Plan

- Typecheck and build:
  - `packages/assessment-toolkit`
  - `packages/section-player`
  - any directly dependent player packages
- Add/adjust tests for:
  - adapter mapping correctness (activity payload -> `TestAttemptSession`)
  - section player initialization with mapped attempt session
  - navigation/session update behavior remains unchanged
- Run one end-to-end player flow:
  - load activity payload
  - render section
  - navigate/update item sessions
  - validate outbound state payload shape

## Work Breakdown (Suggested)

1. Naming refactor + compatibility aliases in toolkit.
2. Adapter introduction + unit tests.
3. Section player integration + targeted regression tests.
4. Docs + cleanup of transitional aliases.

## Risks and Mitigations

- Risk: naming migration leaks across many packages.
  - Mitigation: compatibility aliases in Phase 1, then controlled removal in Phase 4.
- Risk: subtle state-shape mismatch between backend payload and player runtime.
  - Mitigation: strict adapter typing and dedicated mapping tests.
- Risk: section player regressions during integration.
  - Mitigation: preserve existing item/session behavior and add focused regression coverage around navigation and session propagation.

## Success Criteria

- `TestAttemptSession*` is the canonical player runtime naming.
- Section player obtains runtime state through a single adapter path.
- Existing rendering and navigation behavior remains stable.
- Migration/documentation are complete and explicit.
