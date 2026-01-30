# TTS Architecture

## Overview

The PIE Players TTS (Text-to-Speech) system uses a clean, layered architecture with pluggable providers and zero UI framework dependencies in the core.

## Package Structure

### 1. @pie-players/pie-tts

**Purpose:** Core TTS interfaces and types - Pure TypeScript with **zero dependencies**.

**Contains:**
- `ITTSProvider` - Provider factory interface
- `ITTSProviderImplementation` - Playback implementation interface
- `TTSProviderCapabilities` - Feature support descriptor
- `TTSConfig` - Configuration types
- `TTSFeature` - Feature union types

**Dependencies:** None

**Use Case:**
- Building custom TTS providers
- Type-safe TTS integration
- Framework-agnostic implementations

### 2. @pie-players/pie-assessment-toolkit

**Purpose:** Assessment runtime with built-in browser TTS fallback.

**Contains:**
- `TTSService` - Main TTS service with state management
- `BrowserTTSProvider` - Web Speech API implementation (always available)
- Accessibility catalog integration
- Playback state management

**Dependencies:**
- `@pie-players/pie-tts` (for interfaces)
- `@pie-players/pie-players-shared` (for UI components, i18n)

**TTS Features:**
- Re-exports all types from `tts` for convenience
- Includes `BrowserTTSProvider` as the default, always-available fallback
- Integrates with QTI 3.0 accessibility catalogs
- Coordinates with HighlightCoordinator for word highlighting

### 3. @pie-players/pie-tts-polly

**Purpose:** Optional AWS Polly TTS provider for high-quality neural voices.

**Contains:**
- `PollyTTSProvider` - AWS Polly implementation
- Full SSML support
- Neural voice support
- Streaming audio playback

**Dependencies:**
- `@pie-players/pie-tts` (for interfaces)
- `@aws-sdk/client-polly` (AWS SDK)

**Use Case:** Production assessments requiring high-quality, consistent TTS with full SSML support.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  @pie-players/pie-tts                              │
│  (Pure TypeScript interfaces - no dependencies)         │
│                                                           │
│  - ITTSProvider                                          │
│  - ITTSProviderImplementation                           │
│  - TTSProviderCapabilities                              │
│  - TTSConfig                                             │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ depends on
          ┌────────────────┴────────────────┐
          │                                  │
┌─────────┴─────────────────┐  ┌────────────┴───────────────┐
│ assessment-toolkit        │  │ @pie-players/pie-tts-polly │
│                           │  │                             │
│ - TTSService              │  │ - PollyTTSProvider          │
│ - BrowserTTSProvider      │  │ - AWS Polly integration     │
│   (built-in fallback)     │  │ - Neural voices             │
│ - Catalog integration     │  │ - Full SSML                 │
│ - State management        │  │                             │
└───────────────────────────┘  └─────────────────────────────┘
          │                                  │
          └────────────────┬─────────────────┘
                           ▼
                    Application Code
```

## Fallback Strategy

The assessment toolkit **always includes** `BrowserTTSProvider` as a built-in fallback. This ensures TTS functionality is always available, even if optional providers fail.

### Recommended Pattern

```typescript
import { TTSService, BrowserTTSProvider } from '@pie-players/pie-assessment-toolkit';
import { PollyTTSProvider } from '@pie-players/pie-tts-polly';

const ttsService = new TTSService();

