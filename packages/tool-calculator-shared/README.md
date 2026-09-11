# @pie-players/pie-tool-calculator-shared

Provider-neutral Svelte surfaces for PIE calculator tools. This package owns
calculator lifecycle, toolkit-context wiring, visibility, resizing, focus,
loading/error presentation, and the inline toggle. It does not load or name a
calculator vendor.

The provider-neutral registration entry owns the stable generic element:

```ts
import "@pie-players/pie-tool-calculator-shared/calculator-element";
```

It registers `<pie-tool-calculator>` with the existing Desmos default. The
Desmos-named package remains a compatibility entry for the same guarded
registration.

Provider packages wrap these components in their own custom-element tags and
supply a default provider id. Applications normally install a provider package,
not this package directly, unless they intentionally want the generic element.

The shared inline trigger owns these component-level active-state theme hooks:

- `--pie-tool-trigger-active-background`
- `--pie-tool-trigger-active-border-color`
- `--pie-tool-trigger-active-color`

Its resting and hover fills resolve through the button tokens —
`--pie-button-background-color` then `--pie-button-bg`, and
`--pie-button-hover-background-color` then `--pie-button-hover-bg`. Every base
theme and colour scheme sets those opaque. `--pie-background` is the page token
and the base light theme ships it transparent, so it does not reach this fill.

Vendor wrappers inherit the same WCAG-focused focus, pressed-state, reduced
motion, and touch-target behavior.
