---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

The calculator engines `@pie-players/pie-calculator-cortex`, `-desmos` and
`-geogebra` are now dependencies of `@pie-players/pie-default-tool-loaders`,
which holds their adapters, and no longer optional peers of the toolkit. A
webpack 5 host that installed only the section player failed its build on the
three missing engines, and a Vite host shipped modules that threw when a
calculator opened. `CortexToolProvider`, `DesmosToolProvider` and
`GeoGebraToolProvider` left the toolkit's `./tools/internal` subpath, which now
exports the `ToolProviderApi` and `ToolProviderCapabilities` types instead. Host
A's engine installs become redundant, and its Cortex stub alias still applies.
