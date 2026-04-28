# M7 Implementation Plan — Section Host Runtime Engine (Variant C)

> **Status:** locked design, pre-implementation.
> **Variant:** C — layered (core / adapter / facade), with two adjustments.
> **Posture:** rip-out (no compatibility aliases for surfaces this milestone removes; the only preserved compatibility surface is the `pie-item` client contract).
> **Optimization:** common host (single-section, default coordinator, default policies).
> **Release:** lockstep major across every publishable `@pie-players/*` package per `.cursor/rules/release-version-alignment.mdc`.

## 0. Source of truth

The full Variant C design rationale, API signatures, blast radius, and risk
analysis live at:

- `.cursor/plans/m7-design-variant-c-layered.md`

This implementation plan does NOT restate the design. It captures the locked
delta on top of that design and the executable migration sequence.

## 1. Locked adjustments to Variant C

### Adjustment A1 — Pre-flight audit before kernel-toolkit context-sharing lands

Before the step that switches the inner `<pie-assessment-toolkit>` to consume
the kernel's engine via Svelte context (Variant C migration step 5), audit
the four downstream surfaces:

- `apps/section-demos/src/routes/(demos)/**/*.svelte`
- `apps/assessment-demos/src/routes/(demos)/**/*.svelte`
- `apps/item-demos/src/routes/**/*.svelte`
- `../element-QuizEngineFixedFormPlayer/`, `../element-QuizEngineFixedPlayer/`, `../../kds/pie-api-aws/containers/pieoneer/`

For each: grep for handlers that subscribe to `pie-stage-change`,
`framework-error`, `pie-loading-complete`, or any `readiness-change` /
`interaction-ready` / `ready` legacy event on a `<pie-assessment-toolkit>`
element nested inside a `<pie-section-player-*>` element (rather than on
the outer layout CE).

Default decision when found: **rip out**, list impacted consumers in the M7
changeset under "Breaking changes — surface migration." If any consumer
cannot migrate in the same release window, escalate to maintainer before
landing migration step 5.

The audit lands as a one-PR docs-only commit (`m7-pre-flight-audit.md`)
captured under `.cursor/plans/`. It blocks step 5 but not steps 1–4.

### Adjustment A2 — `loading-complete` is an output, not an FSM state

Per the Variant C design, the FSM core has four canonical states that map
to M6 stages:

- `booting-section` → emits `composed`
- `engine-ready` → emits `engine-ready`
- `interactive` → emits `interactive`
- `disposed` → emits `disposed`

`loading-complete` is **not** an FSM state. It is a `SectionEngineOutput`
emitted from the `interactive` state when readiness signals satisfy
`allLoadingComplete` — same observable behavior as today's
`pie-loading-complete` event, just centralized in the engine. This
adjustment is just a fence against a future contributor drifting toward
Variant B's pattern; the Variant C design already follows it.

## 2. Migration sequence (executable)

Each step is one logical PR that ships green at HEAD. Build order from
`.cursor/rules/build-before-tests.mdc` applies between each PR.

### PR 1 — Introduce the core skeleton (no callers)

**Files added:**
- `packages/assessment-toolkit/src/runtime/core/cohort.ts`
- `packages/assessment-toolkit/src/runtime/core/engine-state.ts`
- `packages/assessment-toolkit/src/runtime/core/engine-input.ts`
- `packages/assessment-toolkit/src/runtime/core/engine-output.ts`
- `packages/assessment-toolkit/src/runtime/core/engine-transition.ts` (pure transition function; total over `(state, input)`)
- `packages/assessment-toolkit/src/runtime/core/engine-resolver.ts` (verbatim absorption of `resolveRuntime` + `resolveSectionPlayerRuntimeState` from `packages/section-player/src/components/shared/section-player-runtime.ts`; the original module still exports its versions)
- `packages/assessment-toolkit/src/runtime/core/engine-readiness.ts` (verbatim absorption of `createReadinessDetail` from `section-player-readiness.ts`)
- `packages/assessment-toolkit/src/runtime/core/engine-stage-derivation.ts` (state → Stage helper)
- `packages/assessment-toolkit/src/runtime/core/SectionEngineCore.ts`

