---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-player": patch
---

The section player's runtime engine is the only stage emitter: `<pie-assessment-toolkit>` emits no stages and drops `onStageChange`, a non-recoverable framework error before `interactive` ends the chain with the current stage `failed` and the rest `skipped`, and `pie-stage-change`, `pie-loading-complete` and `framework-error` bubble on to `document`, once each. The stage tracker leaves `@pie-players/pie-players-shared/pie`, and telemetry attributes keep an event's data and drop its live objects, such as the coordinator.

A section switch commits the outgoing section's pending responses while the host's item subscriptions still receive them; a section that fails to start, or a revisited section that fails to update, delivers `section-error` to the host's section subscriptions and the next start clears its banner; a `subscribe*` call during a switch binds to the incoming section; `getSectionController()` and `waitForSectionController()` no longer advance the stage chain; the stage cohort and the controller share one section id; a shell moved to a nearer runtime re-announces its loaded content; and a failed `loadToolState` is reported once and leaves the coordinator ready.
