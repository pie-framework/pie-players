# Ruler Tool

A draggable and rotatable ruler measurement tool for the PIEoneer assessment player.

## Features

- **Draggable**: Click and drag anywhere on the ruler to move it
- **Rotatable**: Use the green rotation handle or keyboard shortcuts
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
  import ToolRuler from '$lib/tags/tool-ruler/tool-ruler.svelte';

  let showRuler = false;
</script>

<ToolRuler visible={showRuler} toolId="ruler" />
```

## Props

- `visible` (boolean): Controls visibility of the tool
- `toolId` (string): Unique identifier for tool coordination (default: 'ruler')

## Based On

This implementation is based on production ruler tool patterns, adapted for the PIE architecture.
