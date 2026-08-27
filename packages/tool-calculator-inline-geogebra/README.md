# @pie-players/pie-tool-calculator-inline-geogebra

Registers `<pie-tool-calculator-inline-geogebra>`, an inline toggle targeting a
GeoGebra-backed `calculator` tool surface. It shares its accessible interaction
implementation with the existing Desmos inline tool.

```ts
import "@pie-players/pie-tool-calculator-inline-geogebra";
```

The element targets the same `calculator` capability by default, so toolbar
policy and visibility state are unchanged. Pair it with
`<pie-tool-calculator-geogebra>` and the `calculator-geogebra` provider id.

Active-state colors use `--pie-tool-trigger-active-background`,
`--pie-tool-trigger-active-border-color`, and
`--pie-tool-trigger-active-color`, matching the Desmos compatibility element.
