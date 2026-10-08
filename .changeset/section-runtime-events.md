---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-player": patch
---

The section player's runtime engine is the only stage emitter: `<pie-assessment-toolkit>` emits no stages and drops `onStageChange`, a non-recoverable framework error before `interactive` ends the chain with the current stage `failed` and the rest `skipped`, and `pie-stage-change`, `pie-loading-complete` and `framework-error` bubble on to `document`, once each. The stage tracker leaves `@pie-players/pie-players-shared/pie`, and telemetry attributes keep an event's data and drop its live objects, such as the coordinator.