**Tests added:**
- `packages/assessment-toolkit/tests/runtime/core/engine-resolver.test.ts` — every assertion from the existing `packages/section-player/tests/section-player-runtime.test.ts`, re-pointed at the new path.
- `packages/assessment-toolkit/tests/runtime/core/engine-transition.test.ts` — exhaustive `(state, input) → outputs` table including failure paths and cohort change.
- `packages/assessment-toolkit/tests/runtime/core/engine-readiness.test.ts` — assertions from `packages/section-player/tests/section-player-readiness-events.spec.ts` re-pointed.

**Constraint:** no file under `core/` may import from `svelte`. CI check
or `bun run check:source-exports` should catch it; if not, add an explicit
grep guard in `scripts/`.

**Acceptance:** build green, new tests pass, no behavior change anywhere.

### PR 2 — Introduce the adapter skeleton (no callers)

**Files added:**
- `packages/assessment-toolkit/src/runtime/adapter/SectionEngineAdapter.ts`
- `packages/assessment-toolkit/src/runtime/adapter/coordinator-bridge.ts`
- `packages/assessment-toolkit/src/runtime/adapter/dom-event-bridge.ts`
- `packages/assessment-toolkit/src/runtime/adapter/legacy-event-bridge.ts`
- `packages/assessment-toolkit/src/runtime/adapter/framework-error-bridge.ts`
- `packages/assessment-toolkit/src/runtime/adapter/instrumentation-bridge.ts`
- `packages/assessment-toolkit/src/runtime/adapter/subscriber-fanout.ts`
- `packages/assessment-toolkit/src/runtime/internal.ts` (re-exports adapter + core types for advanced hosts and tests)

**Tests added:**
- `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge.test.ts` — fake coordinator emits framework errors and lifecycle events; assert correct core inputs delivered, exception isolation matches `framework-error-bus`.
- `packages/assessment-toolkit/tests/runtime/adapter/dom-event-bridge.test.ts` — fake host element collects events; for each `SectionEngineOutput`, assert the right DOM event fires in the right order; `StageTracker`-guarded out-of-order drop case.
- `packages/assessment-toolkit/tests/runtime/adapter/legacy-event-bridge.test.ts` — `readiness-change`, `ready`, `interaction-ready`, `pie-loading-complete` payloads byte-for-byte match what the kernel `$effect` cluster emits today.
- `packages/assessment-toolkit/tests/runtime/adapter/engine-disposal.test.ts` — disposal idempotence; coordinator ownership respected; cohort change does not dispose an injected coordinator.

**Constraint:** the adapter is a plain TS class. Must not import
`svelte`. Adds an `assertNever` exhaustiveness switch in the output
dispatcher.

**Acceptance:** build green, new tests pass, no behavior change in CEs.

### PR 3 — Refactor the facade

**Files edited:**
- `packages/assessment-toolkit/src/runtime/SectionRuntimeEngine.ts` — replace the body with the layered facade (≤ 50 LoC of glue). Existing public methods (`register`, `unregister`, `getCanonicalItemId`, …) are kept and delegate to the adapter / registry.
- `packages/assessment-toolkit/src/index.ts` — re-export facade unchanged; add internal re-export.
- `packages/assessment-toolkit/package.json` — add `./runtime/engine` and `./runtime/internal` exports.

**Tests added:**
- `packages/assessment-toolkit/tests/runtime/SectionRuntimeEngine.test.ts` — common-host smoke test: 5-line happy path, four-stage sequence observable via `subscribe` and via DOM events on a jsdom-style host; strict vs progressive readiness mode; `getEffectiveRuntime()` matches the resolver's pure output.

**Constraint:** existing `PieAssessmentToolkit.svelte` still drives the
seed; the refactor keeps its observable behavior identical at this PR
boundary. No section-player or toolkit CE code changes yet.

**Acceptance:** existing toolkit tests still pass; new facade test passes;
`bun run check:custom-elements` clean.

### PR 4 — Pre-flight audit (Adjustment A1)

**Deliverable:**
- `.cursor/plans/m7-pre-flight-audit.md` — table of every consumer that subscribes to engine events on a nested `<pie-assessment-toolkit>` rather than the outer layout CE. Categorize each as: rip-out-safe, requires-migration, requires-dual-emit-window.

**Acceptance:** the audit is complete and the implementor (you, or the
maintainer) signs off on the rip-out posture for migration step 5.

If the audit surfaces consumers that cannot migrate in the same release
window, **stop here and escalate**. Do not proceed to PR 5.

### PR 5 — Move the kernel onto the engine

