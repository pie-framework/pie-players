# Text-to-Speech Tool (`<pie-tool-text-to-speech>`)

A draggable, floating tool that reads selected text aloud with word-level highlighting for accessibility.

For the shared TTS architecture and provider model, see
[TTS Architecture](../../docs/accessibility/tts-architecture.md). This README
focuses on the floating tool custom element API.

## Features

- **Text Selection**: Detects selected text on the page
- **Word Highlighting**: Highlights each word as it is spoken, when the service has a highlight coordinator
- **Speed Control**: Sets the service's speech rate from 0.5x (Slow) to 2.0x (Very Fast)
- **Playback Controls**: Play, Pause/Resume, and Stop buttons
- **Visual Feedback**: Status indicator shows speaking/paused state
- **Draggable**: Move the tool anywhere on screen
- **Accessibility**: Full keyboard support and screen reader compatible

## Usage

The element reads with the host's TTS service. The service arrives initialized:
the element never calls `initialize`, so the provider, voice and highlighting
the host configured stay as they are. Under `<pie-assessment-toolkit>` that
service is the toolkit coordinator's `ttsService`, which
`toolkitCoordinator.ensureTTSReady()` initializes from the `textToSpeech` tool
configuration.

### As Web Component

With a `coordinator`, the coordinator displays the panel only while `toolId` is
visible there, so the host shows the tool through the coordinator and binds
`visible` to it:

```html
<pie-tool-text-to-speech tool-id="textToSpeech"></pie-tool-text-to-speech>

<script type="module">
  import '@pie-players/pie-tool-text-to-speech';

  // toolkitCoordinator: the ToolkitCoordinator passed to <pie-assessment-toolkit>
  await toolkitCoordinator.ensureTTSReady();
  const tools = toolkitCoordinator.toolCoordinator;
  tools.registerTool('textToSpeech', 'Text-to-Speech');

  const tts = document.querySelector('pie-tool-text-to-speech');
  tts.ttsService = toolkitCoordinator.ttsService;
  tts.coordinator = tools;
  tools.subscribe(() => {
    tts.visible = tools.isToolVisible('textToSpeech');
  });
  tools.showTool('textToSpeech');
</script>
```

### Standalone

Without a `coordinator`, `visible` alone controls the panel, and the close
button and Escape do nothing, so the host closes the panel through `visible`:

```svelte
<script>
  import '@pie-players/pie-tool-text-to-speech';
  import { BrowserTTSProvider, TTSService } from '@pie-players/pie-assessment-toolkit';

  const ttsService = new TTSService();
  const ready = ttsService.initialize(new BrowserTTSProvider());
  let visible = $state(false);
</script>

{#await ready then}
  <pie-tool-text-to-speech {visible} toolId="textToSpeech" {ttsService} />
{/await}
```

### Toolkit Toolbars

The packaged `textToSpeech` capability in `@pie-players/pie-default-tool-loaders`
mounts `<pie-tool-tts-inline>` from `@pie-players/pie-tool-tts-inline` in item
and passage toolbars. A host that wants this floating panel mounts it itself.

## How It Works

1. **Select Text**: User selects any text on the page
2. **Click Play**: The tool calls `ttsService.speak(selection, { catalogId, contentElement })`, where `contentElement` is the element holding the selection and `catalogId` is the nearest docked catalog with spoken content
3. **Word Highlighting**: The service highlights each word inside `contentElement` as it is spoken
4. **Adjust Speed**: The slider calls `ttsService.setPlaybackRate`, which changes the rate for every reader of that service
5. **Pause/Resume**: Pause and resume playback at any time
6. **Stop**: Stop playback and clear highlights

Play stays disabled while speech is in progress and re-enables when the promise
`speak` returns settles. A rejected `speak` shows its message above the
controls. Removing the element stops playback only when this panel started it.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `Boolean` | `false` | Show/hide the tool |
| `toolId` | `String` | `'textToSpeech'` | Unique identifier for the tool |
| `ttsService` | `TtsServiceApi` | unset | Initialized TTS service the tool reads with; the panel shows a loading message until it is set |
| `coordinator` | `ToolCoordinatorApi` | unset | Tool coordinator for registration, z-order and closing |

