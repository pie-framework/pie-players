# Calculator providers

This directory holds the toolkit's calculator tool providers, for contributors
to `@pie-players/pie-default-tool-loaders`. Each provider imports one calculator
adapter when it initializes and hands it to the provider-neutral
`<pie-tool-calculator>` element. Host configuration (provider selection, the
Desmos key, adding a backend) is documented in the package README's
[Calculator providers](../../README.md#calculator-providers) section and in
[Calculator with host auth](../../../../docs/tools-and-accomodations/tool_provider_system.md#calculator-with-host-auth).

## Providers

The calculator registration maps `tools.providers.calculator.provider.id` to a
`CalculatorProviderDefinition`; any other id throws. `PACKAGED_CALCULATOR_PROVIDERS`
in `packaged-calculator-providers.ts` holds the packaged ones:

| `provider.id` | Adapter | `requiresAuth` |
| --- | --- | --- |
| `calculator-desmos`, or unset | [`@pie-players/pie-calculator-desmos`](../../../calculator-desmos/README.md) | `true` |
| `calculator-geogebra` | [`@pie-players/pie-calculator-geogebra`](../../../calculator-geogebra/README.md) | `false` |

`createCalculatorToolRegistration` merges a host's definitions over these, so
`calculatorToolRegistration` is that function called with none. Every
definition is wrapped in `LazyCalculatorToolProvider`, which imports the adapter
module on first `initialize()`, reports the import through `onTelemetry`, and
drops an initialization that a `destroy()` overtook.

The package depends on both packaged adapters, so a host installs neither. A
bundler that inlines dynamic imports inlines every module the set names, so the
set holds only adapters over a vendor-hosted engine. Cortex bundles its engine,
so a host composes it in from
[`@pie-players/pie-calculator-cortex`](../../../calculator-cortex/README.md).

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
