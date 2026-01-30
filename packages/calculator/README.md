# @pie-players/pie-calculator

Calculator provider interfaces and types for PIE Assessment Toolkit - Pure TypeScript with no UI dependencies.

## Purpose

This package provides the foundational interfaces and types for building calculator providers in the PIE ecosystem. It has **zero dependencies** and no UI framework requirements, making it suitable for:

- Implementing custom calculator providers
- Type-safe calculator integration
- Framework-agnostic calculator solutions

## What's Included

### Interfaces

- **`CalculatorProvider`** - Stateless factory for creating calculator implementations
- **`Calculator`** - Actual calculator instance interface
- **`CalculatorProviderCapabilities`** - Feature support description
- **`CalculatorProviderConfig`** - Provider configuration

### Types

- **`CalculatorType`** - Union type of supported calculator types
- **`CalculatorState`** - State for persistence
- **`CalculationHistoryEntry`** - History entry format
- **`DesmosCalculatorConfig`** - Desmos-specific configuration
- **`TICalculatorConfig`** - TI calculator-specific configuration

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
  CalculatorProviderConfig
} from '@pie-players/pie-calculator';

class MyCalculatorImpl implements Calculator {
  readonly provider: CalculatorProvider;
  readonly type: CalculatorType;

  constructor(provider: CalculatorProvider, type: CalculatorType, container: HTMLElement) {
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

export class MyCalculatorProvider implements CalculatorProvider {
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
    config?: CalculatorProviderConfig
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

- **Math.js** (`@pie-players/pie-calculator-mathjs`) - Open-source, always available (built into toolkit)
- **Desmos** (`@pie-players/pie-calculator-desmos`) - Requires API key, graphing support
- **TI Emulators** (`@pie-players/pie-calculator-ti`) - Requires commercial license, TI-84/108/34

## Calculator Types

Supported calculator types:

- `"basic"` - Four-function calculator (add, subtract, multiply, divide)
- `"scientific"` - Scientific calculator with trigonometry, logarithms, etc.
- `"graphing"` - Graphing calculator with coordinate plane
- `"ti-84"` - Texas Instruments TI-84 Plus CE
- `"ti-108"` - Texas Instruments TI-108
- `"ti-34-mv"` - Texas Instruments TI-34 MultiView

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

- [@pie-players/pie-calculator-mathjs](../calculator-mathjs) - Open-source Math.js provider (default)
- [@pie-players/pie-calculator-desmos](../calculator-desmos) - Desmos graphing calculator provider
- [@pie-players/pie-calculator-ti](../calculator-ti) - Texas Instruments emulator provider
