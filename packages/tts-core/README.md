# @pie-players/pie-tts-core

Core TTS interfaces and types for PIE Assessment Toolkit - Pure TypeScript with no UI dependencies.

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

- **`TTSFeature`** - Union type of supported features
- Configuration and capability types

## Installation

```bash
npm install @pie-players/pie-tts-core
# or
bun add @pie-players/pie-tts-core
```

## Usage

### Implementing a Custom TTS Provider

```typescript
import type {
  ITTSProvider,
  ITTSProviderImplementation,
  TTSConfig,
  TTSProviderCapabilities,
  TTSFeature
} from '@pie-players/pie-tts-core';

class MyTTSImplementation implements ITTSProviderImplementation {
  async speak(text: string): Promise<void> {
    // Your implementation
  }

  pause(): void { /* ... */ }
  resume(): void { /* ... */ }
  stop(): void { /* ... */ }
  isPlaying(): boolean { return false; }
  isPaused(): boolean { return false; }
}

export class MyTTSProvider implements ITTSProvider {
  readonly providerId = 'my-tts';
  readonly providerName = 'My TTS Provider';
  readonly version = '1.0.0';

  async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
    return new MyTTSImplementation(config);
  }

  supportsFeature(feature: TTSFeature): boolean {
    return feature === 'pause' || feature === 'resume';
  }

  getCapabilities(): TTSProviderCapabilities {
    return {
      supportsPause: true,
      supportsResume: true,
      supportsWordBoundary: false,
      supportsVoiceSelection: true,
      supportsRateControl: true,
      supportsPitchControl: false,
    };
  }

  destroy(): void {
    // Cleanup if needed
  }
}
```

## Official Implementations

- **Browser TTS** (in `@pie-players/pie-assessment-toolkit`) - Uses Web Speech API, always available as fallback
- **AWS Polly** (`@pie-players/pie-tts-polly`) - High-quality neural voices with full SSML support

## Design Philosophy

This core package intentionally:
- ✅ Has **zero runtime dependencies**
- ✅ Contains **only TypeScript interfaces and types**
- ✅ Is **framework-agnostic** (no React, Svelte, Vue, etc.)
- ✅ Supports **pluggable architecture**
- ✅ Enables **type-safe TTS implementations**

## License

MIT

## Related Packages

- [@pie-players/pie-assessment-toolkit](../assessment-toolkit) - Includes TTSService and BrowserTTSProvider
- [@pie-players/pie-tts-polly](../tts-polly) - AWS Polly TTS provider
