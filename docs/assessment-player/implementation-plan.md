# Assessment Player Implementation Plan

This checklist is used during implementation and again after implementation to verify that the shipped result matches intended architecture.

## 1) Docs-First Foundation

- [ ] `docs/assessment-player/architecture.md` exists and defines:
  - [ ] Layer ownership (`assessment-player` coordinates, `section-player` renders, toolkit provides services).
  - [ ] Layout strategy (one built-in layout plus custom layout composition path).
  - [ ] Session layering (`AssessmentSession` over section sessions).
  - [ ] Hook naming convention (`create*`, `onBefore*`, `on*`).
- [ ] `docs/assessment-player/implementation-plan.md` exists and is maintained as work progresses.
- [ ] `docs/readme.md` links to assessment-player docs.

## 2) Package Scaffold

- [ ] `packages/assessment-player/` exists as `@pie-players/pie-assessment-player`.
- [ ] Package has exports for:
  - [ ] main entry
  - [ ] default layout CE registration entrypoint
  - [ ] shell CE registration entrypoint
  - [ ] runtime host contract types
  - [ ] public events constants/types
- [ ] Build + typecheck scripts follow package conventions.

## 3) Runtime Model And Session Contracts

- [ ] Assessment runtime model includes:
  - [ ] resolved section sequence
  - [ ] current section index/identifier
  - [ ] navigation snapshot (`canNext`, `canPrevious`)
  - [ ] coarse progress summary
- [ ] `AssessmentSession` contract exists and wraps section sessions.
- [ ] Section snapshots are stored as section-session payloads (no competing format).
- [ ] Assessment session persistence exists with a default strategy and host override hook.

## 4) Controller And Host Contract

- [ ] `AssessmentControllerHandle` exists with first-pass methods:
  - [ ] initialize/hydrate/persist
  - [ ] getSession/getRuntimeState
  - [ ] navigateTo/navigateNext/navigatePrevious
  - [ ] submit
  - [ ] subscribe
- [ ] Runtime host contract exists with compact CE-facing selectors/commands.
- [ ] `waitForAssessmentController()` style API exists for async readiness.

## 5) Extensibility Points

- [ ] Hook surface is minimal and naming is consistent with toolkit style.
- [ ] First-pass structural hooks exist for:
  - [ ] delivery-plan creation
  - [ ] assessment-session persistence
- [ ] Lifecycle/error/telemetry hooks are available where needed.
- [ ] Request/fact events are used instead of policy-specific hooks by default.
- [ ] Timing remains host-managed by default (no heavyweight built-in timing framework).

## 6) Layout And Composition

- [ ] At least one built-in layout CE exists and works.
- [ ] Built-in layout behavior:
  - [ ] renders current section via section-player
  - [ ] shows position in sequence
  - [ ] supports Back/Next with first/last disable behavior
- [ ] Shell/shared primitive exists for custom layout composition.
- [ ] Host can place custom UI around assessment-player primitives.

## 7) Section-Player Integration

- [ ] Assessment-player mounts one active section-player instance at a time.
- [ ] One toolkit coordinator can be reused across section switches.
- [ ] Section events are translated to assessment-level state/events.
- [ ] Section session state persists across section switches through assessment session.

## 8) Demo App

- [ ] `apps/assessment-demos/` exists.
- [ ] Includes at least one deterministic multi-section assessment demo.
- [ ] Demo validates:
  - [ ] back/next behavior
  - [ ] disabled first/last navigation
  - [ ] current position rendering
  - [ ] stable attempt/session continuity on refresh
  - [ ] preserved section responses when switching sections
- [ ] Demo can act as future e2e target.

## 9) Validation

- [ ] Package typecheck/build pass.
- [ ] Demo app check/build pass.
- [ ] Basic manual run validates routing and navigation behavior.
- [ ] Added tests cover:
  - [ ] controller navigation snapshots
  - [ ] persistence/hydration flow
  - [ ] section switch state preservation
  - [ ] emitted event contracts

## 10) Post-Implementation Conformance Review

After coding, verify all statements:

- [ ] Assessment-player stayed a coordinator, not a replacement for section-player/toolkit.
- [ ] API surface remained intentionally small.
- [ ] Host-policy boundary remained intact (timing/policy not over-prescribed).
- [ ] Hook naming stayed consistent.
- [ ] Built-in layout and custom composition path both shipped.
