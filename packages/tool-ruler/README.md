# @pie-players/pie-tool-ruler

A draggable and rotatable ruler measurement tool for PIE assessment players.

## Features

- **Draggable**: Drag anywhere on the ruler, with a mouse, pen or finger, to move it.
  It may overhang the card it opens on, but keeps 100px inside it.
- **Rotatable**: Drag the handle above the ruler to turn it about its centre, or use
  the keyboard shortcuts
- **Tap controls**: While the ruler has focus, a strip below it moves it 10px and
  turns it 5° or 1° a press, so it can be placed without dragging
- **Unit Toggle**: Switch between inches and centimeters
- **Keyboard Navigation**:
  - Arrow keys: Move the ruler
  - Shift + Arrow keys: Rotate the ruler
  - PageUp/PageDown: Fine rotation control
  - U key: Toggle between inches and centimeters
- **Accessibility**: Full ARIA support and screen reader announcements

## Usage

```svelte
<script>
  // Imports and registers <pie-tool-ruler>.
  import '@pie-players/pie-tool-ruler';

  let showRuler = $state(false);
</script>

<pie-tool-ruler visible={showRuler} toolId="ruler" />
```

## Props

- `visible` (boolean): Controls visibility of the tool
- `toolId` (string): Unique identifier for tool coordination (default: 'ruler')
