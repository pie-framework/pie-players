---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Make section-player tool surfaces share one failure-isolated lifecycle.

`content-lead`, `content-media`, and `section-overlay` now delegate discovery,
policy and catalog invalidation, lazy loading, ordered mounting,
synchronization, and teardown to one internal Tool Surface Host. Existing
section-player custom-element tags, card placement, DOM hooks, CSS variables,
surface names, and host setup remain unchanged.

`ToolRegistry.onRegistryChange(listener)` is an additive synchronous observer
for successful registration, override, removal, clear, component-override, and
module-loader changes. Section-player uses it automatically: capabilities can
appear after mount, overrides remount the affected registration, and removal
destroys the mounted element without a host-forced rerender.

Surface lifecycle failures now emit an isolated `tool-surface` framework
warning with `recoverable: true`. A failing optional capability is omitted or
keeps its last working element while the assessment and other capabilities
continue. Recoverable framework warnings remain observable through the existing
event, hook, and coordinator routes but no longer force section readiness to
`error`; nonrecoverable errors retain the existing blocking behavior.
