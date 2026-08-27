# @pie-players/pie-calculator-geogebra

GeoGebra adapter for the provider-neutral `@pie-players/pie-calculator`
interface. It supports PIE's `scientific` and `graphing` modes and maps `basic`
to GeoGebra's Scientific Calculator because GeoGebra does not expose a separate
four-function app through the embedding interface.

The package contains PIE-authored adapter code only. By default it loads
`https://www.geogebra.org/apps/deployggb.js` at runtime; it does not bundle or
redistribute the GeoGebra application.

## Licensing

PIE's adapter is MIT licensed, but GeoGebra is separately licensed. GeoGebra's
web services and complete application are free for qualifying non-commercial
use with attribution; commercial use requires a License and Collaboration
Agreement. Review the current [GeoGebra License](https://www.geogebra.org/license)
and contact `office@geogebra.org` when the intended use is commercial.

## Usage

```ts
import { GeoGebraCalculatorProvider } from "@pie-players/pie-calculator-geogebra";

const provider = new GeoGebraCalculatorProvider();
await provider.initialize();

const calculator = await provider.createCalculator("graphing", container, {
  restrictedMode: true,
  locale: "en-US",
  settings: {
    showResetIcon: true,
    showZoomButtons: true,
  },
});
```

A licensed self-hosted deployment may provide its own loader URL:

```ts
await provider.initialize({ scriptUrl: "/licensed-geogebra/deployggb.js" });
```

The adapter uses GeoGebra's documented `appletOnLoad` API object, Base64 state
methods, resize methods, and `remove()` cleanup.

## References

- [GeoGebra Apps Embedding](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/)
- [GeoGebra App Parameters](https://geogebra.github.io/docs/reference/en/GeoGebra_App_Parameters/)
- [GeoGebra Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)
- [GeoGebra License](https://www.geogebra.org/license)
