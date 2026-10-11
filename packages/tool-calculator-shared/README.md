# @pie-players/pie-tool-calculator-shared

Provider-neutral Svelte surfaces for PIE calculator tools. This package owns
calculator lifecycle, toolkit-context wiring, visibility, resizing, focus,
loading/error presentation, and the inline toggle. It does not load or name a
calculator vendor.

The provider-neutral registration entry owns the stable generic element:

```ts
import "@pie-players/pie-tool-calculator-shared/calculator-element";
```

It registers `<pie-tool-calculator>`, which carries the Desmos layout rules. The
Desmos-named package remains a compatibility entry for the same guarded
registration. The entry bundles its own Svelte runtime and never resolves the
host's. It is the package's only entry.

The Svelte shells are not exported. This package compiles the calculator shell
into `<pie-tool-calculator>`, and
`@pie-players/pie-tool-calculator-inline-desmos` compiles the inline shell from
source into `<pie-tool-calculator-inline>`, each onto the one Svelte runtime its
entry bundles. Each shell finds its provider under its base tool id through the
toolkit runtime context, so the calculator tool config selects the vendor. The
packaged tool set in `@pie-players/pie-default-tool-loaders` loads
`<pie-tool-calculator>`; the inline button is installed separately.

The shared inline trigger owns these component-level active-state theme hooks:

- `--pie-tool-trigger-active-background`
- `--pie-tool-trigger-active-border-color`
- `--pie-tool-trigger-active-color`

All three are registered `component-public` tokens.

Its resting and hover fills resolve through the button tokens —
`--pie-button-background-color` then `--pie-button-bg`, and
`--pie-button-hover-background-color` then `--pie-button-hover-bg`. Every base
theme and color scheme sets those opaque. `--pie-background` is the page token a
host may point at its own backdrop, so it does not reach this fill.

Vendor wrappers inherit the same WCAG-focused focus, pressed-state, reduced
motion, and touch-target behavior.
