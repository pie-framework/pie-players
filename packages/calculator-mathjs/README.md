# @pie-players/pie-calculator-mathjs

Professional, accessible calculator implementation using Math.js with DaisyUI theming.

## Features

- ✅ **Open Source**: No licensing fees, always available
- ✅ **WCAG 2.2 Level AA**: Fully accessible with screen reader support
- ✅ **DaisyUI Theming**: Consistent design with your application
- ✅ **Keyboard Navigation**: Complete keyboard control with industry-standard shortcuts
- ✅ **Touch-Friendly**: 48x48px buttons for mobile/tablet
- ✅ **High Contrast**: Automatic support for high contrast and forced colors modes
- ✅ **Zero Dependencies**: Only requires Math.js library
- ✅ **TypeScript**: Full type safety

## Installation

```bash
npm install @pie-players/pie-calculator-mathjs @pie-players/pie-calculator
```

## Load Math.js Library

The calculator requires the Math.js library to be loaded:

### Via CDN (Recommended for quick start)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.3/math.min.js"></script>
```

### Via npm

```bash
npm install mathjs
```

```typescript
import * as math from 'mathjs';
// Make it globally available
(window as any).math = math;
```

## Usage

### Basic Calculator

```typescript
import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs';

// Create provider
const provider = new MathJsCalculatorProvider();

// Initialize
await provider.initialize();

// Create calculator instance
const container = document.getElementById('calculator-container');
const calculator = await provider.createCalculator('basic', container, {
  theme: 'light' // or 'dark', 'auto'
});

// Calculator is now ready to use!
```

### Scientific Calculator

```typescript
const calculator = await provider.createCalculator('scientific', container, {
  theme: 'dark'
});
```

### With DaisyUI Themes

The calculator automatically inherits your DaisyUI theme:

```html
<div data-theme="corporate">
  <div id="calculator-container"></div>
</div>
```

Or set the theme programmatically:

```typescript
const calculator = await provider.createCalculator('basic', container, {
  theme: 'auto' // Respects system preference
});
```

## API

### CalculatorProvider Methods

#### `initialize()`

Initialize the provider. Must be called before creating calculators.

```typescript
await provider.initialize();
```

#### `createCalculator(type, container, config?)`

Create a calculator instance.

```typescript
const calculator = await provider.createCalculator(
  'basic', // or 'scientific'
  document.getElementById('calculator'),
  {
    theme: 'light', // optional: 'light' | 'dark' | 'auto'
    restrictedMode: false // optional: disable advanced features
  }
);
```

### Calculator Methods

#### `getValue(): string`

Get the current calculator value.

```typescript
const result = calculator.getValue();
console.log(result); // "42"
```

#### `setValue(value: string): void`

Set the calculator value.

```typescript
calculator.setValue("123");
```

#### `clear(): void`

Clear the calculator.

```typescript
calculator.clear();
```

#### `evaluate(expression: string): Promise<string>`

Evaluate a mathematical expression.

```typescript
const result = await calculator.evaluate("2 + 3 * 4");
console.log(result); // "14"
```

#### `getHistory(): CalculationHistoryEntry[]`

Get calculation history.

```typescript
const history = calculator.getHistory();
history.forEach(entry => {
  console.log(`${entry.expression} = ${entry.result}`);
});
```

#### `clearHistory(): void`

Clear calculation history.

```typescript
calculator.clearHistory();
```

#### `exportState(): CalculatorState`

Export calculator state for persistence.

```typescript
const state = calculator.exportState();
localStorage.setItem('calculator-state', JSON.stringify(state));
```

#### `importState(state: CalculatorState): void`

Restore calculator state.

```typescript
const state = JSON.parse(localStorage.getItem('calculator-state'));
calculator.importState(state);
```

#### `destroy(): void`

Clean up and remove the calculator.

```typescript
calculator.destroy();
```

## Keyboard Shortcuts

### Basic Shortcuts

| Key | Action |
|-----|--------|
| `0-9` | Input digits |
| `+ - * /` | Operators |
| `.` | Decimal point |
| `Enter` or `=` | Calculate |
| `Escape` or `C` | Clear |
| `Backspace` | Delete last character |
| `%` | Percent |

### Grid Navigation

| Key | Action |
|-----|--------|
| `↑ ↓ ← →` | Navigate between buttons |
| `Home` | First button in row |
| `End` | Last button in row |
| `Enter` or `Space` | Activate button |

### Scientific Calculator

| Key | Function |
|-----|----------|
| `S` | Sine |
| `O` | Cosine |
| `T` | Tangent |
| `Q` | Square root |

## Accessibility

This calculator is **WCAG 2.2 Level AA compliant** and includes:

- ✅ Full keyboard navigation
- ✅ Screen reader support (NVDA, JAWS, VoiceOver, TalkBack)
- ✅ ARIA labels and live regions
- ✅ High contrast mode support
- ✅ Focus indicators (3px solid outline)
- ✅ Touch-friendly buttons (48x48px)
- ✅ Reduced motion support
- ✅ Proper color contrast (4.5:1+ for text, 3:1+ for UI)

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for complete accessibility documentation.

## Styling

### DaisyUI Classes Used

The calculator uses these DaisyUI components:

- `card` - Container
- `btn` - Buttons
- `btn-square` - Square buttons
- `btn-lg` - Large touch targets
- `btn-primary` - Operator buttons
- `btn-error` - Clear button
- `btn-success` - Equals button
- `btn-warning` - Special functions
- `alert alert-error` - Error messages
- `input` - Display field

### Custom Styling

You can customize the calculator using CSS:

```css
/* Customize primary button color */
[data-theme="custom"] .btn-primary {
  background-color: #your-color;
}

