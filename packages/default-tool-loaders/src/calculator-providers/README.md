# Calculator providers

This directory holds the toolkit's calculator tool providers, for contributors
to `@pie-players/pie-default-tool-loaders`. Each provider imports one calculator
adapter when it initializes and hands it to the provider-neutral
`<pie-tool-calculator>` element. Host configuration (provider selection, the
Desmos key, Cortex settings) is documented in the package README's
[Calculator providers](../../README.md#calculator-providers) section and in
[Calculator with host auth](../../../../docs/tools-and-accomodations/tool_provider_system.md#calculator-with-host-auth).

## Providers

The calculator registration maps `tools.providers.calculator.provider.id` to a
provider class; any other id throws.

| `provider.id` | Class | Adapter | `requiresAuth` |
| --- | --- | --- | --- |
| `calculator-desmos`, or unset | `DesmosToolProvider` | [`@pie-players/pie-calculator-desmos`](../../../calculator-desmos/README.md) | `true` |
| `calculator-geogebra` | `GeoGebraToolProvider` | [`@pie-players/pie-calculator-geogebra`](../../../calculator-geogebra/README.md) | `false` |
| `calculator-cortex` | `CortexToolProvider` | [`@pie-players/pie-calculator-cortex`](../../../calculator-cortex/README.md) | `false` |

All three extend `LazyCalculatorToolProvider`, which imports the adapter module
on first `initialize()`, reports the import through `onTelemetry`, and drops an
initialization that a `destroy()` overtook. The package depends on all three
adapters, so a host installs none of them.

## Configuration shape

The tool config splits into three places, and the registration reads each
separately:

| Field | Reaches |
| --- | --- |
| `provider.init` | The adapter's `initialize()`: `apiKey`, `proxyEndpoint`, `scriptUrl`, `appletTimeoutMs`, `onTelemetry`, as the adapter accepts them. |
| `provider.runtime` | Runtime functions, such as `authFetcher`, whose result the toolkit merges into the initialization. |
| `settings`, `restrictedMode`, `locale`, `theme` | Each `createCalculator()` call, as the `CalculatorProviderConfig` of one instance. `settings` holds the vendor options. |

Credentials are provider-level: the Desmos adapter drops `apiKey` and
`proxyEndpoint` placed in `settings`. GeoGebra serves a `basic` request with
its scientific app, because its embed API has no four-function app.

## Licensing

PIE packages contain only PIE-authored adapters and are MIT licensed. They do
not bundle Desmos or GeoGebra application code.

- Desmos is separately licensed. The adapter loads it only with an `apiKey`, a
  `proxyEndpoint` that returns one, or an already-loaded `window.Desmos`, and
  throws without one.
- GeoGebra's apps and web services are separately licensed and require
  attribution; commercial use requires an agreement with GeoGebra.

Review the current vendor terms for every application and demo before enabling
a provider.
