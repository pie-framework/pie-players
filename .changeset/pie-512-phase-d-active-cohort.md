---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

fix(PIE-512): make `subscribeSectionEvents` follow the active section cohort across navigation (Phase D)

Phase B/C addressed engine-side replay and same-section `updateInput` regressions but
left a final residual flake: `coordinator.subscribeItemEvents` and
`coordinator.subscribeSectionLifecycleEvents` bound a listener to the section
controller that was active **at subscribe time**. A host that subscribes once
on `toolkit-ready` and then navigates between sections — without re-subscribing
— stayed pinned to the original controller and silently missed `content-loaded`
/ `section-loading-complete` events from the new cohort. Demos that remounted
the layout custom element on navigation (via `{#key}` or equivalent) avoided
the bug; a host that keeps the element persistent (the supported pattern) hit
it on every cross-section navigation.

### What changes

- `subscribeSectionEvents`, `subscribeItemEvents`, and
  `subscribeSectionLifecycleEvents` now bind to the toolkit's *active section
  cohort* and automatically migrate across cohort transitions. On every
  migration the listener is detached from the old controller, attached to the
  new one, and replayed the new cohort's snapshot (`content-loaded` × N in
  registration order, then `section-loading-complete` if applicable) — the
  same ordering a fresh subscriber would have observed.
- `subscribeSectionEvents` now throws when no active cohort exists; host code
  must call `getOrCreateSectionController(...)` at least once before
  subscribing. (`toolkit-ready` alone is not sufficient.) The typical
  pattern is a single subscribe right after the first
  `getOrCreateSectionController(...)` resolves — that subscription then
  follows all subsequent navigation without further wiring.
- Subscribing the same listener function twice replaces the prior
  subscription (filter args from the second call win); the dedup key is
  listener identity alone, no per-section key.
- A listener that throws is caught and `console.warn`-logged; the throw does
  not interrupt fan-out to other listeners (matches the
  `FrameworkErrorBus` isolation pattern).
- `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, and
  `SectionScopedEventSubscriptionArgs` no longer declare `sectionId?` /
  `attemptId?` properties. **Type-level breaking change** for consumers
  importing these types directly. Runtime tolerates extra unknown
  properties, so existing call sites that still pass `sectionId` /
  `attemptId` continue to run unchanged — the args are simply ignored
  and the subscription follows the active cohort.
- `getSectionController({ sectionId, attemptId })` is **unchanged**; it is
  still keyed by id and remains the right call when reading state from
  inactive (persisted) sections.

### Why this is expected to be the final pass on PIE-512

- Removes the only remaining subscribe-time staleness path. No new corner-case
  branches, no timing dependency, no flag — single canonical contract.
- Coordinator-side dead code (`resolveSectionSubscriptionEntry`,
  `resolveSectionControllerForSubscription`,
  `detachSectionEventSubscriptionsForMapKey`, the listener-id /
  composite-key bookkeeping) is deleted; the active-cohort registry
  collapses subscription state to one Map keyed by listener identity.

### Coverage

- `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts`
  (new) — 12 coordinator-only synthetic-harness tests covering active-cohort
  binding, migration with replay, replay ordering, the no-active-cohort
  throw, listener throw isolation, snapshot-safe unsubscribe during
  fan-out, same-cohort `updateInput` no-op, re-entrant subscribe during
  migration replay, and back-compat tolerance of legacy `sectionId` args.
- `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts`
  (new) — bridge + real-`ToolkitCoordinator` integration test mirroring
  Darin's persistent-host wrapper pattern: `resolveSectionController(A) →
  resolveSectionController(B)` migrates a coordinator-bound listener with
  replay, `bridge.dispose()` detaches, and stale token rollovers do not
  dispatch a duplicate `section-controller-resolved` core input.
- `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts`
  — pre-existing PIE-512 regression pins, with `sectionId` arg dropped to
  match the Phase D shape; the three tests still pin live delivery on
  cohort flips, A→B→A round-trips, and asymmetric multi-item replays.
- `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
  — cleanup pass: rewrote "replaces existing subscription" to pin
  listener-identity dedup, deleted "ambiguous without attempt id"
  (no longer reachable), dropped `sectionId` args from all subscribes.

### Pre-fix failure gate

Before any production code changed, the new + edited tests were run against
the pre-fix source: 10 of 17 targeted tests failed in the expected ways
(ambiguous-section throws, missed migrations, no throw isolation, missing
back-compat tolerance, missing bridge replay). The 7 that passed against
pre-fix source pin orthogonal invariants (single-cohort replay ordering,
dispose-detach, snapshot-safe iteration). All 27 pass against the Phase D
implementation.

### Migration notes for type consumers

If your code imports `SectionEventSubscriptionArgs`,
`SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs`
directly, drop the `sectionId?` / `attemptId?` properties from your call
sites — the runtime ignores them. Hosts using local hand-rolled structural
types (e.g. an Angular wrapper) need no changes at compile time and pick
up the runtime fix automatically.
