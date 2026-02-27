# @pie-players/pie-tool-calculator-inline

Inline calculator toggle button for PIE assessment player question headers.

## Overview

This package provides a calculator button component that can be embedded in question headers. When clicked, it toggles the visibility of a full calculator tool instance (`@pie-players/pie-tool-calculator`).

## Features

- **Web Component** - Custom element with no shadow DOM for better integration
- **Imperative API** - Services passed as JavaScript properties
- **Coordinator Integration** - Managed by ToolCoordinator for consistent state
- **Size Variants** - Supports sm, md, lg button sizes
- **WCAG 2.2 Level AA** - Fully accessible with proper ARIA attributes
- **Material Design Icon** - Calculator icon from Material Design

## Usage

### Basic Setup

```svelte
<!-- Import the component -->
<script>
  import '@pie-players/pie-tool-calculator-inline';
  import '@pie-players/pie-tool-calculator';
  import { ToolCoordinator } from '@pie-players/pie-assessment-toolkit';

  const coordinator = new ToolCoordinator();
  let calculatorInlineEl;
  let calculatorEl;
  let calculatorVisible = false;

  // Bind services imperatively (after element creation)
  $effect(() => {
    if (calculatorInlineEl) {
      calculatorInlineEl.coordinator = coordinator;
    }
    if (calculatorEl) {
      calculatorEl.coordinator = coordinator;
    }
  });

  // Subscribe to visibility changes
  $effect(() => {
    if (coordinator) {
      const unsubscribe = coordinator.subscribe(() => {
        calculatorVisible = coordinator.isToolVisible('calculator');
      });
      return unsubscribe;
    }
  });
</script>

<!-- Inline toggle button -->
<pie-tool-calculator-inline
  bind:this={calculatorInlineEl}
  tool-id="calculator-inline"
  calculator-type="scientific"
  available-types="basic,scientific,graphing"
  size="md"
></pie-tool-calculator-inline>

<!-- Calculator tool instance (hidden/shown by coordinator) -->
<pie-tool-calculator
  bind:this={calculatorEl}
  visible={calculatorVisible}
  tool-id="calculator"
></pie-tool-calculator>
```

### In ItemToolBar

The component is designed to work with `pie-item-toolbar`:

```svelte
<pie-item-toolbar
  item-id="question-1"
  tools="tts,answerEliminator,calculator"
  size="md"
></pie-item-toolbar>
```

The toolbar will automatically:
1. Render the calculator inline button
2. Bind the coordinator imperatively
3. Manage the calculator visibility state

### Props

#### Attributes (String)

- `tool-id` - Unique identifier for the tool (default: `'calculator-inline'`)
- `calculator-type` - Default calculator type (default: `'scientific'`)
- `available-types` - Comma-separated list of calculator types (default: `'basic,scientific,graphing'`)
- `size` - Button size: `'sm' | 'md' | 'lg'` (default: `'md'`)

#### JavaScript Properties

- `coordinator` - IToolCoordinator instance (required)

**Important:** The `coordinator` property must be set via JavaScript, not as an attribute:

```javascript
element.coordinator = coordinatorInstance;
```

## Calculator Tool Integration

This component works in tandem with `@pie-players/pie-tool-calculator`. The flow is:

1. **Button renders** - `pie-tool-calculator-inline` shows a toggle button
2. **User clicks** - Button calls `coordinator.toggleTool('calculator')`
3. **Calculator shows/hides** - `pie-tool-calculator` reacts to visibility state
4. **Button updates** - Active state reflects calculator visibility

## Tool ID Convention

The inline button typically uses a different tool ID than the calculator instance:

- Inline button: `calculator-inline` or `calculator-inline-{itemId}`
- Calculator tool: `calculator` or `calculator-{itemId}`

The component automatically strips `-inline` suffix when checking calculator visibility.

## Accessibility

- **WCAG 2.2 Level AA compliant**
- **Keyboard accessible** - Full keyboard navigation support
- **Focus indicators** - Clear focus states (2.4.7, 2.4.13)
- **ARIA attributes** - `aria-label`, `aria-pressed`
- **Screen reader announcements** - Status changes announced
- **Reduced motion** - Respects `prefers-reduced-motion`
- **Touch targets** - Minimum 44px touch target (2.5.2)

## Size Variants

### Small (`sm`)
- Visual size: 1.5rem × 1.5rem
- Touch target: 44px × 44px (with padding)
- Icon: 1rem × 1rem

### Medium (`md`) - Default
- Size: 2rem × 2rem
- Icon: 1.25rem × 1.25rem

### Large (`lg`)
- Size: 2.5rem × 2.5rem
- Icon: 1.5rem × 1.5rem

## Styling

The component uses CSS custom properties for theming:

```css
--pie-border: Border color (default: #ccc)
--pie-background: Background color (default: white)
--pie-text: Text color (default: #333)
--pie-secondary-background: Hover background (default: #f5f5f5)
--pie-primary: Active state background (default: #1976d2)
--pie-primary-dark: Active hover background (default: #1565c0)
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Type check
bun run typecheck

# Lint
bun run lint
```

## Dependencies

- `@pie-players/pie-assessment-toolkit` - Core toolkit services
- `svelte` - Framework (peer dependency)

## License

MIT
