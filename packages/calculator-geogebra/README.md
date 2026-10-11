# @pie-players/pie-calculator-geogebra

The calculator adapter for GeoGebra's Scientific and Graphing apps. It implements
the provider contract from [`@pie-players/pie-calculator`](../calculator/README.md);
toolkit hosts select it with `provider.id: "calculator-geogebra"`
([Calculator providers](../default-tool-loaders/README.md#calculator-providers)),
and hosts that mount a calculator themselves use `GeoGebraCalculatorProvider`
directly. The [Cortex](../calculator-cortex/README.md) and
[Desmos](../calculator-desmos/README.md) adapters implement the same contract.

The package contains PIE-authored adapter code only. It loads
`https://www.geogebra.org/apps/deployggb.js` at runtime unless the host has
already loaded `window.GGBApplet`, and does not bundle or redistribute the
GeoGebra application. The embed takes no key.

## Installation

```bash
bun add @pie-players/pie-calculator-geogebra
```

## Licensing

PIE's adapter is MIT licensed; GeoGebra is separately licensed. GeoGebra's web
services and complete application are free for qualifying non-commercial use
with attribution, and commercial use requires a License and Collaboration
Agreement. Review the current [GeoGebra License](https://www.geogebra.org/license)
and contact `office@geogebra.org` when the intended use is commercial.

The provider declares the attribution as
`attribution: { label: "Made with GeoGebra®", href: "https://www.geogebra.org/" }`,
and the toolkit's calculator tool renders it as a link below every calculator the
provider creates. A host that renders the calculator in its own surface shows it
there.

## Usage

```ts
import { GeoGebraCalculatorProvider } from "@pie-players/pie-calculator-geogebra";

const provider = new GeoGebraCalculatorProvider();
await provider.initialize();

const calculator = await provider.createCalculator("graphing", container, {
  restrictedMode: true,
  settings: {
    language: "en",
    showResetIcon: true,
    showZoomButtons: true,
  },
});
```

A deployment whose GeoGebra license permits another source provides its own
loader URL:

```ts
import { GeoGebraCalculatorProvider } from "@pie-players/pie-calculator-geogebra";

const provider = new GeoGebraCalculatorProvider();
await provider.initialize({ scriptUrl: "/licensed-geogebra/deployggb.js" });
```

`initialize()` throws outside a browser and when the script fails to load.
`createCalculator()` initializes the provider on first use and resolves once the
applet's `appletOnLoad` fires; it rejects with
`GeoGebra applet did not initialize within <n>ms` after the applet timeout. A
container without an `id` gets a generated one, removed again on `destroy()`.
`destroy()` on the provider destroys every calculator it created.

## Configuration

`initialize()` takes `GeoGebraCalculatorProviderInit`:

| Field | Default | Purpose |
| --- | --- | --- |
| `scriptUrl` | `https://www.geogebra.org/apps/deployggb.js` | Loader URL; override only where the license permits that source. |
| `appletTimeoutMs` | `20000` | Maximum wait for `appletOnLoad` after injection; a non-positive value falls back to the default. |
| `onTelemetry` | — | Telemetry callback from the shared `CalculatorProviderInit`. |

`apiKey` and `proxyEndpoint` are absent because the embed takes no credential.

`createCalculator()` takes `GeoGebraCalculatorProviderConfig`, the
provider-neutral config with `settings` typed as `GeoGebraCalculatorSettings`.
The settings pass to the applet as GeoGebra app parameters, among them
`language`, `country`, `showResetIcon`, `showAlgebraInput`, `enableUndoRedo`,
`borderColor` and `borderRadius`. `locale` and `theme` are not applied: set the
interface language with `settings.language` and `settings.country`.

| Type | GeoGebra app |
| --- | --- |
| `basic` | `scientific`, since the embedding interface exposes no four-function app |
| `scientific` | `scientific` |
| `graphing` | `graphing` |

The adapter sets these parameters around `settings`:

| Parameter | Value |
| --- | --- |
| `showMenuBar`, `showToolBar` | `false` by default |
| `showAlgebraInput` | `true` by default; the input row is the scientific app's interaction surface |
| `showZoomButtons` | `true` by default for `graphing`, otherwise `false` |
| `width`, `height` | `settings.width` and `settings.height`, else the container's size, at least 320px |
| `enable3d` | Always `false` |
| `preventFocus` | Always `true` |
| `appName`, `id`, `appletOnLoad` | Always the adapter's; the same keys in `settings` are dropped |

`restrictedMode: true` forces `showMenuBar`, `showToolBar`,
`enableFileFeatures`, `enableCAS` and `enableRightClick` to `false` after
`settings`, so a host cannot relax it.

## Calculator behavior

| Method | Behavior |
| --- | --- |
| `getValue()`, `setValue(value)` | The applet's editor state as JSON. |
| `evaluate(command)` | The CAS result, else the labels the command created, else the command when GeoGebra accepted it, else `""`. |
| `clear()` | Starts a new construction. |
| `resize()` | Sizes the applet to its container. |
| `focus()` | Focuses the first input in the applet. |

GeoGebra exposes no history; the capabilities report `supportsHistory: false`
and no `maxPrecision`.

## State

`exportState()` returns `CalculatorState` with `provider: "geogebra"`, the editor
state as `value`, and the applet's Base64 construction as `providerState`.
`importState()` throws for any other provider; it restores the Base64
construction when present and otherwise the editor state. The toolkit's
`<pie-tool-calculator>` does not persist state, so saving and restoring belong to
hosts that drive the adapter directly.

## Telemetry

`onTelemetry` receives `pie-tool-library-load-start`, `-success` and `-error`
for the script load, with `toolId: "calculator"`, `backend: "geogebra"`,
`operation: "geogebra-script-load"`, and `duration` on completion. The error event
carries `errorType: "ToolLibraryLoadError"` and the error `message`. A failing
callback is logged and does not affect the calculator.

## Exports

| Export | Kind |
| --- | --- |
| `GeoGebraCalculatorProvider` | The `CalculatorProvider` implementation (`providerId: "geogebra"`). |
| `GeoGebraCalculatorProviderInit` | Type: `initialize()` argument. |
| `GeoGebraCalculatorProviderConfig` | Type: per-calculator config. |
| `GeoGebraCalculatorSettings` | Type: the GeoGebra app parameters `settings` accepts. |

## References

- [GeoGebra Apps Embedding](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/)
- [GeoGebra App Parameters](https://geogebra.github.io/docs/reference/en/GeoGebra_App_Parameters/)
- [GeoGebra Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)
- [GeoGebra License](https://www.geogebra.org/license)
