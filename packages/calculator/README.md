# @pie-players/pie-calculator

Calculator provider interfaces and types for PIE Assessment Toolkit - Pure TypeScript with no UI dependencies.

## Purpose

This package provides the foundational interfaces and types for building calculator providers in the PIE ecosystem. It has **zero dependencies** and no UI framework requirements, making it suitable for:

- Implementing custom calculator providers
- Type-safe calculator integration
- Framework-agnostic calculator solutions

## What's Included

### Interfaces

- **`CalculatorProvider<TConfig>`** - Stateless factory for creating calculator
  implementations; `TConfig` is the per-instance configuration the adapter accepts
- **`Calculator`** - Actual calculator instance interface
- **`CalculatorProviderCapabilities`** - Feature support description
- **`CalculatorProviderConfig`** - Provider-neutral base configuration that adapters can extend

### Types

- **`CalculatorType`** - Union type of supported calculator types
- **`CalculatorState`** - State for persistence
- **`CalculationHistoryEntry`** - History entry format

## Installation

```bash
npm install @pie-players/pie-calculator
# or
bun add @pie-players/pie-calculator
```

## Usage

### Implementing a Custom Calculator Provider

```typescript
import type {
  CalculatorProvider,
  Calculator,
  CalculatorType,
  CalculatorProviderCapabilities,
  CalculatorProviderConfig,
  CalculatorState
} from '@pie-players/pie-calculator';

interface MyCalculatorProviderConfig extends CalculatorProviderConfig {
  precision?: number;
}

class MyCalculatorImpl implements Calculator {
  readonly provider: CalculatorProvider<MyCalculatorProviderConfig>;
  readonly type: CalculatorType;

  constructor(
    provider: CalculatorProvider<MyCalculatorProviderConfig>,
    type: CalculatorType,
    container: HTMLElement
  ) {
    this.provider = provider;
    this.type = type;
    // Initialize calculator in container
  }

  getValue(): string { return '0'; }
  setValue(value: string): void { /* ... */ }
  clear(): void { /* ... */ }
  exportState(): CalculatorState { /* ... */ }
  importState(state: CalculatorState): void { /* ... */ }
  destroy(): void { /* ... */ }
}

export class MyCalculatorProvider
  implements CalculatorProvider<MyCalculatorProviderConfig> {
  readonly providerId = 'my-calculator';
  readonly providerName = 'My Calculator';
  readonly supportedTypes: CalculatorType[] = ['basic', 'scientific'];
  readonly version = '1.0.0';

  async initialize(): Promise<void> {
    // Load libraries, etc.
  }

  async createCalculator(
    type: CalculatorType,
    container: HTMLElement,
    config?: MyCalculatorProviderConfig
  ): Promise<Calculator> {
    return new MyCalculatorImpl(this, type, container);
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
      maxPrecision: 15,
      inputMethods: ['keyboard', 'mouse', 'touch'],
    };
  }

  destroy(): void {
    // Cleanup
  }
}
```

## Official Implementations

- **Desmos** (`@pie-players/pie-calculator-desmos`) - Requires API key, graphing support

## Calculator Types

Supported calculator types:

- `"basic"` - Four-function calculator (add, subtract, multiply, divide)
- `"scientific"` - Scientific calculator with trigonometry, logarithms, etc.
- `"graphing"` - Graphing calculator with coordinate plane

## Design Philosophy

This core package intentionally:
- ✅ Has **zero runtime dependencies**
- ✅ Contains **only TypeScript interfaces and types**
- ✅ Is **framework-agnostic** (no React, Svelte, Vue, etc.)
- ✅ Supports **pluggable architecture**
- ✅ Enables **type-safe calculator implementations**

## License

MIT

## Related Packages

- [@pie-players/pie-calculator-desmos](../calculator-desmos) - Desmos graphing calculator provider
