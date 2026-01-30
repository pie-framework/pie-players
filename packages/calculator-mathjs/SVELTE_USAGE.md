# Svelte Implementation Guide

The Math.js calculator is available in two implementations:

1. **Vanilla TypeScript** (default) - Framework-agnostic
2. **Svelte Components** (recommended) - Clean, maintainable component architecture

This guide covers the **Svelte implementation**.

## Why Svelte?

The Svelte implementation offers several advantages:

✅ **Component Architecture**: Clean separation of concerns
✅ **Smaller Bundle**: Svelte compiles to vanilla JS
✅ **Better Maintainability**: Each component is self-contained
✅ **Type Safety**: Full TypeScript support
✅ **Reactivity**: Svelte's reactive system handles state updates

## Component Structure

```
Calculator.svelte (main container)
├── CalculatorDisplay.svelte (display + history)
├── ErrorAlert.svelte (error messages)
├── MemoryButtons.svelte (MC, MR, M+, M-)
├── ScientificButtons.svelte (sin, cos, tan, etc.)
└── CalculatorGrid.svelte (number pad + operators)
    └── CalculatorButton.svelte (individual buttons)
```

## Installation

```bash
npm install @pie-players/pie-calculator-mathjs @pie-players/pie-calculator mathjs svelte
```

## Usage

### Option 1: Provider API (matches vanilla implementation)

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs/svelte';

  let container: HTMLDivElement;
  let calculator: any;

  onMount(async () => {
    const provider = new MathJsCalculatorProvider();
    await provider.initialize();

    calculator = await provider.createCalculator('basic', container, {
      theme: 'light'
    });
  });

  onDestroy(() => {
    calculator?.destroy();
  });
</script>

<div bind:this={container}></div>
```

### Option 2: Direct Component Usage (recommended)

```svelte
<script lang="ts">
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';

  let calculatorRef: any;

  function handleStateChange(state: any) {
    console.log('Calculator state:', state);
  }
</script>

<Calculator
  bind:this={calculatorRef}
  type="scientific"
  theme="dark"
  {math}
  onStateChange={handleStateChange}
/>
```

## Component Props

### Calculator.svelte

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'basic' \| 'scientific'` | `'basic'` | Calculator type |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Color theme |
| `math` | `any` | required | Math.js instance |
| `onStateChange` | `(state: any) => void` | optional | State change callback |

### Calculator Public Methods

Access calculator methods using `bind:this`:

```svelte
<script>
  let calc;

  function getCurrentValue() {
    return calc.getValue();
  }

  function setNewValue() {
    calc.setValue('123');
  }

  function getCalculationHistory() {
    return calc.getHistory();
  }
</script>

<Calculator bind:this={calc} ... />
<button onclick={getCurrentValue}>Get Value</button>
```

#### Available Methods

- `getValue(): string` - Get current value
- `setValue(value: string): void` - Set current value
- `getHistory(): CalculationHistoryEntry[]` - Get calculation history
- `clearHistory(): void` - Clear history
- `exportState(): CalculatorState` - Export state for persistence
- `importState(state: CalculatorState): void` - Import previously saved state

## Component Customization

### Using Custom Components

You can replace individual components:

```svelte
<script lang="ts">
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import CustomDisplay from './CustomDisplay.svelte';
  // ... other imports
</script>

<Calculator type="basic" theme="light" {math}>
  <CustomDisplay slot="display" />
</Calculator>
```

### Styling with DaisyUI Themes

The calculator automatically uses DaisyUI themes:

```svelte
<div data-theme="corporate">
  <Calculator type="basic" theme="light" {math} />
</div>
```

Or programmatically:

```svelte
<script>
  let theme = $state('light');

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }
</script>

<Calculator type="basic" {theme} {math} />
<button onclick={toggleTheme}>Toggle Theme</button>
```

### Custom CSS

Override styles using `:global()`:

```svelte
<style>
  :global(.calculator-mathjs) {
    max-width: 500px;
    margin: 0 auto;
  }

  :global(.calculator-mathjs .btn-primary) {
    background-color: #your-color;
  }

  :global(.calculator-display-input) {
    font-size: 3rem;
  }
</style>
```

## State Management

### Reactive State

The calculator automatically handles state updates:

```svelte
<script>
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';

  let currentValue = $state('0');

  function handleStateChange(state) {
    currentValue = state.value;
    console.log('New value:', currentValue);
  }
</script>

<Calculator
  type="basic"
  theme="light"
  {math}
  onStateChange={handleStateChange}
/>

<p>Current value: {currentValue}</p>
```

### Persistence

Save and restore calculator state:

```svelte
<script>
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';
  import { onMount } from 'svelte';

  let calc;

  // Save state on change
  function handleStateChange(state) {
    localStorage.setItem('calc-state', JSON.stringify(state));
  }

  // Restore state on mount
  onMount(() => {
    const savedState = localStorage.getItem('calc-state');
    if (savedState && calc) {
      calc.importState(JSON.parse(savedState));
    }
  });
</script>

<Calculator
  bind:this={calc}
  type="basic"
  theme="light"
  {math}
  onStateChange={handleStateChange}
/>
```

## Individual Component Usage

You can use individual components directly:

