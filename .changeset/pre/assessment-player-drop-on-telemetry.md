---
"@pie-players/pie-assessment-player": patch
---

`AssessmentPlayerHooks` drops `onTelemetry`, which the player never called. Assessment events reach telemetry through `sectionPlayerRuntime.player.loaderConfig.instrumentationProvider`, and a host that typed an `onTelemetry` hook now gets a type error.
