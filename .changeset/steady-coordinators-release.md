---
"@pie-players/pie-assessment-toolkit": patch
---

Make toolkit coordinator teardown explicit and race-safe.

`disposeSectionController` now relinquishes a controller before awaiting its
persistence, so a section reacquired during a delayed teardown receives a fresh
controller, waits for that cohort's persisted state before hydrating it, and
cannot be deleted by the old finalizer. The new
idempotent `ToolkitCoordinator.dispose()` releases coordinator-owned controllers,
providers, highlights, subscriptions, and policy state while leaving
host-supplied registries and error buses under host ownership. Toolkit custom
elements call it only for coordinators they created themselves. Teardown waits
for controller, coordinator, provider, and TTS initialization already in flight,
suppresses late ready notifications, and rejects late acquisitions instead of
returning disposed handles. Reactive initialization retired by a rerun or
unmount is treated as cancellation rather than a framework runtime error.