`ttsService` and `coordinator` are JavaScript properties. The element registers
`toolId` with `coordinator` on `ZIndexLayer.MODAL`, brings the panel to the
front when it is pressed or dragged, and hides `toolId` there from the close
button and Escape.

## TTS Service Integration

`ttsService` takes a `TtsServiceApi`, such as `TTSService` from
`@pie-players/pie-assessment-toolkit`. The element calls `speak`, `pause`,
`resume`, `stop` and `setPlaybackRate`, and `hasSpokenAlternate` when the
service provides it. A host building its own service initializes it before
passing it:

```typescript
import {
  BrowserTTSProvider,
  HighlightCoordinator,
  TTSService,
} from '@pie-players/pie-assessment-toolkit';

const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());

// Word highlighting needs a highlight coordinator
ttsService.setHighlightCoordinator(new HighlightCoordinator());
```

## Browser Support

Speech support is the provider's. With `BrowserTTSProvider`:

### Text-to-Speech (Web Speech API)
- Chrome 33+
- Safari 7+
- Edge 14+
- Firefox 49+
- Mobile: iOS 7+, Android 4.4+

### Word Highlighting (CSS Custom Highlight API)
- Chrome 105+
- Safari 17.2+
- Edge 105+
- Firefox 128+

Speech works without highlighting on browsers that lack the Custom Highlight API.

## Accessibility

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

1. **No Service**: Shows a loading message until `ttsService` is set
2. **No Text Selected**: Disables play button until text is selected
3. **Speech Errors**: Shows the error from `speak` and resets the controls

## Performance

- **Dependencies**: Imports `@pie-players/pie-assessment-toolkit` and
  `@pie-players/pie-players-shared`, which stay external to its bundle
- **Memory Safe**: Removes its selection listener and coordinator registration on unmount

## Example: Complete Integration

```svelte
<script>
  import '@pie-players/pie-tool-text-to-speech';

  // toolkitCoordinator: the ToolkitCoordinator passed to <pie-assessment-toolkit>
  let { toolkitCoordinator } = $props();
  const toolCoordinator = toolkitCoordinator.toolCoordinator;
  const ready = toolkitCoordinator.ensureTTSReady();
  toolCoordinator.registerTool('textToSpeech', 'Text-to-Speech');

  let showTTS = $state(false);

  $effect(() =>
    toolCoordinator.subscribe(() => {
      showTTS = toolCoordinator.isToolVisible('textToSpeech');
    })
  );
</script>

<!-- Assessment content -->
<div class="question-prompt">
  <p>Read this question carefully and select the best answer.</p>
</div>

<!-- TTS button -->
<button onclick={() => toolCoordinator.toggleTool('textToSpeech')}>
  Text-to-Speech
</button>

<!-- TTS tool -->
{#await ready then}
  <pie-tool-text-to-speech
    visible={showTTS}
    toolId="textToSpeech"
    ttsService={toolkitCoordinator.ttsService}
    coordinator={toolCoordinator}
  />
{/await}
```

## Future Enhancements

- [ ] Voice selection (male/female, language)
- [ ] Auto-detect language
- [ ] Save speed preference
- [ ] Read entire page/section
- [ ] Keyboard shortcuts
- [ ] Multiple language support
- [x] AWS Polly integration (premium voices) — available via `@pie-players/tts-server-polly`

## Related

- [TTS Architecture](../../docs/accessibility/tts-architecture.md) - TTS system overview
- [TTS Server Polly](../tts-server-polly/README.md) - AWS Polly server provider
- [TTS Client Server](../tts-client-server/README.md) - Server-backed client provider
- [Assessment Toolkit](../assessment-toolkit/README.md) - Toolbar and tool management
