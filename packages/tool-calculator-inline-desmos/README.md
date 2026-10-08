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
- **Shared state** - Opens the item toolbar's calculator through the toolkit's tool request path, so the button and the toolbar stay in step and policy applies to both
- **Size Variants** - Supports sm, md, lg button sizes
- **WCAG 2.2 Level AA** - Fully accessible with proper ARIA attributes
- **Material Design Icon** - Calculator icon from Material Design

## Usage

The element renders inside `<pie-item-scope>` under `<pie-assessment-toolkit>`.
The toolkit runtime context supplies the ToolCoordinator and the shell supplies
the item; section players provide both.

```javascript
import '@pie-players/pie-tool-calculator-inline-desmos';

// itemHeader: an element inside <pie-item-scope>
const calculatorButton = document.createElement('pie-tool-calculator-inline');
calculatorButton.setAttribute('calculator-type', 'scientific');
itemHeader.append(calculatorButton);
```

The calculator it opens is the item toolbar's: the toolkit's tool configuration
places `calculator` in the item toolbar and names its provider, and the item
toolbar renders that calculator. The button adds no calculator of its own and is
disabled while the toolbar does not render one, as when the item's tool policy
leaves the calculator out or its module failed to load.

### Props

#### Attributes (String)

- `target-tool-id` - Scoped id of the calculator the button toggles, `<toolId>:<section|item|passage>:<scopeId>` (default: `''`). Empty resolves the enclosing item's calculator, `calculator:item:<itemId>`; set it only to toggle another toolbar's calculator
- `calculator-type` - Calculator type named in the button's label and announcements (default: `'basic'`); a type outside `available-types` falls back to `'basic'`
- `available-types` - Comma-separated list of calculator types (default: `'basic,scientific,graphing'`)
- `size` - Button size: `'sm' | 'md' | 'lg'` (default: `'md'`)

The button is disabled until the toolkit runtime context supplies a
ToolCoordinator and the target toolbar renders the calculator. With no item
shell and no valid `target-tool-id`, it stays disabled and logs a console
warning.

## Toggle behavior

1. The button resolves its target from the item shell context: the item toolbar for `<canonicalItemId or itemId>`, which shows the calculator as `calculator:item:<id>`.
2. It asks the toolkit coordinator whether a tool request for `calculator` at that level and scope reaches a toolbar (`canRequestTool`), and re-asks when toolbars register or policy changes.
3. A click on a closed calculator sends the request (`requestTool`), and the toolbar shows its calculator; a click on an open one hides it.
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
