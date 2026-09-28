# Protractor Tool

A draggable and rotatable protractor overlay tool for geometry and measurement questions.

## Features

- **Draggable**: Drag anywhere on the protractor with a mouse, pen or finger to move it; it may overhang the card it opens on but keeps 100px inside it
- **Rotatable**: Drag the handle above the protractor to turn it about its vertex
- **180-degree scale**: Standard protractor with two opposing 0-180 degree scales
- **Tick marks**: Every degree, with longer ticks every 5 degrees
- **Labels**: Every 10 degrees on both scales, each with a radial guide line
- **Tap controls**: While the protractor has focus, a strip below it moves and turns it without dragging
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
- Drag the protractor with a mouse, pen or finger to move it
- Arrow keys and the tap controls' arrow buttons move it 10px per press
- It may overhang the card it opens on, but keeps 100px inside it
- The cursor changes to indicate draggability

### Rotating
- Drag the handle above the protractor to turn it about its vertex, the centre of its baseline
- Shift+Arrow keys rotate it 5 degrees per press; PageUp/PageDown rotate it 1 degree
- The tap controls' turn buttons rotate it 5 or 1 degrees either way
- Useful for aligning with different angles in diagrams

### Bringing to Front
- Clicking anywhere on the protractor brings it to the front
- Managed automatically by the tool coordinator

### Closing
- Setting `visible` to `false` closes the protractor and resets its placement
- Under a coordinator, the host also hides `toolId` there, as the packaged toolbar does

## Implementation Details

### Component Structure

```
tool-protractor.svelte
├── Status live region (screen reader announcements)
└── Protractor (role="application", focusable)
    ├── Frame (clips the semi-transparent backdrop)
    │   └── Container
    │       └── protractor.svg image
    │           ├── Semicircular scale, 0-180 in both directions
    │           ├── Tick marks (every 1°, longer every 5°)
    │           ├── Degree labels and radial guide lines (every 10°)
    │           ├── Center point
    │           └── Baseline
    ├── Pivot marker on the vertex
    ├── Rotation line and 44px handle
    └── Tap controls, shown while the protractor has focus
```

Drag and rotation run through `createPointerGesture`, `createPointerDragController`
and `createPointerRotateController` in `@pie-players/pie-players-shared`.

### State Management

- Placement: an offset from the centred position and a rotation about the
  vertex, held by the component and written to its CSS `transform` by
  `applyPlacement`, which pointer, keyboard and tap controls all go through
- The tap controls sit past the protractor's baseline edge, counter-rotated to
  stay level; `applyPlacement` redocks them on every write

### Event Handling

- `pointerdown` on the protractor: brings it to the front and starts a drag
- `pointerdown` on the handle: starts a rotation
- `pointercancel` and `lostpointercapture` end a gesture as `pointerup` does
- `keydown`: Arrow keys, Shift+Arrow keys and PageUp/PageDown
- `resize`: Reapplies the bound to the current placement

## Styling

The protractor uses:
- A semi-transparent overlay in `--pie-background` (white by default) behind the scale
- Black strokes for visibility
- A focus outline in `--pie-button-focus-outline`

## Accessibility

- `role="application"` with a localized `aria-label` and `aria-roledescription`
- `tabindex="0"`; the protractor takes focus, without scrolling, when shown
- Arrow keys move it; Shift+Arrow keys and PageUp/PageDown rotate it
- Tap controls give every drag a single-pointer alternative (WCAG 2.5.7); a
  press on one keeps focus on the protractor, so the strip stays up
- A polite live region announces each move and rotation
- The protractor image has localized `alt` text

## Future Enhancements

- [ ] Degree readout showing current rotation
- [ ] Snap-to-grid option
- [ ] Measurement lines/guides
- [ ] Different protractor sizes
- [ ] Save/restore position between questions
