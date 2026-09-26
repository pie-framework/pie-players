---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

A failed `toolContextResolvers` update on `<pie-assessment-toolkit>` now
reports its `framework-error` with `source: "pie-assessment-toolkit"`; the
source was `undefined`.

`ToolkitCoordinatorApi.config.tools.providers` is now `ToolProvidersConfig`,
the type the coordinator holds, so `textToSpeech.provider` admits the
`"polly" | "google" | "custom"` selector the runtime already accepts. An entry
read by id through `config` is therefore typed
`ToolProviderConfig | TextToSpeechToolProviderConfig`; code that needs a
`ToolProviderConfig` should call `getToolConfig(toolId)`, as the calculator
registration now does.
