# @pie-players/pie-calculator

Provider-neutral calculator contracts for PIE Players. This package has no
runtime dependencies and contains no UI or vendor implementation code.

## Installation

```bash
bun add @pie-players/pie-calculator
```

## Contract

The package exports:

- `CalculatorProvider`, the factory and capability contract implemented by a
  calculator adapter;
- `Calculator`, the lifecycle, value, state, resize, and focus contract for one
  mounted calculator;
- `CalculatorProviderConfig`, whose `settings` object is interpreted only by the
  selected implementation; and
- `CalculatorType`, with `basic`, `scientific`, and `graphing` modes.

Provider-specific settings belong to the provider package. Generic code passes
them through without importing or naming Desmos, GeoGebra, or another vendor.

```ts
import type {
  Calculator,
  CalculatorProvider,
  CalculatorProviderCapabilities,
  CalculatorProviderConfig,
  CalculatorType,
} from "@pie-players/pie-calculator";

export class MyCalculatorProvider implements CalculatorProvider {
  readonly providerId = "my-calculator";
  readonly providerName = "My Calculator";
  readonly supportedTypes: CalculatorType[] = ["basic", "scientific"];
  readonly version = "1";

  async initialize(): Promise<void> {}

  async createCalculator(
    type: CalculatorType,
    container: HTMLElement,
    config?: CalculatorProviderConfig,
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

## Implementations

- `@pie-players/pie-calculator-desmos`
- `@pie-players/pie-calculator-geogebra`

Each implementation and its underlying calculator product has its own package
and licensing boundary. No vendor library is bundled by this interface package.

## License

PIE-authored code in this package is MIT licensed.
