---
"@pie-players/pie-assessment-toolkit": patch
---

`getToolConfig("textToSpeech")` now returns `TTSToolConfig | null` on
`ToolkitCoordinator` and `ToolkitCoordinatorApi`, and `ToolkitCoordinatorApi`
gains the `textToSpeech` overload of `updateToolConfig` the class already had.
`TTSToolConfig.provider` admits the runtime provider object the tools config
accepts as well as the `"polly" | "google" | "custom"` id, and
`resolveTTSRuntimeSettings` accepts the `textToSpeech` tools-config entry. Code
that reads `provider.runtime` off `getToolConfig("textToSpeech")` has to narrow
`provider` to an object first.
