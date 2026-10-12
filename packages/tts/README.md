# @pie-players/pie-tts

The interfaces and types a text-to-speech (TTS) provider implements for the PIE
assessment toolkit. It is for authors of a custom provider. The package is pure
TypeScript with no dependencies and no UI framework.

For the runtime flow from toolbar button to highlighted word, see the
[TTS deep dive](../../docs/accessibility/tts-deep-dive.md); for how the TTS
packages layer, see [TTS Architecture](../../docs/accessibility/tts-architecture.md).

## What's Included

### Interfaces

- **`ITTSProvider`** - Stateless factory for creating TTS implementations
- **`ITTSProviderImplementation`** - Actual TTS playback implementation
- **`TTSProviderCapabilities`** - Feature support description
- **`TTSConfig`** - Provider configuration

### Types

- **`TTSPlaybackStart`** - What a provider knows about one playback when it starts
- **`TTSSpeechSegment`** - Pre-segmented speech unit with global offsets
- **`TTSProviderOptions`** - Provider options the toolkit sets; a provider's own options extend them
- **`SpeedRateBucket`** - The `slow` / `medium` / `fast` vocabulary a server transport sends in place of a numeric rate

## Installation

```bash
npm install @pie-players/pie-tts
# or
bun add @pie-players/pie-tts
```

## Usage

### Implementing a Custom TTS Provider

```typescript
import type {
  ITTSProvider,
  ITTSProviderImplementation,
  TTSConfig,
  TTSProviderCapabilities,
} from '@pie-players/pie-tts';

class MyTTSImplementation implements ITTSProviderImplementation {
  onPlaybackStart?: () => void;

  constructor(private readonly config: TTSConfig) {}

  async speak(text: string): Promise<void> {
    await myEngine.speak(text, {
      onStart: () => this.onPlaybackStart?.(),
    });
  }

  pause(): void { /* ... */ }
  resume(): void { /* ... */ }
  stop(): void { /* ... */ }
  updateSettings(settings: Partial<TTSConfig>): void { /* ... */ }
}

export class MyTTSProvider implements ITTSProvider {
  readonly providerId = 'my-tts';

  async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
    return new MyTTSImplementation(config);
  }

  getCapabilities(): TTSProviderCapabilities {
    return {
      supportsWordBoundary: false,
    };
  }

  destroy(): void {
    // Cleanup if needed
  }
}
```

`onPlaybackStart` is optional, but a provider that exposes it must call it from
the native or media playback-start event, never when speech is merely queued.
The toolkit uses that signal to move into playing state and to begin
highlighting once output has started. A provider whose word boundaries depend on
the response passes `{ wordBoundaries }` (`TTSPlaybackStart`): with `false`, the
toolkit highlights the sentence being read, word highlight mode included.

`updateSettings` is required: the toolkit sends rate, pitch and voice changes
through it, and each read's content language
([TTS language](../../docs/architecture/internationalization.md#tts-language)). A
`pause()` that lands before a speak's audio starts holds it until `resume()`.

A provider declaring `maxTextLength` in its capabilities never receives longer
text: the toolkit splits it at sentences, then words, then characters, and keeps
word highlights on the visible text.

## Official Implementations

- **Browser TTS** (`BrowserTTSProvider` in `@pie-players/pie-assessment-toolkit`) - Web Speech API voices. The toolkit falls back to it when a server provider fails to start; it fails to initialize in a browser without the Speech Synthesis API.
- **Server TTS** (`@pie-players/tts-client-server`) - Server-synthesized voices (Polly, Google Cloud, a custom transport) with speech marks

## Related Packages

- [@pie-players/pie-assessment-toolkit](../assessment-toolkit) - Includes TTSService and BrowserTTSProvider
- [@pie-players/tts-client-server](../tts-client-server) - Server-backed TTS provider client

## License

MIT
