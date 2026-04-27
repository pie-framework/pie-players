---
'@pie-players/pie-section-player': minor
'@pie-players/pie-assessment-toolkit': minor
'@pie-players/pie-players-shared': minor
---

Consolidate the section runtime engine inside
`@pie-players/pie-assessment-toolkit` (M7 of the Coherent Options Surface
track). Section-player's resolver, readiness derivation, stage tracker,
and coordinator lifecycle now live behind a single layered engine that
the kernel and the toolkit CE both consume — giving hosts one
externally observable lifecycle event chain per cohort regardless of
wrapper depth.

Pre-1.0 lockstep release: every package in the `fixed` block is bumped
together at release time per the project versioning policy.

## What's new

### Two new public entry points on `@pie-players/pie-assessment-toolkit`

- `@pie-players/pie-assessment-toolkit/runtime/engine` — narrow,
  semver-stable facade. Exports `SectionRuntimeEngine`,
  `SECTION_RUNTIME_ENGINE_KEY` (Svelte context),
  `sectionRuntimeEngineHostContext` (cross-CE bridge),
  `connectSectionRuntimeEngineHostContext` (consumer-side helper for
  that bridge), and a small number of supporting types
  (`SectionRuntimeEngineHostArgs`, `SectionRuntimeEngineContext`,
  `SectionRuntimeEngineHostContextValue`,
  `SectionRuntimeEngineHostContextListener`).
- `@pie-players/pie-assessment-toolkit/runtime/internal` — wider,
  evolving surface for advanced hosts. Exports `SectionEngineCore`,
  `SectionEngineAdapter`, the five adapter bridges
  (`createDomEventBridge`, `createFrameworkErrorBridge`,
  `createLegacyEventBridge`, `createCoordinatorBridge`,
  `createInstrumentationBridge`), `FrameworkErrorBus`, cohort helpers
  (`makeCohort`, `cohortKey`, `cohortsEqual`), the resolver helpers
  (`resolveRuntime`, `resolveToolsConfig`,
  `resolveSectionEngineRuntimeState`, `resolveOnFrameworkError`), the
  readiness helpers (`createReadinessDetail`, `resolveReadinessPhase`),
  and the `DEFAULT_*` runtime constants. **Stability disclaimer:**
  symbols here may change between minor versions with a changeset note.
  Hosts that need long-term stability should depend on the facade.

### Single-engine invariant (externally observable)

When `<pie-assessment-toolkit>` is nested inside a section-player
layout CE (`<pie-section-player-splitpane>`, `-vertical`, `-tabbed`,
`-kernel-host`), the layout kernel publishes its engine reference via
`sectionRuntimeEngineHostContext`. The toolkit detects that upstream
engine and **suppresses its own external lifecycle DOM emits and stage
tracker** in favor of the kernel's engine.

- **Before M7:** a kernel-wrapped toolkit produced two `StageTracker`
  instances per cohort — one in the kernel and one in the toolkit —
  which doubled `pie-stage-change` emissions and forced hosts to
  deduplicate.
- **After M7:** the externally observable invariant is one cohort =
  one canonical event chain on the layout host (one
  `pie-stage-change` per stage, one `pie-loading-complete` per
  cohort), regardless of wrapper depth. During the current 0.x line
  the toolkit still constructs a local engine for its controller-side
  surface (`register`, `handleContent*`, `initialize`); a future
  release collapses that surface onto the upstream engine. Standalone
  `<pie-assessment-toolkit>` (no upstream context) emits from its own
  engine.

### Layout-host event contract pinned

- `pie-stage-change` and `pie-loading-complete` are dispatched on the
  outer layout CE by the engine's `dom-event-bridge`. Existing hosts
  that listen on the layout CE for these events keep working
  unchanged.
- `framework-error` is *also* dispatched on the layout CE by the
  engine's `framework-error-bridge`, but the layout host currently
  receives **two** `framework-error` DOM events per error while a
  toolkit is nested: one from the engine bridge plus one bubbled up
  (`bubbles: true, composed: true`) from the toolkit's inner emit.
  The dual-emit is pinned by
  `tests/section-player-framework-error-dual-emit.test.ts` and will be
  collapsed in a future release. The canonical `onFrameworkError`
  callback prop and the package-internal `FrameworkErrorBus` deliver
  exactly once per error regardless of wrapper depth — hosts that
  need single-fire notification should consume those.

### Resource-monitor effect safety (`@pie-players/pie-players-shared`)

`useResourceMonitor` now wraps its subscription-setup `$effect` body
in `untrack(...)` per `.cursor/rules/svelte-subscription-safety.mdc`,
preventing `effect_update_depth_exceeded` reactive feedback loops
during instrumentation provider rebinding. No API change.

## Removed (internal)

The following section-player internals were deleted; no host or
external consumer imported these:

- `packages/section-player/src/components/shared/section-player-runtime.ts`
- `packages/section-player/src/components/shared/section-player-readiness.ts`
- `packages/section-player/src/components/shared/section-player-stage-tracker.ts`

Their replacements live in
`@pie-players/pie-assessment-toolkit/runtime/internal` (canonical) and
`packages/section-player/src/components/shared/section-player-host-runtime.ts`
(the player-coupled wrapper that holds resolver pieces depending on
section-player–specific defaults like `DEFAULT_PLAYER_DEFINITIONS`).

## Migration

No source edits are required for hosts that listen on the outer
layout CE for `pie-stage-change`, `pie-loading-complete`, or
`framework-error`. The deprecated readiness aliases
(`readiness-change`, `interaction-ready`, `ready`) continue to
dual-emit through the engine's `legacy-event-bridge` for the current
0.x compatibility window. `section-controller-ready` continues to be
dispatched separately by the kernel's Svelte `createEventDispatcher`
(forwarded by each layout CE wrapper); new host code should use
`coordinator.waitForSectionController(sectionId, attemptId)` or
filter `pie-stage-change` on `detail.stage === "engine-ready"`.

Hosts that listen for these events on the inner `<pie-assessment-toolkit>`
when nested inside a section-player layout should migrate to listen on
the outer layout CE — the engine routes those events on the layout
host, not the toolkit's inner shadow root.

For custom layout shells that previously imported from the deleted
section-player files, switch to:

- `resolveRuntime`, `resolveToolsConfig`,
  `resolveSectionEngineRuntimeState`, `createReadinessDetail`:
  `@pie-players/pie-assessment-toolkit/runtime/internal`
- `resolvePlayerRuntime`, `mapRenderablesToItems`,
  `resolveSectionPlayerRuntimeState`:
  `packages/section-player/src/components/shared/section-player-host-runtime.ts`
  (in-package; consumers should not depend on this path)
