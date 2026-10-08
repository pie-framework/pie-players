# @pie-players/pie-tool-calculator-inline-geogebra

Registers `<pie-tool-calculator-inline-geogebra>`, an inline toggle for a
GeoGebra-backed calculator. It shares its accessible interaction
implementation with the Desmos inline tool.

```ts
import "@pie-players/pie-tool-calculator-inline-geogebra";
```

The element renders inside `<pie-item-scope>` under `<pie-assessment-toolkit>`,
as `<pie-tool-calculator-inline>` from
`@pie-players/pie-tool-calculator-inline-desmos` does, and takes the same
attributes. It toggles the calculator the item toolbar renders for the
enclosing item, `calculator:item:<itemId>`, so the toolkit's tool
configuration must place `calculator` in the item toolbar with the
`calculator-geogebra` provider. `target-tool-id` overrides the resolved id. Without
an item shell or a `target-tool-id` the button stays disabled and logs a
console warning.

Active-state colors use `--pie-tool-trigger-active-background`,
`--pie-tool-trigger-active-border-color`, and
`--pie-tool-trigger-active-color`, matching the Desmos compatibility element.
