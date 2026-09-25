---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

The item player's resource monitor no longer builds its own New Relic provider;
it sends to the provider its player resolves from `loaderConfig`, so with
`trackPageActions: true` and no provider named it shares the default New Relic
provider resolution memoizes. Host P runs this configuration and receives the
same telemetry.
