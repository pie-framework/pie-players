# `@pie-players/pie-calculator-cortex`

A fully bundled, open-source basic, scientific, and graphing calculator
implementation for PIE Players. It implements the provider-neutral contracts
from `@pie-players/pie-calculator` using MathLive, Cortex Compute Engine, and
JSXGraph.

```ts
import { CortexCalculatorProvider } from "@pie-players/pie-calculator-cortex";

const provider = new CortexCalculatorProvider();
await provider.initialize();
const calculator = await provider.createCalculator(
  "scientific",
  document.querySelector("#calculator")!,
);
```

The package bundles all runtime code and required assets. It does not require
an API key, CDN, or network connection.
