---
"@pie-players/pie-assessment-toolkit": patch
---

A `ToolkitCoordinator` built without a tool registry no longer throws on every tool-config call.

Moving the packaged capability set into the composition package removed the coordinator's registry fallback, so a host that supplies no `toolRegistry` now gets an empty one. `assertCanonicalToolId` validated against it and threw `Unknown tool id "…"` for everything — including the ids the coordinator's own default-provider block installs, so `isToolEnabled("textToSpeech")` threw on a coordinator that had just enabled text-to-speech itself. Any host constructing its own coordinator, which is the documented pattern for `element-QuizEngineFixedFormPlayer`, hit it.

An empty registry means the host supplied none, not that every id is wrong: there is nothing to validate against, so the check is skipped. `normalizeAndValidateToolsConfig` already reports the missing registry once as `tools.registryUnavailable`, with the `createPackagedToolRegistry()` remedy; repeating it as an exception per call was the defect. A supplied registry still rejects ids it does not carry, and the `"tts"` → `"textToSpeech"` migration error still fires either way because it is checked first.

Found by the assessment-player smoke suite, which builds a coordinator with no registry — the same shape the affected consumer uses.
