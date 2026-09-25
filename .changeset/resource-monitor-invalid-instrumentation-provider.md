---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

The item player's resource monitor treats an `instrumentationProvider` that
fails the `InstrumentationProvider` contract as `null`, as the other
instrumentation layers already did. With `trackPageActions: true` it fell back
to its own New Relic provider and reported resource loads and failures through
`window.newrelic`.
