# @pie-players/pie-tool-calculator-inline-desmos

Inline calculator toggle button for PIE assessment player question headers.

## Overview

This package provides the existing `<pie-tool-calculator-inline>` compatibility
element. It wraps the provider-neutral inline surface from
`@pie-players/pie-tool-calculator-shared` and toggles a calculator tool instance.

## Features

- **Web Component** - Custom element with an open shadow root
- **Runtime Context** - Takes its ToolCoordinator from the toolkit runtime context
- **Coordinator Integration** - Managed by ToolCoordinator for consistent state
- **Size Variants** - Supports sm, md, lg button sizes
- **WCAG 2.2 Level AA** - Fully accessible with proper ARIA attributes
- **Material Design Icon** - Calculator icon from Material Design

## Usage

### Basic Setup

The calculator surface this button toggles, `<pie-tool-calculator>`, comes from
`@pie-players/pie-tool-calculator-desmos`. Neither this package nor
`@pie-players/pie-default-tool-loaders` depends on it, so the host installs it:

```bash
bun add @pie-players/pie-tool-calculator-desmos
```

Both elements sit inside `<pie-assessment-toolkit>`, whose runtime context
supplies the ToolCoordinator:

```html
<pie-assessment-toolkit>
  <!-- Inline toggle button -->
  <pie-tool-calculator-inline
    tool-id="calculator-inline"
    target-tool-id="calculator"
    calculator-type="scientific"
    available-types="basic,scientific,graphing"
    size="md"
  ></pie-tool-calculator-inline>

  <!-- Calculator tool instance -->
  <pie-tool-calculator tool-id="calculator"></pie-tool-calculator>
</pie-assessment-toolkit>
```

`toggleTool` ignores an id the coordinator has not registered, and
`<pie-tool-calculator>` shows on its `visible` property, so the host registers
the target id and binds `visible` to it:

```javascript
import '@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element';
import '@pie-players/pie-tool-calculator-inline-desmos';
import '@pie-players/pie-tool-calculator-desmos';

// toolkitCoordinator: the ToolkitCoordinator passed to <pie-assessment-toolkit> as `coordinator`
const tools = toolkitCoordinator.toolCoordinator;
const calculatorEl = document.querySelector('pie-tool-calculator');
tools.registerTool('calculator', 'Calculator');

// Subscribe to visibility changes
tools.subscribe(() => {
  calculatorEl.visible = tools.isToolVisible('calculator');
});
```

The calculator surface's props are in the
[Desmos calculator tool README](../tool-calculator-desmos/README.md).

### Props

#### Attributes (String)

- `tool-id` - Unique identifier for the tool (default: `'calculator-inline'`)
- `target-tool-id` - Tool id the button toggles; empty toggles `tool-id` (default: `''`)
- `calculator-type` - Calculator type named in the button's label and announcements (default: `'basic'`); a type outside `available-types` falls back to `'basic'`
- `available-types` - Comma-separated list of calculator types (default: `'basic,scientific,graphing'`)
- `size` - Button size: `'sm' | 'md' | 'lg'` (default: `'md'`)

The button is disabled until a toolkit runtime context supplies a
ToolCoordinator.

## Calculator Tool Integration

This component works in tandem with `@pie-players/pie-tool-calculator-desmos`. The flow is:

1. **Button registers** - `pie-tool-calculator-inline` registers its `tool-id` with the context's ToolCoordinator
2. **User clicks** - Button calls the coordinator's `toggleTool` with the target id
3. **Calculator shows/hides** - the host sets `pie-tool-calculator`'s `visible` from the coordinator's visibility state
4. **Button updates** - `aria-pressed`, the active style and a status announcement follow the target's visibility

## Tool ID Convention

The inline button uses a different tool ID than the calculator instance, which
`target-tool-id` names:

- Inline button: `calculator-inline`
- Calculator tool: `calculator`, or a scoped instance id such as `calculator:item:question-1`

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
--pie-button-background-color: Button fill, ahead of --pie-button-bg
--pie-button-bg: Button fill (default: theme button surface)
--pie-text: Text color (default: #333)
--pie-button-hover-background-color: Hover fill, ahead of --pie-button-hover-bg
--pie-button-hover-bg: Hover fill (default: theme hover surface)
--pie-tool-trigger-active-background: Active/open button background
--pie-tool-trigger-active-color: Active/open button foreground
--pie-tool-trigger-active-border-color: Active/open button border
```

The trigger fills itself from the button tokens. `--pie-background` is the page
token and the base light theme ships it transparent, so a host that sets it does
not change this button; set `--pie-button-bg`, or `--pie-button-background-color`
for this control alone.

Hosts should prefer the `--pie-tool-trigger-active-*` variables when styling the
calculator button's active/open state instead of overriding broad semantic tokens
such as `--pie-primary`. If these variables are unset, the button preserves the
existing filled active look using `--pie-primary` and `--pie-primary-dark`
fallbacks. Hosts remain responsible for maintaining WCAG AA
foreground/background contrast when overriding active trigger colors.

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

## License

MIT
