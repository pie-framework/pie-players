---
"@pie-players/pie-section-player": patch
---

A layout element without a `section-id` now emits `pie-stage-change` and
`pie-loading-complete` keyed on the section's `identifier`, and its section
telemetry carries that id.
