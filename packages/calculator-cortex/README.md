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
  {
    locale: "nl-NL",
    theme: "auto",
  },
);
```

The package bundles all runtime code and required assets. It does not require
an API key, CDN, or network connection.

## Isolated demos

Run `bun run --cwd packages/calculator-cortex demo`, then open the basic,
scientific, or graphing page from the mode navigation. Each page mounts one
calculator directly through `CortexCalculatorProvider`; it does not load an
assessment player, toolkit coordinator, or tool wrapper.

The demo controls switch interface language, theme, and text direction by
destroying and recreating only that calculator instance.

## Localization

The package ships complete English (`en-US`) and Dutch (`nl-NL`) interface
catalogs. Locale matching is by primary language, so `nl`, `nl-NL`, and
`nl-BE` select Dutch. Other locales fall back to English while still configuring
MathLive, decimal input, locale-aware graph numbers, and writing direction.

Every package-owned visible string, accessible name, status, and recoverable
error can be replaced with typed per-instance messages:

```ts
await provider.createCalculator("basic", container, {
  locale: "cy-GB",
  settings: {
    messages: {
      basicCalculator: "Cyfrifiannell sylfaenol",
      calculate: "Cyfrifo",
      clear: "Clirio",
    },
  },
});
```

Unspecified messages fall back to the selected built-in catalog, then English.
Message templates retain their named placeholders, such as `{index}`,
`{lineStyle}`, and `{result}`. `settings.direction` defaults to `"auto"`, which
derives `ltr` or `rtl` from the locale; a host may explicitly set `"ltr"` or
`"rtl"` when its language policy requires it.

## Theming

`theme: "light" | "dark" | "auto"` supplies accessible package defaults.
`"auto"` follows `prefers-color-scheme`. The calculator consumes the canonical
PIE tokens for surfaces, text, buttons, focus, primary actions, and errors,
including `--pie-background`, `--pie-background-dark`, `--pie-text`,
`--pie-border`, `--pie-button-bg`, `--pie-button-color`,
`--pie-button-border`, `--pie-button-focus-outline`, `--pie-primary`,
`--pie-white`, `--pie-incorrect`, `--pie-incorrect-secondary`, and
`--pie-content-emphasis`.

Graph colors have package-owned hooks because no canonical series palette
exists: `--pie-calculator-series-1`, `--pie-calculator-series-2`,
`--pie-calculator-series-3`, `--pie-calculator-series-4`,
`--pie-calculator-series-5`, and `--pie-calculator-series-6`. Each series also
has a solid, dashed, or dotted line style; hosts overriding colors must retain
3:1 contrast against the graph surface and keep the palette distinguishable.
