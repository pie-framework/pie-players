---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A coordinator built without `toolRegistry` prints `tools.registryUnavailable`
once, instead of again on every `updateToolConfig()` and
`updateToolsPlacement()`. A provider descriptor that throws is reported as a
`provider-register` framework error with a console warning, where it was an
unhandled rejection. `updateToolConfig()` registers the provider a tool's new
config names, and unregisters the previous one when the provider id changed, as
a text-to-speech reconfigure does.
