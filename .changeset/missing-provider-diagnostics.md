---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A coordinator built without `toolRegistry` registers no tool providers, and its
console now says so. The registry-unavailable validation warning names that
consequence; a text-to-speech config with a non-browser backend warns once
when, with no `tts` provider registered, it falls back to browser speech; and
the section player warns once per placed tool whose provider a host-supplied
`runtime.coordinator` has not registered. Each warning names
`createPackagedToolRegistry()` as the remedy. `./tools/internal` exports
`resolveToolProviderId`.
