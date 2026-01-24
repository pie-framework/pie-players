# Text-to-Speech Tool (`<pie-tool-text-to-speech>`)

A draggable, floating tool that reads selected text aloud with word-level highlighting for accessibility.

## Features

- ✅ **Text Selection**: Automatically detects selected text on the page
- ✅ **Word Highlighting**: Highlights each word as it's spoken (yellow background + underline)
- ✅ **Speed Control**: Adjustable speech rate from 0.5x (Slow) to 2.0x (Very Fast)
- ✅ **Playback Controls**: Play, Pause/Resume, and Stop buttons
- ✅ **Visual Feedback**: Status indicator shows speaking/paused state
- ✅ **Draggable**: Move the tool anywhere on screen
- ✅ **Accessibility**: Full keyboard support and screen reader compatible

## Usage

### As Web Component

```html
<pie-tool-text-to-speech
  visible="true"
  tool-id="textToSpeech"
></pie-tool-text-to-speech>
```

### As Svelte Component

```svelte
<script>
  import { ToolTextToSpeech } from '$lib/tags/tool-text-to-speech';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';

  let visible = false;
</script>

<ToolTextToSpeech
  {visible}
  toolId="textToSpeech"
  coordinator={toolCoordinator}
/>
```

### Via Tool Toolbar

The TTS tool is automatically included when using `<pie-tool-toolbar>`:

```html
<pie-tool-toolbar tools="protractor,ruler,textToSpeech"></pie-tool-toolbar>
```

## How It Works

1. **Select Text**: User selects any text on the page
2. **Click Play**: Tool reads the selected text aloud
3. **Word Highlighting**: Each word is highlighted with yellow background and underline as it's spoken
4. **Adjust Speed**: Use the slider to change speech rate (0.5x - 2.0x)
5. **Pause/Resume**: Pause and resume playback at any time
6. **Stop**: Stop playback and clear highlights

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `Boolean` | `false` | Show/hide the tool |
| `toolId` | `String` | `'textToSpeech'` | Unique identifier for the tool |
| `coordinator` | `ToolCoordinator` | Required | Tool coordination service |

## TTS Service Integration

The tool uses the shared `TTSService` from `$lib/services/tts`:

```typescript
import { ttsService } from '$lib/services/tts';

// Initialize
await ttsService.initialize();

// Set root element for highlighting
ttsService.setRootElement(containerElement);

// Speak with options
await ttsService.speak(text, {
  rate: 1.0,
  highlightWords: true
}, {
  onEnd: () => { /* cleanup */ },
  onError: (error) => { /* handle error */ }
});
```

## Browser Support

### Text-to-Speech (Web Speech API)
- ✅ Chrome 33+
- ✅ Safari 7+
- ✅ Edge 14+
- ✅ Firefox 49+
- ✅ Mobile: iOS 7+, Android 4.4+
- **Coverage**: 97%+ of users

### Word Highlighting (CSS Custom Highlight API)
- ✅ Chrome 105+
- ✅ Safari 17.2+
- ✅ Edge 105+
- ✅ Firefox 128+
- **Coverage**: 85-90% of users

The tool gracefully degrades: TTS works everywhere, highlighting only on modern browsers.

## Accessibility

- **Screen Reader Compatible**: Uses Web Speech API which doesn't interfere with screen readers
- **Keyboard Navigation**: Tool can be moved with keyboard (when focused)
- **High Contrast**: Works with high contrast mode
- **Reduced Motion**: Respects `prefers-reduced-motion` setting
- **ARIA Labels**: All buttons have proper aria-label attributes

## Speed Presets

| Value | Label | Description |
|-------|-------|-------------|
| 0.5x | Slow | Half speed |
| 0.75x | Slower | 3/4 speed |
| 1.0x | Normal | Default speed |
| 1.25x | Faster | 1.25x speed |
| 1.5x | Fast | 1.5x speed |
| 2.0x | Very Fast | Double speed |

## Visual Design

The tool features:
- **Purple gradient header** (matches other PIE tools)
- **Clean, modern UI** with rounded corners
- **Responsive buttons** with hover/disabled states
- **Status indicators** with animated pulse
- **Color-coded feedback**: Green (speaking), Yellow (paused), Red (error)

## Error Handling

The tool handles these error scenarios:

1. **TTS Not Supported**: Shows error message if browser doesn't support Web Speech API
2. **No Text Selected**: Disables play button until text is selected
3. **Speech Errors**: Shows error message and stops playback
4. **Network Issues**: Gracefully handles offline scenarios (Web Speech API works offline)

## Performance

- **Lightweight**: ~15KB minified
- **No Dependencies**: Uses browser-native APIs
- **Efficient**: Only highlights visible text, no DOM mutation
- **Memory Safe**: Cleans up event listeners on unmount

## Example: Complete Integration

```svelte
<script>
  import { ToolTextToSpeech } from '$lib/tags/tool-text-to-speech';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  import { onMount } from 'svelte';

  let showTTS = false;

  onMount(() => {
    // Register tool
    toolCoordinator.registerTool('textToSpeech', 'Text-to-Speech');
  });

  // Subscribe to tool visibility
  $: {
    const state = toolCoordinator.getToolState('textToSpeech');
    showTTS = state?.isVisible ?? false;
  }
</script>

<!-- Assessment content -->
<div class="question-prompt">
  <p>Read this question carefully and select the best answer.</p>
</div>

<!-- TTS button -->
<button on:click={() => toolCoordinator.toggleTool('textToSpeech')}>
  🔊 Text-to-Speech
</button>

<!-- TTS tool -->
<ToolTextToSpeech
  visible={showTTS}
  toolId="textToSpeech"
  coordinator={toolCoordinator}
/>
```

## Future Enhancements

- [ ] Voice selection (male/female, language)
- [ ] Auto-detect language
- [ ] Save speed preference
- [ ] Read entire page/section
- [ ] Keyboard shortcuts
- [ ] Multiple language support
- [ ] AWS Polly integration (premium voices)

## Related

- [TTSService](../../services/tts/README.md) - Core TTS service
- [Highlight Infrastructure](../../services/highlight/README.md) - Word highlighting system
- [Tool Toolbar](../tool-toolbar/README.md) - Tool management
- [Tool Coordinator](../../tools/README.md) - Tool lifecycle
