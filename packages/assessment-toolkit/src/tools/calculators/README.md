# Calculator providers

Calculator providers sit behind the provider-neutral `@pie-players/pie-calculator`
contract, and the calculator registration in `@pie-players/pie-default-tool-loaders`
selects one from the toolkit's tools config. Desmos remains the no-configuration
default; GeoGebra and Cortex are explicit alternatives.

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

Vendor options go in `settings` for every provider; Desmos's former `desmos`
option bag is gone. Credentials are provider-level and belong in `provider.init`
or `provider.runtime` -- `apiKey` and `proxyEndpoint` placed in `settings` never
reached the vendor and are dropped. `proxyEndpoint` on `initialize()` is the
canonical production path: it keeps a key out of static source, though the
browser still receives it in Desmos's calculator script URL.

## Adapters

`@pie-players/pie-default-tool-loaders` depends on the three calculator adapters
and imports the selected one when its provider initializes, so a host installs
none of them:

- `@pie-players/pie-calculator-desmos`
- `@pie-players/pie-calculator-geogebra`
- `@pie-players/pie-calculator-cortex`

## Licensing

PIE packages contain only PIE-authored adapters and are MIT licensed. They do
not bundle Desmos or GeoGebra application code.

- Desmos is separately licensed. The adapter preserves its legacy unkeyed URL
  for backwards compatibility, but that does not grant or imply a license.
- GeoGebra's full application/web services are separately licensed and require
  attribution; commercial use requires an agreement with GeoGebra.

Review the current vendor terms for every application and demo before enabling a
provider.
