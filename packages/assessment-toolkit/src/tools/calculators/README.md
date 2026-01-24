# Calculator Providers

Multi-provider calculator implementations for PIE assessment player.

## Available Providers

### 1. Math.js Provider (Open Source - Apache 2.0)

**Perfect for:** Testing, basic/scientific calculators, cost-effective solution
**License:** Apache 2.0 - No licensing fees
**Status:** ✅ Production Ready

```typescript
import { mathjsProvider } from '$lib/assessment-toolkit/tools';

// Initialize
await mathjsProvider.initialize();

// Create basic calculator
const container = document.getElementById('calculator-container');
const calculator = await mathjsProvider.createCalculator('basic', container);

// Create scientific calculator with theme
const scientificCalc = await mathjsProvider.createCalculator('scientific', container, {
  theme: 'light' // or 'dark' or 'auto'
});
```

**Features:**
- ✅ Full calculator UI with buttons
- ✅ Basic arithmetic (4 functions)
- ✅ Scientific functions (sin, cos, tan, log, ln, sqrt, powers)
- ✅ Constants (π, e)
- ✅ Angle modes (degrees/radians)
- ✅ Calculation history
- ✅ Keyboard support
- ✅ Theme support (light/dark/auto)
- ✅ State persistence

**Supported Types:**
- `'basic'` - Basic 4-function calculator
- `'scientific'` - Scientific calculator with trigonometry, logarithms, etc.

---

### 2. Desmos Provider (Requires License)

**Perfect for:** Professional graphing, advanced visualization
**License:** Proprietary - Requires license from Desmos
**Status:** ✅ Production Ready

**API Key Required:** Production usage requires a Desmos API key. Contact Desmos at partnerships@desmos.com or visit https://www.desmos.com/api

```typescript
import { desmosProvider } from '$lib/assessment-toolkit/tools';

// Option 1: Initialize with API key (recommended)
await desmosProvider.initialize({
  apiKey: 'your_desmos_api_key_here'
});

// Option 2: Pass API key in calculator config
await desmosProvider.initialize();
const calculator = await desmosProvider.createCalculator('graphing', container, {
  theme: 'light',
  restrictedMode: false,
  desmos: {
    apiKey: 'your_desmos_api_key_here'
  }
});

// Option 3: Set globally (before initialization)
window.PIE_DESMOS_API_KEY = 'your_desmos_api_key_here';
await desmosProvider.initialize();

// Use Desmos API
calculator.setValue('y = x^2');
```

**Development/Testing:** The provider works without an API key for development and testing purposes, but production deployments require a valid Desmos license and API key.

**Features:**
- ✅ Professional graphing
- ✅ 3D graphing capability
- ✅ Interactive equation editor
- ✅ Regression analysis
- ✅ Sliders and parameters
- ✅ Widely used in education

**Supported Types:**
- `'basic'` - Basic calculator
- `'scientific'` - Scientific calculator
- `'graphing'` - Graphing calculator

---

### 3. TI Provider (Stub - Requires License)

**Perfect for:** Future TI calculator emulation
**License:** Proprietary - Requires license from Texas Instruments
**Status:** ⚠️ Stub Implementation Only

```typescript
import { tiProvider } from '$lib/assessment-toolkit/tools';

// This is a placeholder implementation
// Actual TI emulator integration requires:
// 1. Licensed TI emulator libraries
// 2. Appropriate licensing agreements
// 3. Integration with TI emulator APIs
```

**Supported Types (when available):**
- `'ti-84'` - TI-84 Plus CE emulator
- `'ti-108'` - TI-108 Elementary calculator
- `'ti-34-mv'` - TI-34 MultiView calculator

---

## Usage Examples

### Basic Calculator

```typescript
import { mathjsProvider } from '$lib/assessment-toolkit/tools';

async function createBasicCalculator() {
  // Initialize provider
  await mathjsProvider.initialize();

  // Create calculator
  const container = document.getElementById('basic-calc');
  const calculator = await mathjsProvider.createCalculator('basic', container);

  // Calculator is ready to use!
  // Users can click buttons or use keyboard
}
```

### Scientific Calculator with Response Integration

```typescript
import { mathjsProvider, responseDiscovery } from '$lib/assessment-toolkit/tools';

async function createScientificCalculator() {
  await mathjsProvider.initialize();

  const container = document.getElementById('scientific-calc');
  const calculator = await mathjsProvider.createCalculator('scientific', container, {
    theme: 'dark'
  });

  // Setup response discovery
  responseDiscovery.setupFocusTracking();

  // Add "Insert" button to calculator
  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Insert into Answer';
  insertBtn.onclick = async () => {
    const activeResponse = responseDiscovery.getActiveResponse();
    if (activeResponse) {
      const value = calculator.getValue();
      await activeResponse.insertContent(value, {
        mode: 'insert',
        format: 'numeric',
        source: {
          toolId: 'scientific-calculator',
          toolType: 'mathjs-scientific',
          timestamp: Date.now(),
        },
      });
    }
  };

  container.appendChild(insertBtn);
}
```

### State Persistence

```typescript
// Export calculator state
const state = calculator.exportState();
localStorage.setItem('calculator-state', JSON.stringify(state));

// Restore calculator state
const savedState = JSON.parse(localStorage.getItem('calculator-state'));
if (savedState) {
  calculator.importState(savedState);
}
```

