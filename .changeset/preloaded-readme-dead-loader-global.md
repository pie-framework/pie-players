---
"@pie-players/pie-players-cli": patch
---

Stop advertising `window.PIE_LOADER_CONFIG` in generated
`@pie-players/pie-preloaded-player` builds. The README offered it as a global
alternative to `loader-config` and the types declared it on `Window`, but no code
reads it, so configuration set there was ignored. Configure loading on the
element through `loader-config` or `loaderConfig`.