```svelte
<script>
  import CalculatorDisplay from '@pie-players/pie-calculator-mathjs/svelte/components/CalculatorDisplay.svelte';
  import CalculatorButton from '@pie-players/pie-calculator-mathjs/svelte/components/CalculatorButton.svelte';
  import CalculatorGrid from '@pie-players/pie-calculator-mathjs/svelte/components/CalculatorGrid.svelte';

  let currentValue = $state('0');

  function handleInput(value: string) {
    currentValue += value;
  }
</script>

<CalculatorDisplay {currentValue} />
<CalculatorGrid type="basic" onInput={handleInput} onAction={() => {}} />
```

## SvelteKit Integration

### +page.svelte

```svelte
<script lang="ts">
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';
</script>

<svelte:head>
  <title>Calculator Demo</title>
</svelte:head>

<main class="container mx-auto p-4">
  <h1>Math Calculator</h1>
  <Calculator type="scientific" theme="auto" {math} />
</main>
```

### With Server-Side Rendering

Calculator components work with SSR, but require client-side mounting:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';
</script>

{#if browser}
  <Calculator type="basic" theme="light" {math} />
{:else}
  <div class="skeleton">Loading calculator...</div>
{/if}
```

## Accessibility

The Svelte implementation maintains full WCAG 2.2 Level AA compliance:

- ✅ Keyboard navigation (arrow keys, shortcuts)
- ✅ Screen reader support (ARIA labels, live regions)
- ✅ Focus management (visible indicators)
- ✅ High contrast mode support
- ✅ Touch-friendly (48x48px buttons)

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for complete details.

## TypeScript

Full TypeScript support with proper types:

```svelte
<script lang="ts">
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import type { CalculatorState } from '@pie-players/pie-calculator';
  import * as math from 'mathjs';

  let calc: Calculator;
  let state: CalculatorState | null = null;

  function saveState() {
    state = calc.exportState();
  }
</script>

<Calculator bind:this={calc} type="basic" theme="light" {math} />
```

## Testing

### Unit Testing with Vitest

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
import * as math from 'mathjs';

describe('Calculator', () => {
  it('renders correctly', () => {
    const { getByLabelText } = render(Calculator, {
      props: { type: 'basic', theme: 'light', math }
    });

    expect(getByLabelText('Basic Calculator')).toBeInTheDocument();
  });

  it('performs calculations', async () => {
    const { getByLabelText, component } = render(Calculator, {
      props: { type: 'basic', theme: 'light', math }
    });

    const sevenBtn = getByLabelText('Seven');
    const plusBtn = getByLabelText('Add');
    const threeBtn = getByLabelText('Three');
    const equalsBtn = getByLabelText('Equals');

    await fireEvent.click(sevenBtn);
    await fireEvent.click(plusBtn);
    await fireEvent.click(threeBtn);
    await fireEvent.click(equalsBtn);

    expect(component.getValue()).toBe('10');
  });
});
```

### E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test';

test('calculator performs basic operations', async ({ page }) => {
  await page.goto('/calculator');

  // Click buttons
  await page.getByLabel('Two').click();
  await page.getByLabel('Multiply').click();
  await page.getByLabel('Three').click();
  await page.getByLabel('Equals').click();

  // Check result
  const display = page.getByLabel(/Calculator display/);
  await expect(display).toHaveValue('6');
});
```

## Performance

The Svelte implementation is highly optimized:

- **Bundle size**: ~15KB (minified + gzipped, excluding Math.js)
- **Load time**: < 50ms (after Math.js loaded)
- **Render time**: < 100ms
- **Button response**: < 16ms (60fps)

## Troubleshooting

### Math.js Not Found

**Error**: `Math.js not available`

**Solution**: Import math.js before using the calculator:

```svelte
<script>
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';
  // Make sure to pass it to the component
</script>

<Calculator type="basic" theme="light" {math} />
```

### Component Not Rendering

**Problem**: Calculator doesn't appear

**Solution**: Ensure parent container has proper dimensions:

```svelte
<div style="width: 100%; max-width: 400px;">
  <Calculator type="basic" theme="light" {math} />
</div>
```

### TypeScript Errors

**Error**: Type errors with component props

**Solution**: Update Svelte version and ensure proper type imports:

```bash
npm update svelte
```

```typescript
import type { ComponentType } from 'svelte';
import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
```

## Migration from Vanilla Implementation

If you're using the vanilla TypeScript implementation, migrating to Svelte is straightforward:

### Before (Vanilla)

```typescript
const provider = new MathJsCalculatorProvider();
await provider.initialize();
const calculator = await provider.createCalculator('basic', container, {
  theme: 'light'
});
```

### After (Svelte)

```svelte
<script lang="ts">
  import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
  import * as math from 'mathjs';
</script>

<Calculator type="basic" theme="light" {math} />
```

The Svelte version is simpler, smaller, and easier to maintain!

## Examples

Complete examples are available in the repository:

- [Basic Calculator](../../examples/calculator-basic-svelte)
- [Scientific Calculator](../../examples/calculator-scientific-svelte)
- [With State Persistence](../../examples/calculator-persistence-svelte)
- [Custom Styling](../../examples/calculator-custom-theme-svelte)

## Support

For issues or questions:
- File an issue on [GitHub](https://github.com/pie-framework/pie-players/issues)
- Check [ACCESSIBILITY.md](./ACCESSIBILITY.md) for accessibility documentation
- See main [README.md](./README.md) for general usage
