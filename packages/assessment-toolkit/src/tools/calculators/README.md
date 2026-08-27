# Calculator providers

The toolkit registers calculator providers behind the provider-neutral
`@pie-players/pie-calculator` contract. Desmos remains the no-configuration
default; GeoGebra is an explicit alternative.

## Toolkit configuration

```ts
const desmosTools = {
  providers: {
    calculator: {
      provider: {
        id: "calculator-desmos",
        runtime: {
          authFetcher: async () => ({ apiKey: "application-key" }),
        },
      },
      settings: { degreeMode: true },
    },
  },
};

const geoGebraTools = {
  providers: {
    calculator: {
      provider: {
        id: "calculator-geogebra",
        init: { appletTimeoutMs: 20_000 },
      },
      settings: { showResetIcon: true },
      restrictedMode: true,
    },
  },
};
```

Omitting `provider.id` selects `calculator-desmos` for compatibility. GeoGebra
maps a `basic` calculator request to its scientific app because its embed API
does not provide a separate four-function app.

The packaged custom-element tag and lazy loader are selected by the composition
package from that same config:

```ts
import {
  createDefaultToolModuleLoaders,
  createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";

const calculatorProviderConfig = geoGebraTools.providers.calculator;
const toolRegistry = createPackagedToolRegistry({
  calculatorProviderConfig,
  toolModuleLoaders: createDefaultToolModuleLoaders({
    calculatorProviderConfig,
  }),
});
```

No calculator provider config continues to select the existing Desmos tag and
bundle. A host-supplied `toolTagMap.calculator` or calculator module loader still
takes precedence over the packaged selection.

Provider initialization belongs under `provider.init`; runtime-only functions
such as a credential fetcher belong under `provider.runtime`; per-calculator
vendor options belong in `settings`. The same shape is used by both suites.

Existing Desmos clients may continue to use the deprecated
`CalculatorProviderConfig.desmos` option bag and the provider's
`proxyEndpoint`. New code should use `settings` and `provider.init` or
`provider.runtime`. A runtime endpoint keeps a key out of static source, but the
browser still receives it in Desmos's calculator script URL.

## Direct adapters

The toolkit exports `DesmosToolProvider` and `GeoGebraToolProvider`. Their
underlying calculator adapters are published separately:

- `@pie-players/pie-calculator-desmos`
- `@pie-players/pie-calculator-geogebra`

## Licensing

PIE packages contain only PIE-authored adapters and are MIT licensed. They do
not bundle Desmos or GeoGebra application code.

- Desmos is separately licensed. The adapter preserves its legacy unkeyed URL
  for backwards compatibility, but that does not grant or imply a license.
- GeoGebra's full application/web services are separately licensed and require
  attribution; commercial use requires an agreement with GeoGebra.

Review the current vendor terms for every application and demo before enabling a
provider.
