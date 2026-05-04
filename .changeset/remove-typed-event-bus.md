---
"@pie-players/pie-assessment-toolkit": patch
---

Remove unused `TypedEventBus` from the public API.

`TypedEventBus` was a generic ~80-LOC `EventTarget` wrapper exported as a "building block" that nothing inside the toolkit used. The toolkit's actual event surfaces deliberately rely on different patterns:

- Controller streams use `controller.subscribe(listener)` returning a disposer and dispatching a strongly-typed discriminated union (`SectionControllerEvent`).
- `ToolkitCoordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` use the same disposer + filtered fan-out shape.
- `FrameworkErrorBus` is a hand-rolled bus with a documented contract (synchronous fan-out, listener isolation, snapshot iteration, idempotent unsubscribe, no replay) — guarantees `EventTarget` does not provide.
- `I18nService` uses a plain `Set<() => void>` and intentionally does not bubble through the DOM.
- DOM `CustomEvent`s on `<pie-assessment-toolkit>` cover host-facing communication and are typed via the constants in `runtime/registration-events.ts`.

### BREAKING CHANGE (typed integrations only)

`TypedEventBus` is no longer exported from `@pie-players/pie-assessment-toolkit`. Hosts that imported it can drop in any of:

- A bare `EventTarget` + `CustomEvent` (the wrapper added almost nothing on top).
- A small bus library (`mitt`, `nanoevents`, etc.) — equivalent shape, more familiar to most teams.
- A purpose-built listener `Set` plus a typed `subscribe(listener)` disposer pattern, which is what the toolkit's own services do.

No replacement is shipped; the export is removed outright because there were no internal call sites and the public-facing surface was already documented as "exported as a building block, not used internally" in both the package README and the marketing docs.