**Files edited:**
- `packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte` — delete the stage-progression `$effect` cluster (lines ~459–593) and the cohort-reset `$effect`. Replace with `engine.attachHost(host)` + `engine.updateInputs(buildInputs())` driven by a single tracked `$effect` wrapped in `untrack`. The kernel keeps composition snapshot derivation, scaffold wiring, focus management, navigation API.
- `packages/section-player/src/components/PieSectionPlayerKernelHostElement.svelte` — drop the `effectiveOnFrameworkError` derived chain and any `resolveOnFrameworkError` shim; consume engine outputs via context.
- `packages/section-player/src/components/PieSectionPlayerSplitPaneElement.svelte` / `Vertical` / `Tabbed` / `Base` — drop in-CE resolver shims; pass through to the kernel which owns the engine.
- The kernel exports the engine via a new Svelte context key `SECTION_RUNTIME_ENGINE_KEY` from `packages/assessment-toolkit/src/runtime/SectionRuntimeEngine.ts`.

**Tests adjusted:**
- `packages/section-player/tests/section-player-runtime.test.ts` — re-point import path; assertions unchanged.
- `packages/section-player/tests/m5-mirror-rule.test.ts` — re-point import path; `RUNTIME_TIER_CONSUMERS` table updated.
- `packages/section-player/tests/section-player-stage-tracker.test.ts` — assert via engine subscription; tracker primitive itself unchanged.
- E2E specs (`section-player-event-panel.spec.ts`, `section-player-toolkit-observability.spec.ts`, `section-player-readiness-events.spec.ts`) re-validate after the rebuild. The legacy event chain still fires (during the dual-emit window).

**Build constraint:** rebuild `packages/assessment-toolkit` before
running section-player tests (per `.cursor/rules/build-before-tests.mdc`).

**Acceptance:** all section-player unit + e2e tests green. The legacy
event chain still emits because the dual-emit window is still open.

### PR 6 — Move the toolkit onto the engine

**Files edited:**
- `packages/assessment-toolkit/src/components/PieAssessmentToolkit.svelte` — delete coordinator construction (`buildOwnedCoordinator`, `effectiveCoordinator` derived chain at lines ~628–689), delete the `frameworkErrorBus` instantiation, delete the stage progression `$effect` cluster (lines ~204–270, ~1176–1274), delete register/unregister/content-loaded listener bodies. Toolkit becomes: when wrapped under a layout kernel it consumes the engine via `SECTION_RUNTIME_ENGINE_KEY` context; standalone it constructs its own engine. The toolkit retains its prop declaration, error-banner UI, `assessmentToolkitRuntimeContext` provider wiring, instrumentation bridge attachment, and external API.

**Tests adjusted:**
- `packages/assessment-toolkit/tests/toolkit-coordinator-framework-error.test.ts` — assertions on the bus stay; CE-level assertions switch to engine-level.
- `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts` — same.
- `packages/assessment-toolkit/tests/toolkit-coordinator-tts-reconfigure.test.ts`, `toolkit-coordinator-telemetry.test.ts` — re-validate; coordinator construction site moved but contract unchanged.

**Acceptance:** all toolkit unit + e2e tests green. Standalone-toolkit
flow and kernel-wrapped-toolkit flow both produce one engine instance
each (audit by adding a one-line debug log in PR-only diagnostic
commit, or by asserting `stageTracker` count via Playwright DOM probe).

### PR 7 — Rip out the duplicate resolver in section-player and delete the dead files

**Files deleted:**
- `packages/section-player/src/components/shared/section-player-runtime.ts` (after PR 5/6 made it a re-export shim; now nothing in section-player imports it)
- `packages/section-player/src/components/shared/section-player-readiness.ts` (folded into `engine-readiness.ts`)
- `packages/section-player/src/components/shared/section-player-stage-tracker.ts` (already a re-export shim; not needed)

**Files edited:**
- Update internal imports in section-player components to point at the relocated resolver via `@pie-players/pie-assessment-toolkit/runtime/engine` or `@pie-players/pie-assessment-toolkit/runtime/internal`.
- `packages/section-player/src/contracts/public-events.ts` — comments only, mark deprecated event entries as routed via engine.

**Posture decision (locked):** rip-out. Section-player no longer
re-exports the moved symbols. Internal contract surface remains.

