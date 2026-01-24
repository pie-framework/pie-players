# Protractor Tool

A draggable and rotatable protractor overlay tool for geometry and measurement questions.

## Features

- **Draggable**: Click and drag anywhere on the protractor to move it
- **Rotatable**: Use the rotate handle (green circle) to rotate the protractor
- **180-degree scale**: Standard protractor with 0-180 degree markings
- **Major tick marks**: Every 30 degrees (0, 30, 60, 90, 120, 150, 180)
- **Minor tick marks**: Every 10 degrees
- **Semi-transparent**: Allows viewing content underneath
- **Z-index management**: Automatically brings to front when clicked

## Usage

### In Assessment Player

```svelte
<script>
  import { ToolProtractor } from '$lib/tags/tool-protractor';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  
  let showProtractor = false;
  
  $: {
    const state = toolCoordinator.getToolState('protractor');
    showProtractor = state?.isVisible ?? false;
  }
</script>

<button on:click={() => toolCoordinator.toggleTool('protractor')}>
  Toggle Protractor
</button>

<ToolProtractor visible={showProtractor} toolId="protractor" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `false` | Controls tool visibility |
| `toolId` | `string` | `'protractor'` | Unique identifier for the tool |

## Interactions

### Moving
- Click and drag the protractor body or header to move it around the screen
- The cursor changes to indicate draggability

### Rotating
- Click and drag the green rotate handle (bottom right) to rotate the protractor
- Rotation is continuous and smooth
- Useful for aligning with different angles in diagrams

### Bringing to Front
- Clicking anywhere on the protractor brings it to the front
- Managed automatically by the tool coordinator

### Closing
- Click the × button in the header to close the protractor
- Can also be closed programmatically via `toolCoordinator.hideTool('protractor')`

## Implementation Details

### Component Structure

```
tool-protractor.svelte
├── Header (title + close button)
├── SVG Protractor
│   ├── Background semicircle
│   ├── Degree markings (0-180)
│   ├── Tick marks (major every 30°, minor every 10°)
│   ├── Degree labels
│   ├── Center point
│   └── Baseline
└── Rotate handle (bottom right)
```

### State Management

- Position: `{ x, y }` in pixels from top-left
- Rotation: Angle in degrees
- Drag state: Tracks active dragging
- Rotation state: Tracks active rotation

### Event Handling

- `mousedown`: Initiates drag or rotation
- `mousemove`: Updates position or rotation
- `mouseup`: Ends drag or rotation
- Events use global listeners for smooth interaction

## Styling

The protractor uses:
- White background with subtle transparency
- Black stroke for visibility
- Shadow for depth
- Rounded corners on container
- Hover effects on buttons

## Accessibility

- `role="dialog"`: Identifies the tool as a dialog
- `aria-label="Protractor Tool"`: Provides accessible name
- `tabindex="-1"`: Allows programmatic focus
- Close button has `aria-label="Close protractor"`

## Future Enhancements

- [ ] Degree readout showing current rotation
- [ ] Snap-to-grid option
- [ ] Measurement lines/guides
- [ ] Different protractor sizes
- [ ] Keyboard controls for precise positioning
- [ ] Save/restore position between questions

