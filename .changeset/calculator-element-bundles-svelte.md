---
"@pie-players/pie-tool-calculator-shared": patch
---

`./calculator-element`, which the packaged tool loaders and
`@pie-players/pie-tool-calculator-desmos` load for the Desmos calculator, now
bundles its own Svelte runtime. It left `svelte` to the host's bundler, so a
Svelte host older than 5.57 supplied its own copy and the calculator crashed on
opening with `(void 0) is not a function`.