**Acceptance:** `bun run check:source-exports`, `bun run check:consumer-boundaries`,
`bun run check:custom-elements` all clean. `bun run typecheck` clean.

### PR 8 — Docs + changeset + final sweep

**Files edited:**
- `packages/section-player/ARCHITECTURE.md` — replace the "kernel owns resolver" diagram and section with the layered engine model. Reference the new `dist`-published `runtime/engine` and `runtime/internal` paths.
- `packages/section-player/README.md` — update API summary.
- `packages/assessment-toolkit/README.md` — document the engine surface, the facade vs. internal split, the common-host wiring example.
- `docs/section-player/client-architecture-tutorial.md` — update if the kernel-toolkit wiring is illustrated.

**Files added:**
- `.changeset/m7-section-runtime-engine.md` — `major` for every package in the `fixed` block per `.cursor/rules/release-version-alignment.mdc`. Lists:
  - Engine consolidation: section-player resolution + readiness + coordinator lifecycle now live in `@pie-players/pie-assessment-toolkit/runtime/engine`.
  - Single engine instance per cohort (one `StageTracker` per cohort instead of two).
  - Removed: any deprecated alias surface this milestone touched (per the rip-out posture; details in the changeset).
  - Migration: hosts that listen to `pie-stage-change` / `framework-error` / `pie-loading-complete` on the outer layout CE keep working; hosts listening on the inner `<pie-assessment-toolkit>` when nested must migrate (see pre-flight audit).
  - New `dist` exports under `@pie-players/pie-assessment-toolkit`.

**Final sweep:**
- `bun run check:source-exports`
- `bun run check:consumer-boundaries`
- `bun run check:custom-elements`
- `bun run typecheck`
- `bun run test`
- `bun run test:e2e:section-player:critical` (with `required_permissions: ["all"]` per `playwright-sandbox.mdc`)
- `bun run test:e2e:assessment-player` (same)
- `bun run verify:publish` (per fixed-versioning rule)

**Acceptance:** all gates clean; M7 ready for review and lockstep release.

## 3. Estimate

- **Total PRs:** 8 (one is docs-only audit at PR 4).
- **Lines moved:** ~750 LoC removed from section-player; ~900 LoC added in
  the toolkit's `runtime/`. Net delta: small positive but reorganized into
  testable shapes.
- **New files:** ~14 (9 source + 5 test); ~3 deletions in section-player.
- **Test surface:** ~12 new test files (pure unit + adapter integration +
  facade smoke). Existing tests adjust import paths only.
- **External consumers:** zero source edits required; lockstep major bump
  carries them.

## 4. Verification gates

After each PR (and especially after PRs 5, 6, 7):

```sh
bun install
bun run build
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

Targeted e2e on PR 5 (kernel switch) and PR 6 (toolkit switch):

```sh
bun run test:e2e:section-player:critical   # required_permissions: ["all"]
bun run test:e2e:assessment-player         # required_permissions: ["all"]
```

Final sweep (PR 8):

```sh
bun run verify:publish
```

## 5. Out of scope for M7

Explicitly NOT addressed by this milestone:

- The 4 pre-existing `effect_update_depth_exceeded` errors in the
  assessment-player flow (tracked under `fix-effect-update-depth`).
  M7's structural commitment to a plain-TS adapter reduces the surface
  for new such errors but does not investigate or fix the existing ones.
- M8 (Tool policy engine) — independent design pass; can run in parallel
  with M7 implementation.
- M9 (single floating-tool stack) and M10 (naming hygiene) — sequenced
  after M7 per the umbrella plan.

## 6. Roll-back posture

If a single PR (5, 6, or 7) needs to roll back after merge:

- PRs 1–4 are fully additive: rolling back any single one requires only
  reverting that PR.
- PR 5 (kernel switch) is the riskiest. Rollback path: revert PR 5 and PR
  6; the engine code (PRs 1–3) stays in tree but is unused. No external
  consumer breakage because the engine lives in the toolkit's `runtime/`
  exports which are additive at that point.
- PR 7 (delete moved files) is the only PR that removes from
  section-player. If a downstream consumer surfaces a dependency on the
  deleted re-exports, rollback path: re-introduce the re-export shim
  from PR 7's deletions while keeping the toolkit-side resolver as the
  source of truth.

The lockstep major release should land after the full M7 chain is in
`develop` and a passing CI sweep, not incrementally per PR.