### History Access

```typescript
// Get calculation history
const history = calculator.getHistory();
history.forEach(entry => {
  console.log(`${entry.expression} = ${entry.result}`);
  console.log(`Timestamp: ${new Date(entry.timestamp)}`);
});

// Clear history
calculator.clearHistory();
```

---

## Provider Comparison

| Feature | Math.js | Desmos | TI |
|---------|---------|--------|-----|
| **Cost** | FREE | Requires License | Requires License |
| **Basic Calculator** | ✅ | ✅ | ❌ |
| **Scientific** | ✅ | ✅ | ❌ |
| **Graphing** | ❌ | ✅ | ✅ (TI-84) |
| **Button UI** | ✅ | ✅ | ⚠️ Stub |
| **Keyboard Support** | ✅ | ✅ | ⚠️ Stub |
| **State Persistence** | ✅ | ✅ | ⚠️ Stub |
| **Themes** | ✅ | ✅ | ⚠️ Stub |
| **Best For** | Testing & Basic | Graphing | Future TI Emulation |

---

## Implementation Guide

### Creating a Calculator Tool Component

```svelte
<!-- tool-calculator.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toolCoordinator, mathjsProvider } from '$lib/assessment-toolkit/tools';
  import type { Calculator } from '$lib/assessment-toolkit/tools';

  export let visible: boolean = false;
  export let toolId: string = 'calculator';
  export let calculatorType: 'basic' | 'scientific' = 'basic';

  let containerEl: HTMLDivElement;
  let calculatorInstance: Calculator | null = null;

  async function initCalculator() {
    if (calculatorInstance) return;

    await mathjsProvider.initialize();
    calculatorInstance = await mathjsProvider.createCalculator(
      calculatorType,
      containerEl,
      { theme: 'auto' }
    );
  }

  function handleClose() {
    toolCoordinator.hideTool(toolId);
  }

  onMount(async () => {
    toolCoordinator.registerTool(toolId, 'Calculator', containerEl);
    if (visible) {
      await initCalculator();
    }
  });

  onDestroy(() => {
    if (calculatorInstance) {
      calculatorInstance.destroy();
    }
    toolCoordinator.unregisterTool(toolId);
  });

  $: if (visible && containerEl && !calculatorInstance) {
    initCalculator();
  }
</script>

{#if visible}
  <div
    bind:this={containerEl}
    class="calculator-tool"
    on:mousedown={() => toolCoordinator.bringToFront(toolId)}
  >
    <div class="tool-header">
      <span>Calculator</span>
      <button on:click={handleClose}>×</button>
    </div>

    <!-- Calculator will be rendered here by provider -->
  </div>
{/if}

<style>
  .calculator-tool {
    position: fixed;
    top: 100px;
    right: 50px;
    z-index: 1000;
  }

  .tool-header {
    padding: 10px;
    background: #34495e;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px 8px 0 0;
  }
</style>
```

---

## Math.js Calculator Keyboard Shortcuts

The Math.js calculator supports full keyboard navigation:

- **Numbers:** `0-9`
- **Operators:** `+`, `-`, `*`, `/`
- **Decimal:** `.`
- **Parentheses:** `(`, `)`
- **Enter:** Calculate result
- **Escape:** Clear calculator
- **Backspace:** Delete last character

---

## Architecture

All calculator providers implement the same `CalculatorProvider` interface, allowing seamless provider switching:

```typescript
interface CalculatorProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly supportedTypes: CalculatorType[];
  readonly version: string;

  initialize(): Promise<void>;
  createCalculator(type: CalculatorType, container: HTMLElement, config?: CalculatorProviderConfig): Promise<Calculator>;
  supportsType(type: CalculatorType): boolean;
  destroy(): void;
  getCapabilities(): CalculatorProviderCapabilities;
}
```

This abstraction means you can easily switch between providers without changing your code:

```typescript
// Use Math.js for testing
const calculator = await mathjsProvider.createCalculator('scientific', container);

// Switch to Desmos for graphing (requires license)
const graphCalc = await desmosProvider.createCalculator('graphing', container);
```

---

## Testing

The Math.js provider is perfect for testing calculator functionality without external dependencies or licensing:

```typescript
import { mathjsProvider } from '$lib/assessment-toolkit/tools';

describe('Calculator Tests', () => {
  it('should create basic calculator', async () => {
    await mathjsProvider.initialize();
    const container = document.createElement('div');
    const calculator = await mathjsProvider.createCalculator('basic', container);

    expect(calculator).toBeDefined();
    expect(calculator.getValue()).toBe('0');
  });

  it('should perform calculations', async () => {
    await mathjsProvider.initialize();
    const container = document.createElement('div');
    const calculator = await mathjsProvider.createCalculator('scientific', container);

    const result = await calculator.evaluate('2 + 2');
    expect(result).toBe('4');
  });
});
```

---

## License Information

- **Math.js:** Apache 2.0 - Free for commercial use
- **Desmos:** Proprietary - Contact Desmos for licensing
- **TI Emulators:** Proprietary - Contact Texas Instruments for licensing

See [open-source-calculator-comparison.md](../../../docs/tools-and-accomodations/open-source-calculator-comparison.md) for detailed comparison.
