---
'@pie-players/pie-assessment-toolkit': patch
'@pie-players/pie-section-player': patch
---

Fix PIE-512: replay `content-loaded` events for late subscribers after
cohort transitions.

`ToolkitCoordinator.subscribeSectionEvents` already replays a single
`section-loading-complete` event to subscribers that attach after a
controller finishes loading, but had no equivalent for the per-renderable
`content-loaded` events that fire earlier in the sequence. Consumers that
attached their listeners after the section player had bootstrapped (e.g.
wrapper hosts that subscribe in response to `pie-section-controller-ready`,
or hosts navigating across asymmetric sections in a narrow split-pane
layout where the controller is recreated per cohort) silently missed every
`content-loaded` event for renderables that had already loaded.

The coordinator now replays one synthesized `content-loaded` event per
renderable reported as loaded by the controller's runtime state, in
registration order, immediately before the existing
`section-loading-complete` replay. The replay is strict: only renderables
explicitly reported in `runtimeState.loadedRenderables` are replayed, so
synthetic test harnesses and older controllers that don't populate the
field stay on the existing single-replay path.

`SectionControllerRuntimeState` gains an optional
`loadedRenderables: ReadonlyArray<{ itemId; canonicalItemId; contentKind }>`
field, populated by `SectionController.getRuntimeState` from
`loadedRenderableKeys` ∩ `trackedRenderables` in registration order. The
field is purely additive; existing consumers that ignore it are
unaffected.
