---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
---

PIE-512 Phase D cleanup: drop legacy `sectionId` / `attemptId` args from internal subscribe call sites; sharpen the migration narrative for typed integrations.

This is a follow-up to `0.3.35` — same active-cohort contract, no functional behavior change. It cleans up internal code that was still passing the now-ignored args, and adds an explicit migration recipe for typed integrators.

### BREAKING CHANGE (re-stated from `0.3.35` for clarity)

`coordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` no longer accept `sectionId` / `attemptId` arguments at the type level. The runtime silently ignores any extra unknown properties, so untyped or loosely-typed call sites continue to work, but **typed integrations that import `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs` directly and pass `sectionId` / `attemptId` will fail to compile against `>=0.3.35`.**

#### What this changes for typed integrations

| Before (`<0.3.35`)                                                                | After (`>=0.3.35`)                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `subscribeItemEvents({ sectionId, attemptId, listener })`                         | `subscribeItemEvents({ listener })`                                                          |
| Listener bound to one controller; manual re-subscribe needed on cohort change     | Listener follows the active cohort automatically; single subscribe survives navigation       |
| `subscribe*` was a no-op when called with an unknown `sectionId`                  | `subscribe*` throws if **no** active cohort exists; call it after the first `getOrCreateSectionController(...)` resolves |
| Subscribing the same listener function with different filter args added a second subscription | Subscribing the same listener function replaces the prior subscription (filter args from the second call win) |
| Listener throws bubbled up to the dispatcher and could break fan-out               | Listener throws are caught and `console.warn`-logged; fan-out to other listeners continues |

#### Action required

- **Drop** `sectionId` / `attemptId` from every `subscribeSectionEvents`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents` call site. The args have no runtime effect under `>=0.3.35`.
- **Move the subscribe call** to *after* the first `getOrCreateSectionController(...)` resolves (rather than synchronously on `toolkit-ready`).
- **Remove any re-subscribe-on-navigation logic.** A single subscribe call after the first controller-resolve is sufficient — the listener migrates automatically and gets a snapshot replay (`content-loaded` × N then `section-loading-complete`) on every cohort transition. **This is the most common breakage pattern**: hosts that previously detached and re-subscribed on every `toolkit-ready` (correct under the pre-Phase D pinned-subscription contract) will now observe **double snapshot replays** on every section navigation — once via Phase D auto-migration, then again from the manual re-subscribe. Listener handlers that are not strictly idempotent will fire twice (e.g. analytics `pageAction`s, increment counters that aren't Set-deduplicated, side-effecting hydration calls).
- **For intentionally-pinned subscriptions to a non-active section** (e.g. a host UI that wants to keep watching section A while displaying B), use `coordinator.getSectionController({ sectionId, attemptId })` and subscribe directly on the controller handle via `controller.subscribe?.(...)`. That binding is pinned to one controller instance and does not migrate.
- **Hand-rolled local structural types** that duplicate the public arg shape: drop the `sectionId` / `attemptId` properties from the local type so the local declaration matches the public contract. Otherwise the local type is misleadingly-wrong dead code at runtime.

#### Concrete simplification example

If your wrapper used the pre-Phase D detach-and-re-subscribe pattern on every `toolkit-ready` event:

```typescript
public handleToolkitReady(event: Event): void {
  const coordinator = (event as CustomEvent).detail?.coordinator;
  if (!coordinator) return;

  // Pre-Phase D: rebind for the new section.
  this.controllerUnsubscribe?.();
  const itemUnsub = coordinator.subscribeItemEvents({
    sectionId: this.sectionId, // pinned to currently-displayed section
    listener: handleItemEvent,
  });
  const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
    sectionId: this.sectionId,
    listener: handleSectionEvent,
  });
  this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
}
```

…simplify to subscribe **once** and let Phase D follow the active cohort:

```typescript
public handleToolkitReady(event: Event): void {
  const coordinator = (event as CustomEvent).detail?.coordinator;
  if (!coordinator) return;
  this.toolkitCoordinator = coordinator;

  // Phase D: subscribe once; the listener follows the active cohort
  // across all subsequent navigation. Bail if already subscribed.
  if (this.controllerUnsubscribe) return;

  const itemUnsub = coordinator.subscribeItemEvents({
    listener: handleItemEvent,
  });
  const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
    listener: handleSectionEvent,
  });
  this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
}
```

The full migration recipe with before/after code samples is in `packages/assessment-toolkit/README.md` under "Migrating from `<0.3.35`".

### Internal cleanup

Drops `sectionId` / `attemptId` from:

- `packages/section-player-tools-event-debugger/EventPanel.svelte` — local `ToolkitCoordinatorLike` structural type and the two coordinator subscribe call sites.
- `packages/section-player-tools-session-debugger/SectionSessionPanel.svelte` — same shape.
- `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` — the `EventPanelHandle` type and the in-page subscribe call sites.

These were dead-args at runtime under Phase D — the runtime ignores them, but their presence was misleading: the local types claimed args that the public API no longer accepts, and any future maintainer copy-pasting from those panels would write code that's TS-broken against the public types. No test or behavior change; the cleanup is purely contract-shape hygiene.

Also fixes a single overlooked `sectionId,` arg in `docs/section-player/client-architecture-tutorial.md` (post-0.3.35 doc-sweep straggler) and adds explicit migration notes to `packages/assessment-toolkit/README.md` and `packages/section-player/README.md`.

### Coverage

No new tests — this is a code-shape cleanup of internal call sites. Coverage for the Phase D contract itself is in:

- `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts` (12 cases)
- `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts` (3 cases)
- `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts` (3 cases)
- `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` (Playwright e2e, narrow-viewport A→B→A traversal)

All pass with the cleanup applied.
