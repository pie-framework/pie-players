# @pie-players/pie-tool-calculator-inline-desmos

Inline calculator toggle button for PIE assessment player question headers.

## Overview

`<pie-tool-calculator-inline>` is a toggle button for the calculator an item
toolbar renders. It wraps the provider-neutral inline surface from
`@pie-players/pie-tool-calculator-shared`, which the GeoGebra and Cortex inline
packages share.

## Features

- **Web Component** - Custom element with an open shadow root
- **Toolkit context** - Takes its ToolCoordinator from the toolkit runtime context and its item from the enclosing item shell
- **Shared state** - Opens the item toolbar's calculator instance, so the button and the toolbar stay in step
- **Size Variants** - Supports sm, md, lg button sizes
- **WCAG 2.2 Level AA** - Fully accessible with proper ARIA attributes
- **Material Design Icon** - Calculator icon from Material Design

## Usage

The element renders inside `<pie-item-shell>` under `<pie-assessment-toolkit>`.
The toolkit runtime context supplies the ToolCoordinator and the shell supplies
the item; section players provide both.

```javascript
import '@pie-players/pie-tool-calculator-inline-desmos';

// itemHeader: an element inside <pie-item-shell>
const calculatorButton = document.createElement('pie-tool-calculator-inline');
calculatorButton.setAttribute('calculator-type', 'scientific');
itemHeader.append(calculatorButton);
```

The calculator it opens is the item toolbar's: the toolkit's tool configuration
places `calculator` in the item toolbar and names its provider, and the item
toolbar renders that calculator. The button adds no calculator of its own, so
an item whose tool policy leaves the calculator out has nothing for it to open.

### Props

#### Attributes (String)

- `target-tool-id` - Coordinator tool id the button toggles (default: `''`). Empty resolves the enclosing item's calculator, `calculator:item:<itemId>`; set it only to toggle a calculator registered under another id
- `calculator-type` - Calculator type named in the button's label and announcements (default: `'basic'`); a type outside `available-types` falls back to `'basic'`
- `available-types` - Comma-separated list of calculator types (default: `'basic,scientific,graphing'`)
- `size` - Button size: `'sm' | 'md' | 'lg'` (default: `'md'`)

The button is disabled until the toolkit runtime context supplies a
ToolCoordinator and a target resolves. With no item shell and no
`target-tool-id`, it stays disabled and logs a console warning.

## Toggle behavior

1. The button resolves its target from the item shell context: `calculator:item:<canonicalItemId or itemId>`, the id the item toolbar uses.
2. A click registers that id with the coordinator if the toolbar has not yet, then calls `toggleTool`.
3. The item toolbar renders or hides its calculator from the coordinator's visibility state.
4. `aria-pressed`, the active style and a status announcement follow the target's visibility, including changes made from the toolbar.

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

- `@pie-players/pie-assessment-toolkit` - Toolkit contexts and scoped tool ids

## License

MIT
