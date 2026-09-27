---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`LoaderConfig.instrumentationProvider` accepts `null`, the documented way to
disable instrumentation, so a TypeScript host can write it without a cast. The
item player's resource monitor now sends to the provider its player resolves
from `loaderConfig`: `null`, or a value that fails the `InstrumentationProvider`
contract, turns its reporting off, and with `trackPageActions: true` and no
provider named it shares the default New Relic provider. It built a New Relic
provider of its own before, so with `trackPageActions: true` a `null` or invalid
provider still reported resource loads and failures through `window.newrelic`.
