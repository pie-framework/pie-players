---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
---

`toolOverrides` applies as documented, the policy engine compares its inputs structurally, an embedded toolkit keeps the assessment its host bound, and the PNP debugger no longer overwrites settings. A toolbar that cannot load a tool's module withholds the tool and reports `tool-module-load`, fatal only when policy grants it; the inline calculator opens through its item's toolbar and only where that toolbar offers the calculator; GeoGebra calculators show their attribution; tool windows stack within their tool's z-index layer while the ToolCoordinator leaves display to the renderer; and element tool state ids containing `:` round-trip.
