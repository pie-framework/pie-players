---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

fix(PIE-512): preserve controller lifecycle on same-section updateInput and always replay registry into resolved controller (Phase C)

Phase B (released as `0.3.33`) replayed the engine's `RuntimeRegistry` into the
new cohort's controller when the cohort flip resolved to a fresh controller —
fixing the persistent-shell case. It left two related gaps that surfaced as
intermittent regressions in the consumer's narrow-viewport (passage-only)
flow:

- `SectionController.initialize` ran `resetLifecycleTracking()` unconditionally,
  so any `updateInput` (which `ToolkitCoordinator.resolveExistingSectionController`
  always invokes when the engine resolves the existing controller) wiped
  `trackedRenderables`, `loadedRenderableKeys`, and `sectionLoadingComplete`.
  A subscriber that attached between the wipe and the next live event saw
  empty `runtimeState.loadedRenderables` and missed `content-loaded` /
  `section-loading-complete` for shells that were already mounted and
  loaded.
- `SectionRuntimeEngine.initialize` only re-fed the registry into the
  controller when the resolved controller was a NEW instance
  (`resolved !== previousController`). Same-cohort `updateInput` resolves
  to the existing controller, so replay was skipped and the wipe above
  was not undone.

Phase C closes both gaps:

- `SectionController.initialize` now only calls `resetLifecycleTracking()`
  when the section identifier actually changes between the previous
  input and the next. Same-section refreshes preserve lifecycle state.
- `SectionController.handleContentRegistered` and `handleContentLoaded`
  short-circuit on already-tracked / already-loaded renderable keys —
  no duplicate `content-loaded` emit, no spurious re-evaluation of
  `section-loading-complete`, and the engine's replay stays safe to
  run on every `initialize` call.
- `SectionRuntimeEngine.initialize` drops the
  `resolved !== previousController` gate and unconditionally re-feeds
  the registry into the resolved controller. Combined with the
  controller-side idempotence above, the replay is a true no-op when
  the controller already knows about the registered shells, and a
  recovery seeding when an `updateInput` cohort refresh has wiped
  state.

Coverage:

- `packages/section-player/tests/section-controller-pie-512-phase-c.test.ts` —
  five new Bun unit tests pinning the controller-side invariants
  (no wipe on same-section `updateInput`; idempotent register / load;
  late subscriber on same-section `updateInput` observes preserved
  `runtimeState`).
- `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts` —
  new same-controller engine integration test covering the
  drop-the-gate change.
- The existing PIE-512 cross-section A → B → A Playwright spec
  continues to pass unchanged. End-to-end coverage of the
  same-cohort `updateInput` path is intentionally left to the
  engine integration test (under `@happy-dom`) which exercises
  the exact engine→controller seam where the bug lived; a
  Playwright spec that drives a second `engine.initialize`
  imperatively from `page.evaluate` (mirroring the real
  consumer's plain-HTML pattern) is a useful follow-up but is
  not required for this fix.
