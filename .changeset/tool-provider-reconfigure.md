---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-calculator-shared": patch
---

`updateToolConfig` replaces the tool's provider even when the provider id stays the same, so a new `provider.init` or `provider.runtime.authFetcher` takes effect; an open calculator remounts on the new provider. After a text-to-speech reconfigure the next speak starts the reconfigured provider, also under `lazyInit`. Registering a provider under an id that is already registered now replaces it.
