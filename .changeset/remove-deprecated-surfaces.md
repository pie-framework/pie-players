---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
---

Remove deprecated surfaces.

- `pie-item-player` drops `customClassname`, `bundleHost`, `bundleEndpoints`, `disableBundler` and `reFetchBundle`; use `customClassName`, `loaderOptions.bundleHost` and `strategy="preloaded"`.
- `pie-item-player` drops `updateElementModel()`; reassign `config` instead.
- `scorePieItem` drops `outcomeArguments` and always calls `outcome(model, session, env)`.
- The backend client no longer strips a trailing `/api` from `baseUrl`; pass the origin.
- The Desmos provider throws at initialization without an `apiKey` or `proxyEndpoint` instead of requesting the unkeyed script.
- `tools.providers.tts` reports `tools.unknownProviderKey`; the `tools.removedProviderKey` diagnostic is gone.
