---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-calculator-cortex": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-calculator-shared": patch
---

Add a fully bundled open-source calculator provider using MathLive, Cortex
Compute Engine, and JSXGraph, with basic, scientific, and graphing modes,
worker-isolated evaluation, accessible graph exploration, direct custom-element
wrappers, package-owned isolated mode demos, and opt-in default-tool-loader
composition.

Move registration of the generic `pie-tool-calculator` element into the shared,
provider-neutral package while retaining the Desmos compatibility entry and
Desmos as the default provider.
