# @pie-players/pie-calculator

The provider-neutral calculator contract for PIE Players: the types a calculator
adapter implements and the toolkit's calculator tool consumes. Adapter authors
implement it; hosts that use the toolkit's calculator never import it directly.
The package is types only, with no UI or vendor code.

## Installation

```bash
bun add @pie-players/pie-calculator
```

## Usage

A provider creates calculators of the types it supports into a container
element. Provider-specific settings belong to the adapter package; generic code
passes `settings` through without importing or naming a vendor.

```ts
import type {
  Calculator,
  CalculatorProvider,
  CalculatorProviderCapabilities,
  CalculatorProviderConfig,
  CalculatorProviderInit,
  CalculatorType,
} from "@pie-players/pie-calculator";

interface MyCalculatorProviderConfig extends CalculatorProviderConfig {
  precision?: number;
}

export class MyCalculatorProvider implements CalculatorProvider {
  readonly providerId = "my-calculator";
  readonly providerName = "My Calculator";
  readonly supportedTypes: CalculatorType[] = ["basic", "scientific"];
  readonly version = "1";

  async initialize(config?: CalculatorProviderInit): Promise<void> {
    // Load libraries and initialize provider-level services.
  }

  async createCalculator(
    type: CalculatorType,
    container: HTMLElement,
    config?: MyCalculatorProviderConfig,
  ): Promise<Calculator> {
    return createMyCalculator({ provider: this, type, container, config });
  }

  supportsType(type: CalculatorType): boolean {
    return this.supportedTypes.includes(type);
  }

  getCapabilities(): CalculatorProviderCapabilities {
    return {
      supportsHistory: true,
      supportsGraphing: false,
      supportsExpressions: true,
      canExport: true,
      inputMethods: ["keyboard", "mouse", "touch"],
    };
  }

  destroy(): void {}
}
```

## Configuration

A provider takes configuration at two levels:

- `CalculatorProviderInit`, once per provider in `initialize()`: `apiKey`,
  `proxyEndpoint` and `onTelemetry(eventName, payload)`. An adapter narrows it
  to the fields it honors.
- `CalculatorProviderConfig`, per calculator in `createCalculator()`:
  `settings` (interpreted by the adapter), `restrictedMode`, `locale` and
  `theme` (`"light"`, `"dark"` or `"auto"`). An adapter documents which of
  these it applies.

A provider may declare `attribution: { label, href }`; the toolkit's calculator
tool renders it as a link beside the calculator.

## Exports

All exports are types.

| Export | Contract |
| --- | --- |
| `CalculatorProvider` | Factory and capability contract an adapter implements: identity, `supportedTypes`, `initialize`, `createCalculator`, `supportsType`, `getCapabilities`, `destroy`. |
| `Calculator` | One mounted calculator: `getValue`, `setValue`, `clear`, `exportState`, `importState`, `destroy`, and optionally `getHistory`, `clearHistory`, `evaluate`, `resize`, `focus`. |
| `CalculatorProviderInit` | Provider-level credentials and telemetry. |
| `CalculatorProviderConfig` | Per-calculator settings, restricted mode, locale and theme. |
| `CalculatorProviderCapabilities` | History, graphing, expression and export support, `maxPrecision`, `inputMethods`. |
| `CalculatorState` | Serialized state: `type`, `provider`, `value`, optional `history` and adapter-owned `providerState`. |
| `CalculationHistoryEntry` | One history entry: `expression`, `result`, `timestamp`. |
| `CalculatorType` | `"basic"`, `"scientific"` or `"graphing"`. |

The toolkit's `<pie-tool-calculator>` does not persist calculator state;
`exportState` and `importState` serve hosts that drive an adapter directly.

## Implementations

| Package | Provider | Key |
| --- | --- | --- |
| [`@pie-players/pie-calculator-cortex`](../calculator-cortex/README.md) | Bundled MathLive, CortexJS Compute Engine and JSXGraph | None |
| [`@pie-players/pie-calculator-desmos`](../calculator-desmos/README.md) | Desmos, loaded from desmos.com | Required |
| [`@pie-players/pie-calculator-geogebra`](../calculator-geogebra/README.md) | GeoGebra, loaded from geogebra.org | None |

Each adapter and its calculator product has its own package and licensing
boundary; this package bundles no vendor library. The toolkit selects among
them by `provider.id`; see
[Calculator providers](../default-tool-loaders/README.md#calculator-providers).

## License

PIE-authored code in this package is MIT licensed.
