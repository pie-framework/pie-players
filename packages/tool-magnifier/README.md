# PIE Magnifier Tool

A draggable magnification tool that allows students to zoom in on any content on the assessment page. This tool is an accessibility accommodation for students with visual impairments.

## Features

- **Multiple Zoom Levels**: 1.5x, 2x, and 3x magnification
- **Draggable**: Can be moved anywhere on the screen using mouse or keyboard
- **Content Cloning**: Creates a live clone of page content with accurate scroll positions
- **Keyboard Accessible**: Full keyboard navigation support
- **Zero DOM Mutation**: Does not modify the original content

## Architecture

This tool follows PIE's custom element (Web Component) architecture:

- Built with Svelte 5
- Registered as a custom element `<pie-tool-magnifier>`
- Integrates with PIE's ToolCoordinator for z-index management
- Uses Moveable.js for drag functionality

## Comparison to Production Implementations

### Similarities

- **Visual Design**: Same zoom levels (1.5x, 2x, 3x), button layout, and frame dimensions
- **Core Functionality**: DOM cloning, scroll position preservation, mouse tracking
- **UX Patterns**: Frozen view on mouse leave, continuous update on drag

### Differences

- **Framework**: Svelte 5 (with runes) instead of Vue 3 (Composition API)
- **Architecture**: Web Component (custom element) instead of Vue SFC
- **Dependencies**: Uses Moveable.js directly instead of VueUse composables
- **Coordination**: Integrates with PIE's ToolCoordinator for z-index management
- **Styling**: Uses PIE CSS variables for consistency
- **DOM Mutation**: Zero mutation approach (clones only, never modifies original)

### Key Architectural Improvements

1. **Web Component Standard**: Framework-agnostic, can be used in any context
2. **Modern Svelte 5**: Uses runes (`$state`, `$derived`, `$effect`) for reactive state
3. **Cleaner Separation**: Tool coordination is handled by external coordinator, not internal store
4. **Accessibility First**: ARIA labels, keyboard navigation, screen reader announcements

## Usage

### As a Custom Element

```html
<pie-tool-magnifier
  visible="true"
  tool-id="magnifier"
  magnify-root-selector="body"
></pie-tool-magnifier>
```

### With Coordinator

```typescript
import { ToolMagnifier } from '@pie-api-aws/pieoneer-tool-magnifier';
import { ToolCoordinator } from '$lib/assessment-toolkit';

const coordinator = new ToolCoordinator();

// The tool will auto-register when visible=true
```

## Props

- `visible` (Boolean): Show/hide the tool
- `toolId` (String): Unique identifier for this tool instance (default: 'magnifier')
- `coordinator` (Object): ToolCoordinator instance for z-index management
- `magnifyRootSelector` (String): CSS selector for root element to magnify (default: 'body')

## Keyboard Navigation

- **Arrow Keys**: Move the magnifier frame (10px steps)
- **1 / 2 / 3**: Set zoom level to 1.5x / 2x / 3x
- **+ / =**: Cycle to next zoom level
- **-**: Cycle to previous zoom level

## Accessibility Features

- Full keyboard navigation
- ARIA labels and roles
- Screen reader announcements for state changes
- Focus visible indicators
- High contrast focus rings

## Implementation Notes

### Content Cloning

The tool creates a deep clone of the content specified by `magnifyRootSelector` and:

1. Preserves scroll positions of all scrollable elements
2. Removes elements with `.pie-tool-magnifier__clone-ignore` class or `[data-magnifier-ignore]` attribute
3. Applies scaling and positioning transforms
4. Updates on scroll events (debounced)

### Performance

- Uses `requestAnimationFrame` for smooth updates
- Debounces scroll event handlers (100ms)
- Cleans up all listeners and RAF loops on unmount
- Only updates during drag or mouse-inside states

### Z-Index Management

The tool uses PIE's ZIndexLayer system:

- Tool frame: `ZIndexLayer.MODAL` (2002)
- Moveable controls: `ZIndexLayer.CONTROL` (2003)

### Preventing Self-Magnification

The tool adds `.pie-tool-magnifier__clone-ignore` class and `[data-magnifier-ignore]` attribute to its own frame to prevent recursive magnification.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

Requires:
- Custom Elements (Web Components)
- CSS Transform
- RequestAnimationFrame
- DOMMatrix

## Related Documentation

- [PIE Tools Architecture](../../docs/tools-high-level-architecture.md)
- [ToolCoordinator](../../tools/tool-coordinator.ts)
