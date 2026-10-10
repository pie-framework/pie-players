# @pie-players/pie-tts

TTS interfaces and types for PIE Assessment Toolkit - Pure TypeScript with no UI dependencies.

For the cross-package TTS architecture, provider layering, and server/client
runtime flow, see [TTS Architecture](../../docs/accessibility/tts-architecture.md).

## Purpose

This package provides the foundational interfaces and types for building TTS (Text-to-Speech) providers in the PIE ecosystem. It has **zero dependencies** and no UI framework requirements, making it suitable for:

- Implementing custom TTS providers
- Type-safe TTS integration
- Framework-agnostic TTS solutions

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

- **Browser TTS** (in `@pie-players/pie-assessment-toolkit`) - Uses Web Speech API, always available as fallback
- **Server TTS** (`@pie-players/tts-client-server`) - High-quality server-backed voices (Polly/Google/etc.) with speech marks

## License

MIT

## Related Packages

- [@pie-players/pie-assessment-toolkit](../assessment-toolkit) - Includes TTSService and BrowserTTSProvider
- [@pie-players/tts-client-server](../tts-client-server) - Server-backed TTS provider client
