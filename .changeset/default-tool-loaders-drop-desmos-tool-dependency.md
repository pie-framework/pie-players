---
"@pie-players/pie-default-tool-loaders": patch
---

`@pie-players/pie-tool-calculator-desmos` is no longer a dependency. The packaged
calculator loader has registered `pie-tool-calculator` from
`@pie-players/pie-tool-calculator-shared/calculator-element` since 0.3.69, and
nothing else here imported the Desmos package. A host that imports it without
declaring it, having received it through this package, `pie-section-player` or
`pie-print-player`, has to add it to its own dependencies.
