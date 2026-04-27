---
'@pie-players/pie-assessment-toolkit': minor
'@pie-players/pie-section-player': minor
'@pie-players/pie-section-player-tools-pnp-debugger': minor
---

Introduce the **tool policy engine** inside
`@pie-players/pie-assessment-toolkit` (M8 of the Coherent Options Surface
track). The engine consolidates every input that affects whether a tool
is visible at a given placement level — `tools` config + provider
registry + assessment / item QTI gates + `policy.allowed` /
`policy.blocked` lists + custom `PolicySource`s — into a single decision
pipeline that toolbars, the base section player, and host
instrumentation all consume. There is now exactly one place that
answers the question "does this tool show up here?".

Pre-1.0 lockstep release: every package in the `fixed` block is bumped
together at release time per the project versioning policy.

## What's new

### Two new public entry points on `@pie-players/pie-assessment-toolkit`

- `@pie-players/pie-assessment-toolkit/policy/engine` — narrow,
  semver-stable facade. Exports the `ToolPolicyEngine` factory along
  with the decision request / response types
  (`ToolPolicyDecisionRequest`, `ToolPolicyDecision`,
  `ToolPolicyEntry`, `ToolPolicyProvenance`,
  `ToolPolicyChangeListener`) and the `PolicySource` extension point.
- `@pie-players/pie-assessment-toolkit/policy/internal` — wider,
  evolving surface for advanced hosts. Exposes the built-in policy
  sources (placement, provider veto, allow/block, QTI gates) plus the
  resolved engine inputs type. **Stability disclaimer:** symbols here
  may change between minor versions with a changeset note.

### `ToolkitCoordinatorApi` policy surface

`ToolkitCoordinator` now owns a single `ToolPolicyEngine` instance and
exposes its decision and subscription surface through the API. New
methods on `ToolkitCoordinatorApi`:

- `decideToolPolicy(request)` — resolve the visible tool set for a
  given placement level + scope, returning the engine's full decision
  including diagnostics and per-tool provenance.
- `onPolicyChange(listener)` — subscribe to policy-engine change
  events. Fires whenever the coordinator's bound inputs change
  (`updateToolConfig`, `updateFloatingTools`, `updateAssessment`,
  `updateCurrentItemRef`, `setQtiEnforcement`) or a custom
  `PolicySource` is registered.
- `updateAssessment(assessment)` /
  `updateCurrentItemRef(itemRef)` — drive QTI inputs imperatively.
  Calling `updateAssessment` with a non-null assessment auto-promotes
  the engine to `qtiEnforcement: "on"` unless a host has previously
  pinned the mode via `setQtiEnforcement`.
- `setQtiEnforcement(mode)` — pin or clear the auto-mode QTI
  enforcement decision.
- `getPolicyInputs()` — read the engine inputs currently driving
  decisions (debugging / instrumentation).
- `registerPolicySource(source)` — register a custom `PolicySource`.
  The source participates in every subsequent `decideToolPolicy(...)`
  call until disposed.

### Toolbars and base player switched onto the engine

- `<pie-item-toolbar>` and `<pie-section-toolbar>` resolve their
  visible tool set through `coordinator.decideToolPolicy(...)` instead
  of duplicating placement / provider / QTI checks against the raw
  `tools` config. Local `tools=` props now exclusively serve the
  standalone-toolbar fallback path (when no coordinator is in scope).
- `<pie-section-player-base-element>` resolves annotation-toolbar
  visibility through the engine, eliminating the parallel
  `normalizeToolsConfig` / `resolveToolsForLevel` derivations.
- Each consumer subscribes via `onPolicyChange` and bumps a local
  `policyVersion` `\$state` to retrigger derivations whenever the
  engine inputs change mid-session.

### PNP debugger surfacing

`@pie-players/pie-section-player-tools-pnp-debugger`'s `PnpPanel`
switches off `coordinator.isToolEnabled` aggregation onto the engine's
decision surface, displaying full `ToolPolicyProvenance` and per-tool
feature trails alongside the existing PNP profile UI. Pure derivation
logic (input shaping, decision flattening, floating-tool resolution)
moves into a new `derive-panel-data.ts` module with its own unit-test
suite.

### Layered-architecture purity guard

A new `scripts/check-engine-core-purity.mjs` enforces that
`packages/assessment-toolkit/src/runtime/{core,adapter}/` (M7) and
`packages/assessment-toolkit/src/policy/{core,sources}/` (M8) stay
plain TS — no `svelte`/`svelte/*` imports, no
`@pie-players/pie-section-player*` imports, no `.svelte` resolution.
The guard runs as part of `bun run verify:publish`.

## Migration

Hosts that consume `<pie-item-toolbar>`, `<pie-section-toolbar>`, or
`<pie-section-player-{splitpane,vertical,tabbed,kernel-host}>` need no
source edits — the visible tool set still derives from the same
`tools` config + provider registry + QTI inputs, just routed through
the engine. Custom hosts that previously called
`coordinator.isToolEnabled(toolId)` for placement decisions should
migrate to `coordinator.decideToolPolicy({ level, scope }).visibleTools`
to pick up `policy.allowed` / `policy.blocked` and per-level QTI
gates.

Standalone uses of `<pie-item-toolbar>` (no parent
`<pie-assessment-toolkit>`) keep working: the `tools=` prop still
specifies the toolbar's visible set when no coordinator is in scope.
