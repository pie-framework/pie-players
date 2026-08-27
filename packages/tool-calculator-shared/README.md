# @pie-players/pie-tool-calculator-shared

Provider-neutral Svelte surfaces for PIE calculator tools. This package owns
calculator lifecycle, toolkit-context wiring, visibility, resizing, focus,
loading/error presentation, and the inline toggle. It does not load or name a
calculator vendor.

Vendor packages wrap these components in their own custom-element tags and
supply a default provider id. Applications normally install a vendor package,
not this package directly.

The shared inline trigger owns these component-level active-state theme hooks:

- `--pie-tool-trigger-active-background`
- `--pie-tool-trigger-active-border-color`
- `--pie-tool-trigger-active-color`

Vendor wrappers inherit the same WCAG-focused focus, pressed-state, reduced
motion, and touch-target behavior.
