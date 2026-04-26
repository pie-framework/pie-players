---
'@pie-players/pie-assessment-toolkit': major
'@pie-players/pie-section-player': major
'@pie-players/pie-players-shared': major
---

Single canonical framework-error contract across `pie-assessment-toolkit`
and `pie-section-player` (M3 of the Coherent Options Surface track).

## What's new

- `FrameworkErrorBus` (synchronous, multi-subscriber) is the package-internal
  delivery primitive for any failure crossing the framework boundary.
  `<pie-assessment-toolkit>` owns the bus and runs a single subscriber that
  performs every side-effect (console log, optional fallback banner for
  fatal bootstrap kinds, DOM event emission, canonical prop delivery).
  Per-tool/provider hooks (`onProviderError`, `onTTSError`) are delivered
  through bus adapters and continue to fire for hosts that rely on them.
- `ToolkitCoordinator.subscribeFrameworkErrors(listener)` and
  `ToolkitCoordinator.reportFrameworkError(model)` are public bus
  surfaces for advanced integrations.
- `FrameworkErrorKind` is extended with `coordinator-init`, `runtime-init`,
  `tool-config`, and `tool-runtime`. A new
  `frameworkErrorFromCoordinatorContext(...)` helper builds a
  `FrameworkErrorModel` from a coordinator phase + error.
- Canonical `onFrameworkError(model: FrameworkErrorModel) => void` prop
  on `<pie-assessment-toolkit>`, every `<pie-section-player-…>` layout
  custom element, `<pie-section-player-base>`, and the
  `SectionPlayerLayoutKernel`. The toolkit delivers the model exactly
  once per error regardless of wrapper depth.
- Canonical `framework-error` entry on `SECTION_PLAYER_PUBLIC_EVENTS`
  and the `pie-toolkit-framework-error` / `pie-section-framework-error`
  instrumentation mappings.
- `RuntimeConfig.onFrameworkError` is the runtime-tier hook;
  `resolveRuntime` applies two-tier precedence
  (`runtime.onFrameworkError` wins over the top-level `onFrameworkError`
  prop) and the merged callback flows down through
  `effectiveRuntime → pie-section-player-base → pie-assessment-toolkit`.

## Breaking changes

- The `frameworkErrorHook` prop has been removed from
  `<pie-assessment-toolkit>`, every `<pie-section-player-…>` layout
  custom element, `<pie-section-player-base>`, and the
  `SectionPlayerLayoutKernel`. Use `onFrameworkError` directly.
- The `runtime-error` DOM event has been removed from
  `<pie-assessment-toolkit>` and every `<pie-section-player-…>` layout
  custom element. Subscribe to `framework-error` instead — its detail
  is a `FrameworkErrorModel`.
- The `pie-toolkit-runtime-error` and `pie-section-runtime-error`
  instrumentation event mappings have been removed. Subscribe to
  `pie-toolkit-framework-error` / `pie-section-framework-error`.

## Migration

```svelte
<!-- before -->
<pie-section-player-splitpane
  frameworkErrorHook={(detail) => console.error(detail)}
></pie-section-player-splitpane>

<!-- after -->
<script lang="ts">
  import type { FrameworkErrorModel } from '@pie-players/pie-assessment-toolkit';
  function onFrameworkError(model: FrameworkErrorModel) { console.error(model); }
</script>
<pie-section-player-splitpane {onFrameworkError}></pie-section-player-splitpane>
```

For event listeners: replace `runtime-error` listeners with
`framework-error` (detail is a `FrameworkErrorModel`).
