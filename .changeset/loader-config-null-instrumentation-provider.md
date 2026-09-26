---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`LoaderConfig.instrumentationProvider` accepts `null`, the documented way to
disable instrumentation, so a TypeScript host can write it without a cast. The
item player's resource monitor now honors it too: with `trackPageActions: true`
it fell back to its own New Relic provider and reported resource loads and
failures through `window.newrelic`.
