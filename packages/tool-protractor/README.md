# Protractor Tool

A draggable and rotatable protractor overlay tool for geometry and measurement questions.

## Features

- **Draggable**: Click and drag anywhere on the protractor to move it
- **Rotatable**: Drag the rotation handle above the protractor to rotate it
- **180-degree scale**: Standard protractor with two opposing 0-180 degree scales
- **Tick marks**: Every degree, with longer ticks every 5 degrees
- **Labels**: Every 10 degrees on both scales, each with a radial guide line
- **Keyboard control**: Arrow keys move the protractor; Shift+Arrow keys and PageUp/PageDown rotate it
- **Semi-transparent**: Allows viewing content underneath
- **Z-index management**: Automatically brings to front when clicked

## Usage

### In Assessment Player

```svelte
<script>
  import '@pie-players/pie-tool-protractor';

  let showProtractor = $state(false);
</script>

<button onclick={() => (showProtractor = !showProtractor)}>
  Toggle Protractor
</button>

<pie-tool-protractor visible={showProtractor} toolId="protractor" />
```

Inside a toolkit runtime context, the element takes the ToolCoordinator from
that context and registers `toolId` on `ZIndexLayer.TOOL`. The coordinator then
displays the element only while `toolId` is visible there, so the host shows the
tool through the coordinator as well as through `visible`. The packaged
`protractor` toolbar capability in `@pie-players/pie-default-tool-loaders` does
both: its button toggles the tool in the coordinator and its sync sets
`visible`.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `false` | Controls tool visibility |
| `toolId` | `string` | `'protractor'` | Unique identifier for the tool |

## Interactions

### Moving
- Click and drag the protractor to move it around the screen
- Arrow keys move it 10px per press
- The cursor changes to indicate draggability

### Rotating
- Drag the rotation handle above the protractor to rotate it
- Shift+Arrow keys rotate it 5 degrees per press; PageUp/PageDown rotate it 1 degree
- Rotation is continuous and smooth
- Useful for aligning with different angles in diagrams

### Bringing to Front
- Clicking anywhere on the protractor brings it to the front
- Managed automatically by the tool coordinator

### Closing
- Setting `visible` to `false` closes the protractor and removes its drag and rotation controls
- Under a coordinator, the host also hides `toolId` there, as the packaged toolbar does

## Implementation Details

### Component Structure

```
tool-protractor.svelte
├── Status live region (screen reader announcements)
└── Protractor (role="application", focusable)
    └── Container
        └── protractor.svg image
            ├── Semicircular scale, 0-180 in both directions
            ├── Tick marks (every 1°, longer every 5°)
            ├── Degree labels and radial guide lines (every 10°)
            ├── Center point
            └── Baseline
```

Drag and rotation run through Moveable (`moveable`), which attaches its controls
to `document.body`.

### State Management

- Placement: the protractor's CSS `transform` (translate and rotate), written by
  Moveable during a drag or rotation and by the keyboard handler
- The keyboard handler reads the current position and angle back from the
  computed transform matrix

### Event Handling

- Moveable `drag` and `rotate` events write the new transform
- `pointerdown`: Brings the protractor to the front
- `keydown`: Arrow keys, Shift+Arrow keys and PageUp/PageDown
- `resize`: Updates Moveable's bounds

## Styling

The protractor uses:
- A semi-transparent overlay in `--pie-background` (white by default) behind the scale
- Black strokes for visibility
- A focus outline in `--pie-button-focus-outline`

## Accessibility

- `role="application"` with a localized `aria-label` and `aria-roledescription`
- `tabindex="0"`; the protractor takes focus, without scrolling, when shown
- Arrow keys move it; Shift+Arrow keys and PageUp/PageDown rotate it
- A polite live region announces each move and rotation
- The protractor image has localized `alt` text

## Future Enhancements

- [ ] Degree readout showing current rotation
- [ ] Snap-to-grid option
- [ ] Measurement lines/guides
- [ ] Different protractor sizes
- [ ] Save/restore position between questions
