# Framework-Owned Error Handling

## Summary

`pie-players` now owns baseline error handling for tools configuration and toolkit runtime initialization.  
Hosts no longer need to wrap section-player/toolkit bootstrapping in manual `try/catch` just to avoid blank UI.

The framework now does three things by default:

1. Logs deterministic console errors with a stable prefix:
   - `[pie-framework:<kind>:<source>]`
2. Renders a built-in fallback UI for fatal startup failures.
3. Emits a canonical `framework-error` event for optional host reactions.

`runtime-error` is still emitted for compatibility and now includes optional
`frameworkError` details when available.

---

## Why this change was made

Before this change, hosts had to combine several responsibilities:

- perform strict tools-config validation
- catch thrown validation/runtime initialization errors
- decide how to log the error
- implement user-facing fallback rendering

That created duplicated boilerplate and inconsistent behavior across integrations.

### Main problems observed

- **Blank/failed render risk** if host did not catch and render on startup failures.
- **Inconsistent logging** and error message quality across host apps.
- **Too many validation paths** (overlay and runtime checks happening in multiple places).
- **No single canonical error contract** for hosts to subscribe to.

---

## Design goals

- Keep host integration simple and consistent.
- Make framework behavior safe by default.
- Preserve compatibility where practical.
- Avoid introducing a competing integration style.
- Keep strict validation and diagnostics typed and deterministic.

---

## What changed

## 1) Typed framework error model

Added a shared error model in assessment-toolkit:

- `FrameworkErrorModel`
- `FrameworkErrorKind`
- `FrameworkErrorSeverity`
- conversion helpers for unknown errors and tools diagnostics/validation:
  - `frameworkErrorFromUnknown`
  - `frameworkErrorFromToolConfigDiagnostics`
  - `frameworkErrorFromToolConfigValidation`

Primary file:

- `packages/assessment-toolkit/src/services/framework-error.ts`

This model is exported from:

- `packages/assessment-toolkit/src/index.ts`

---

## 2) Toolkit-level error boundary behavior

`pie-assessment-toolkit` now catches initialization/disposal failures and reports them through the same framework model.

Primary file:

- `packages/assessment-toolkit/src/components/PieAssessmentToolkit.svelte`

### New default behavior

- Log to `console.error(...)` with framework prefix.
- Emit `framework-error` (canonical event).
- Emit `runtime-error` (compatibility signal) with optional `frameworkError`.
- Render built-in fallback UI when error is fatal (`recoverable !== true`).

### Error kind mapping note

During owned coordinator construction, failures currently surface as:

- `kind: "coordinator-init"`
- `source: "pie-assessment-toolkit"`

That includes strict tool-config validation failures thrown while constructing the
coordinator. The console details still include tool-config diagnostics (for
example, `[tool-config-validation:ToolkitCoordinator.init] ...`), but host logic
should not assume startup tool validation always emits `kind: "tool-config"`.

### Recoverable behavior note

Recoverable framework errors are still logged and emitted through
`framework-error` / `runtime-error`, but they do not trigger the built-in fatal
fallback panel. The default slot remains active when `recoverable === true`.

### Optional host extension points

- `onFrameworkError?: (errorModel) => void`
- `errorRenderer?: (errorModel) => { title?: string; details?: string[] }`

Hosts can react/customize, but framework provides safe defaults even without hooks.

---

## 3) Canonical validation pass ownership

Section-player runtime tools overlay resolution now preserves host-provided shape, and strict validation is performed during toolkit initialization.

Primary file:

- `packages/section-player/src/components/shared/section-player-runtime.ts`

This removes host-side shape correction/early throw paths and centralizes failure
surfacing through the toolkit boundary.

### Migration timing note

If your integration previously expected `resolveToolsConfig` to throw during
section-player runtime resolution, update that assumption. Invalid overlay/runtime
tool IDs now typically fail when the toolkit builds/initializes its coordinator.

---

## 4) `framework-error` propagation across wrappers

`framework-error` is re-emitted through section-player wrapper layers so host listeners work consistently regardless of integration depth.

Updated files:

- `packages/section-player/src/components/shared/SectionPlayerLayoutScaffold.svelte`
- `packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte`
- `packages/section-player/src/components/PieSectionPlayerBaseElement.svelte`
- `packages/section-player/src/components/PieSectionPlayerKernelHostElement.svelte`

---

## 5) Demo + tests for invalid config surfacing

The invalid tools-config demo now exercises framework-owned handling (no host try/catch fallback panel logic).

Updated/added:

- `apps/section-demos/src/routes/(demos)/invalid-tools-config/+page.svelte`
- `packages/section-player/tests/section-player-tool-config-error-surfacing.spec.ts`
- `packages/assessment-toolkit/tests/tool-config-validation.test.ts`

The e2e test verifies:

- framework console logging
- framework fallback UI rendering
- `framework-error` event emission

---

## Event and compatibility contract

### Canonical event

- `framework-error`

### Compatibility event

- `runtime-error`

`runtime-error` detail remains compatibility-first and now may include:

- `runtimeId`
- `error`
- `frameworkError?: FrameworkErrorModel`

Compatibility goal: existing host listeners continue to work, while new integrations
should prefer `framework-error`.

---

## Host integration guidance

For baseline safety:

- pass your runtime/tools config normally
- keep `toolConfigStrictness` as desired (`error`, `warn`, `off`)
- do not add host-level try/catch solely for bootstrap failure UX

For optional host-specific behavior:

- listen to `framework-error`
- provide `onFrameworkError` and/or `errorRenderer` when needed

---

## Operational outcome

This change standardizes startup failure behavior across `pie-players`:

- deterministic logs for developers
- predictable fallback for users
- typed and observable error contract for hosts

In short: safer defaults, less host boilerplate, and one canonical framework error-handling path.
