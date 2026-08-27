# @pie-players/pie-tool-calculator-geogebra

Registers `<pie-tool-calculator-geogebra>`, the GeoGebra-specific custom-element
wrapper around PIE's provider-neutral calculator surface.

```ts
import "@pie-players/pie-tool-calculator-geogebra";
```

```html
<pie-tool-calculator-geogebra
  visible="true"
  calculator-type="graphing"
></pie-tool-calculator-geogebra>
```

Toolkit-managed applications normally keep the existing generic
`<pie-tool-calculator>` tag and select GeoGebra through provider configuration:

```ts
tools: {
  providers: {
    calculator: {
      provider: { id: "calculator-geogebra" }
    }
  }
}
```

No calculator configuration continues to select Desmos. GeoGebra usage remains
subject to the current [GeoGebra License](https://www.geogebra.org/license).
