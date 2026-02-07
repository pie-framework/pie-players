# @pie-players/pie-tool-tts-inline

Inline TTS (Text-to-Speech) tool component for PIE Players Assessment Toolkit.

## Overview

`pie-tool-tts-inline` is a web component that renders a Material Design speaker icon button for triggering TTS playback. Unlike floating modal tools, this component renders inline at its natural position in the DOM (typically in headers).

## Features

- Material Design speaker icon (🔊)
- Registers with `ToolCoordinator` for lifecycle management
- Integrates with `TTSService` for QTI 3.0 catalog-based TTS
- Size variants: `sm`, `md`, `lg`
- Visual feedback during speaking (pulse animation)
- Full accessibility support (ARIA labels, keyboard navigation)
- Coordinator-controlled visibility via CSS `display` property

## Installation

```bash
bun add @pie-players/pie-tool-tts-inline
```

## Usage

```javascript
import '@pie-players/pie-tool-tts-inline';
import { TTSService, BrowserTTSProvider, ToolCoordinator } from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());
const toolCoordinator = new ToolCoordinator();

// Create element
const ttsButton = document.createElement('pie-tool-tts-inline');
ttsButton.setAttribute('tool-id', 'tts-passage-1');
ttsButton.setAttribute('catalog-id', 'passage-1');
ttsButton.setAttribute('size', 'md');

// Bind services as JavaScript properties (not HTML attributes)
ttsButton.ttsService = ttsService;
ttsButton.coordinator = toolCoordinator;

// Coordinator controls visibility
toolCoordinator.showTool('tts-passage-1');
```

### With Svelte

```svelte
<script>
  import '@pie-players/pie-tool-tts-inline';
  import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

  let ttsToolElement;

  $effect(() => {
    if (ttsToolElement && toolCoordinator) {
      ttsToolElement.ttsService = ttsService;
      ttsToolElement.coordinator = toolCoordinator;

      if (ttsService) {
        toolCoordinator.showTool('tts-passage-1');
      }
    }
  });
</script>

<div class="header">
  <h3>Passage Title</h3>
  <pie-tool-tts-inline
    bind:this={ttsToolElement}
    tool-id="tts-passage-1"
    catalog-id="passage-1"
    size="md"
  ></pie-tool-tts-inline>
</div>
```

## Props

### HTML Attributes

- `tool-id` - Unique identifier for tool registration (default: `'tts-inline'`)
- `catalog-id` - QTI 3.0 accessibility catalog ID for SSML lookup (default: `''`)
- `language` - Language code for TTS (default: `'en-US'`)
- `size` - Icon size: `'sm'` (1.5rem), `'md'` (2rem), or `'lg'` (2.5rem) (default: `'md'`)

### JavaScript Properties

- `ttsService` - ITTSService instance (required)
- `coordinator` - IToolCoordinator instance (optional, for visibility management)

## Behavior

1. **Tool Registration**: Registers with ToolCoordinator on mount using the provided `tool-id`
2. **Text Extraction**: Finds nearest `.passage-content` or `.item-content` container
3. **TTS Trigger**: Calls `ttsService.speak(text, { catalogId, language })`
4. **Catalog Resolution**: TTSService checks for pre-authored SSML in accessibility catalogs
5. **Visual Feedback**: Pulse animation while speaking, disabled state
6. **Cleanup**: Unregisters from coordinator on unmount

## Styling

The component uses inline styles and doesn't require external CSS. The button is transparent by default with hover effects:

- **Normal**: Gray icon, transparent background
- **Hover**: Purple icon, light gray background
- **Speaking**: Purple icon, blue tinted background with pulse animation
- **Disabled**: Reduced opacity, no pointer

## Architecture

This tool follows the PIE Assessment Toolkit tool pattern:

- Always rendered in DOM at natural position
- ToolCoordinator controls visibility via `showTool()`/`hideTool()` (CSS `display` property)
- Registers with `ZIndexLayer.TOOL` for proper layering
- Services passed as JavaScript properties (objects can't be HTML attributes)

## Example

See the complete working demo at `packages/section-player/demos/tts-integration-demo.html`.

## License

MIT