try {
  // Try to initialize Polly (preferred)
  await ttsService.initialize(new PollyTTSProvider({
    region: 'us-east-1',
    credentials: { /* ... */ }
  }));
  console.log('Using AWS Polly TTS');
} catch (error) {
  // Fallback to browser TTS
  console.warn('Polly unavailable, falling back to browser TTS', error);
  await ttsService.initialize(new BrowserTTSProvider());
}
```

## Design Principles

### 1. **No UI Dependencies in Core**
The `tts` package has **zero dependencies** and no UI framework requirements. This ensures:
- Framework-agnostic implementations
- Minimal bundle size
- Easy testing
- Reusability across different contexts

### 2. **Pluggable Architecture**
All TTS providers implement the same interfaces, allowing:
- Runtime provider switching
- Graceful fallbacks
- Custom provider implementations
- A/B testing different providers

### 3. **Always-Available Fallback**
Browser TTS is built into the toolkit, ensuring:
- TTS always works (no network required)
- Offline capability
- Zero additional configuration
- Immediate availability during development

### 4. **Optional High-Quality Providers**
Premium providers like Polly are separate packages:
- Pay for what you use (cost consideration)
- Smaller bundles for basic use cases
- Easy to add/remove based on requirements
- Independent versioning and updates

## Provider Comparison

| Feature | Browser TTS | AWS Polly |
|---------|-------------|-----------|
| **Voice Quality** | ⭐⭐⭐ Synthetic | ⭐⭐⭐⭐⭐ Neural |
| **SSML Support** | ⚠️ Limited/None | ✅ Full |
| **Cost** | ✅ Free | 💰 $16/1M chars |
| **Offline** | ✅ Works offline | ❌ Requires internet |
| **Latency** | ~50-100ms | ~200-500ms |
| **Consistency** | ⚠️ Varies by OS | ✅ Same everywhere |
| **Bundle Size** | 0 KB (built-in) | ~50 KB (+ AWS SDK) |
| **Configuration** | None required | AWS credentials |

## Creating Custom Providers

To create a custom TTS provider:

1. Install `@pie-players/pie-tts`
2. Implement `ITTSProvider` and `ITTSProviderImplementation`
3. Publish as a separate package

Example:

```typescript
import type {
  ITTSProvider,
  ITTSProviderImplementation,
  TTSConfig,
  TTSProviderCapabilities,
  TTSFeature
} from '@pie-players/pie-tts';

class MyTTSImpl implements ITTSProviderImplementation {
  async speak(text: string): Promise<void> { /* ... */ }
  pause(): void { /* ... */ }
  resume(): void { /* ... */ }
  stop(): void { /* ... */ }
  isPlaying(): boolean { return false; }
  isPaused(): boolean { return false; }
}

export class MyTTSProvider implements ITTSProvider {
  readonly providerId = 'my-custom-tts';
  readonly providerName = 'My Custom TTS';
  readonly version = '1.0.0';

  async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
    return new MyTTSImpl(config);
  }

  supportsFeature(feature: TTSFeature): boolean { /* ... */ }
  getCapabilities(): TTSProviderCapabilities { /* ... */ }
  destroy(): void { /* ... */ }
}
```

## QTI 3.0 Integration

The TTS system integrates seamlessly with QTI 3.0 accessibility catalogs:

```typescript
import {
  TTSService,
  AccessibilityCatalogResolver
} from '@pie-players/pie-assessment-toolkit';

const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US'
);

ttsService.setCatalogResolver(catalogResolver);

// Uses pre-authored SSML from catalog if available,
// falls back to generated TTS
await ttsService.speak("Welcome message", {
  catalogId: 'welcome-message',
  language: 'en-US'
});
```

## Future Providers

Potential additional TTS providers:

- **@pie-players/pie-tts-azure** - Azure Cognitive Services TTS
- **@pie-players/pie-tts-google** - Google Cloud Text-to-Speech
- **@pie-players/pie-tts-elevenlabs** - ElevenLabs high-fidelity voices
- **@pie-players/pie-tts-local** - Local TTS engines (Piper, Coqui)

All would depend only on `@pie-players/pie-tts`.

## Summary

- **tts**: Pure interfaces, zero dependencies
- **assessment-toolkit**: Built-in browser TTS fallback + services
- **tts-polly**: Optional high-quality provider
- **Pattern**: Try premium provider, fallback to browser TTS
- **Benefit**: Always-working TTS with optional quality upgrades