/* Customize calculator container */
.calculator-mathjs {
  max-width: 400px;
  margin: 0 auto;
}

/* Customize display */
.calculator-display-input {
  font-size: 3rem;
}
```

## Examples

### React Integration

```tsx
import { useEffect, useRef } from 'react';
import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs';

export function Calculator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);

  useEffect(() => {
    const provider = new MathJsCalculatorProvider();

    provider.initialize().then(() => {
      if (containerRef.current) {
        provider.createCalculator('basic', containerRef.current, {
          theme: 'light'
        }).then(calc => {
          calculatorRef.current = calc;
        });
      }
    });

    return () => {
      calculatorRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} />;
}
```

### Svelte Integration

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs';

  let container: HTMLDivElement;
  let calculator: any;

  onMount(async () => {
    const provider = new MathJsCalculatorProvider();
    await provider.initialize();
    calculator = await provider.createCalculator('scientific', container, {
      theme: 'dark'
    });
  });

  onDestroy(() => {
    calculator?.destroy();
  });
</script>

<div bind:this={container}></div>
```

### Vue Integration

```vue
<template>
  <div ref="container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs';

const container = ref(null);
const calculator = ref(null);

onMounted(async () => {
  const provider = new MathJsCalculatorProvider();
  await provider.initialize();
  calculator.value = await provider.createCalculator(
    'basic',
    container.value,
    { theme: 'light' }
  );
});

onUnmounted(() => {
  calculator.value?.destroy();
});
</script>
```

### Modal/Dialog Usage

```typescript
// Show calculator in a modal
async function showCalculatorModal() {
  const modal = document.getElementById('calculator-modal');
  const container = modal.querySelector('.calculator-container');

  const provider = new MathJsCalculatorProvider();
  await provider.initialize();

  const calculator = await provider.createCalculator('basic', container);

  // Show modal
  modal.showModal();

  // Focus trap is automatic (WCAG 2.1.2)

  // Close handler
  modal.addEventListener('close', () => {
    calculator.destroy();
  });
}
```

## Advanced Usage

### Programmatic Calculation

```typescript
// Perform calculation without user input
const result = await calculator.evaluate("sqrt(144) + 5 * 3");
console.log(result); // "27"
```

### State Persistence

```typescript
// Save state on page unload
window.addEventListener('beforeunload', () => {
  const state = calculator.exportState();
  localStorage.setItem('calc-state', JSON.stringify(state));
});

// Restore state on page load
window.addEventListener('load', async () => {
  const savedState = localStorage.getItem('calc-state');
  if (savedState) {
    const state = JSON.parse(savedState);
    calculator.importState(state);
  }
});
```

### Memory Operations

Memory operations are built-in:

- **MC** - Memory Clear
- **MR** - Memory Recall
- **M+** - Memory Add
- **M-** - Memory Subtract

```typescript
// Memory is automatically managed
// Access via UI or keyboard shortcuts (Alt+P, Alt+Q, Alt+R, Alt+M)
```

## Troubleshooting

### Math.js Not Found

**Error**: `Math.js library not found`

**Solution**: Ensure Math.js is loaded before initializing the calculator:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.3/math.min.js"></script>
<script src="your-app.js"></script>
```

### Styling Not Applied

**Problem**: Calculator doesn't match your DaisyUI theme

**Solution**: Ensure DaisyUI is loaded and the calculator is inside a themed container:

```html
<div data-theme="corporate">
  <div id="calculator-container"></div>
</div>
```

### TypeScript Errors

**Error**: Type errors with calculator methods

**Solution**: Install type definitions:

```bash
npm install --save-dev @types/mathjs
```

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ iOS Safari 14+
- ✅ Android Chrome 90+

## License

MIT

## Related Packages

- [@pie-players/pie-calculator](../calculator) - Base calculator interfaces
- [@pie-players/pie-calculator-desmos](../calculator-desmos) - Desmos graphing calculator
- [@pie-players/assessment-toolkit](../assessment-toolkit) - Assessment player with calculator integration

## Contributing

This package is part of the PIE Players monorepo. See the root [README](../../README.md) for contribution guidelines.

## Support

For issues or questions:
- File an issue on [GitHub](https://github.com/pie-framework/pie-players/issues)
- See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for accessibility-specific documentation
- Check the [examples](../../examples) for more usage patterns
