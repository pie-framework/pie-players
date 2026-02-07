# TTS Integration Implementation

**Date:** January 2026
**Status:** ✅ Complete

## Overview

The PIE Section Player now fully integrates with the Assessment Toolkit's service architecture, enabling TTS (Text-to-Speech), tool coordination, and highlighting capabilities.

## Implementation Summary

### 1. Service Props Added

Services are passed as JavaScript properties (not HTML attributes) through the component hierarchy:

**Modified Files:**
- `packages/section-player/src/PieSectionPlayer.svelte` - Added service props
- `packages/section-player/src/components/PageModeLayout.svelte` - Pass services to renderers
- `packages/section-player/src/components/ItemModeLayout.svelte` - Pass services to renderers
- `packages/section-player/src/components/PassageRenderer.svelte` - Accept and bind services
- `packages/section-player/src/components/ItemRenderer.svelte` - Accept and bind services
- `packages/esm-player/src/PieEsmPlayer.svelte` - Added service props, pass to PieItemPlayer
- `packages/players-shared/src/components/PieItemPlayer.svelte` - Accept services (final destination)

### 2. Service Flow

```
AssessmentPlayer (creates services)
  ↓ JavaScript properties
PieSectionPlayer
  ↓ Svelte props
PageModeLayout / ItemModeLayout
  ↓ Svelte props
PassageRenderer / ItemRenderer
  ↓ JavaScript properties
pie-esm-player (web component)
  ↓ Svelte props
PieItemPlayer (shared component)
  ↓ Available to PIE elements
```

### 3. Services Supported

- **TTSService**: Text-to-speech with word highlighting
- **ToolCoordinator**: Z-index management for floating tools
- **HighlightCoordinator**: CSS Custom Highlight API integration

### 4. Backward Compatibility

✅ All changes are backward compatible:
- Services are optional (default to `null`)
- Existing API signatures unchanged
- No breaking changes to props/attributes
- Components work without services

## Usage

### Basic TTS Integration

```javascript
import { TTSService, BrowserTTSProvider } from '@pie-players/pie-assessment-toolkit';

// Initialize TTS
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());

// Pass to section player
const player = document.getElementById('player');
player.ttsService = ttsService;
```

### Full Toolkit Integration

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize all services
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();

await ttsService.initialize(new BrowserTTSProvider());

// Pass all services
player.ttsService = ttsService;
player.toolCoordinator = toolCoordinator;
player.highlightCoordinator = highlightCoordinator;
```

## Demo

A complete working demo is available at:
- **File:** `packages/section-player/demos/tts-integration-demo.html`
- **Features:**
  - Mock TTS service integration
  - Service passing demonstration
  - Both page and item modes
  - Event logging
  - Interactive TTS testing

## Documentation

Updated documentation includes:
- `packages/section-player/README.md` - Added "Assessment Toolkit Integration" section
- `packages/section-player/demos/index.html` - Added TTS demo to list
- This file (`TTS-INTEGRATION.md`) - Implementation summary

## TTS Inline Tool Rendering

✅ **IMPLEMENTED:** The section player now includes inline TTS tool icons in passage and item headers!

The section player uses `pie-tool-tts-inline` - a toolkit tool component that renders inline in passage and item headers.

### Architecture

- **Tool Component**: `@pie-players/pie-tool-tts-inline`
- **Registration**: Registers with `ToolCoordinator` on mount
- **Rendering**: Inline (no floating/modal behavior)
- **Service Binding**: TTSService passed as JavaScript property
- **Visibility Control**: ToolCoordinator's `showTool()`/`hideTool()` manages visibility

### Usage Pattern

```svelte
<!-- Always rendered in DOM, coordinator controls visibility -->
<pie-tool-tts-inline
  bind:this={ttsToolElement}
  tool-id="tts-passage-123"
  catalog-id="passage-solar-system"
  language="en-US"
  size="md"
></pie-tool-tts-inline>

<script>
  // Bind services and register with coordinator
  $effect(() => {
    if (ttsToolElement) {
      // Set services as JS properties (can't be HTML attributes)
      if (ttsService) {
        ttsToolElement.ttsService = ttsService;
      }
      if (toolCoordinator) {
        ttsToolElement.coordinator = toolCoordinator;

        // Coordinator controls visibility via CSS
        if (ttsService) {
          toolCoordinator.showTool('tts-passage-123');
        } else {
          toolCoordinator.hideTool('tts-passage-123');
        }
      }
    }
  });
</script>
```

### Catalog Resolution

1. User clicks TTS icon in passage/item header
2. Tool extracts text from nearest `.passage-content` or `.item-content`
3. TTSService.speak() called with `catalogId` from tool prop
4. AccessibilityCatalogResolver checks for SSML content
5. If found: speaks pre-authored SSML, else: plain text fallback

### Visual Design

- Material Design speaker icon (🔊)
- Size variants: `sm` (1.5rem), `md` (2rem), `lg` (2.5rem)
- Hover: light background
- Speaking: blue tint with pulse animation
- Accessible: aria-label, aria-pressed, keyboard support

### Visibility Control

- Tool is always rendered in the DOM at its natural position (in header)
- Initially may be hidden with `display: none`
- ToolCoordinator's `showTool()` sets `display: ""` (visible)
- ToolCoordinator's `hideTool()` sets `display: none` (hidden)
- Same pattern as floating tools, just different rendering location

### For AssessmentPlayer Integration

When integrating with AssessmentPlayer:

```typescript
class AssessmentPlayer {
  private ttsService: TTSService;
  private toolCoordinator: ToolCoordinator;
  private highlightCoordinator: HighlightCoordinator;

  // Pass services to section player
  renderSection(section: QtiAssessmentSection) {
    const sectionPlayer = document.createElement('pie-section-player');
    sectionPlayer.section = section;

    // Pass services
    sectionPlayer.ttsService = this.ttsService;
    sectionPlayer.toolCoordinator = this.toolCoordinator;
    sectionPlayer.highlightCoordinator = this.highlightCoordinator;

    return sectionPlayer;
  }
}
```

## Build Verification

✅ Builds successful:
- `packages/section-player` - Build completed (102.07 kB)
- `packages/esm-player` - Build completed (2,551.04 kB)
- No TypeScript errors
- No breaking changes

## Testing Checklist

- [x] Services pass through component hierarchy
- [x] Backward compatibility maintained (no services = works normally)
- [x] Demo created and documented
- [x] README updated with usage examples
- [x] Build verification completed
- [ ] Live testing with real TTSService from assessment-toolkit
- [ ] Verify TTS icons appear when using real implementation
- [ ] Test with QTI 3.0 accessibility catalogs

## Technical Notes

### Why JavaScript Properties?

Services cannot be HTML attributes because:
1. HTML attributes must be strings
2. Services are complex objects with methods
3. Cannot serialize/deserialize service instances
4. Property passing preserves object references

### Custom Element Definition

```typescript
<svelte:options
  customElement={{
    props: {
      // Services defined with reflect: false
      ttsService: { type: 'Object', reflect: false },
      toolCoordinator: { type: 'Object', reflect: false },
      highlightCoordinator: { type: 'Object', reflect: false }
    }
  }}
/>
```

The `reflect: false` ensures these don't attempt to sync with HTML attributes.

## References

- [TTS Architecture](../../docs/tts-architecture.md)
- [Accessibility Catalogs Integration](../../docs/accessibility-catalogs-integration-guide.md)
- [Assessment Toolkit README](../assessment-toolkit/README.md)
- [QTI 3.0 Feature Support](../../docs/qti-3.0-feature-support.md)
