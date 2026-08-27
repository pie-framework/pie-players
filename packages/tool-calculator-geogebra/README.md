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

Toolkit-managed applications select GeoGebra through provider configuration and
let `@pie-players/pie-default-tool-loaders` select this package's tag and loader:

```ts
import {
  createDefaultToolModuleLoaders,
  createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";

const calculatorProviderConfig = {
  provider: { id: "calculator-geogebra" },
};
const toolRegistry = createPackagedToolRegistry({
  calculatorProviderConfig,
  toolModuleLoaders: createDefaultToolModuleLoaders({
    calculatorProviderConfig,
  }),
});

const tools = {
  providers: { calculator: calculatorProviderConfig },
};
```

No calculator configuration continues to select Desmos. GeoGebra usage remains
subject to the current [GeoGebra License](https://www.geogebra.org/license).
