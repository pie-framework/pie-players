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
- `AccessibilityCatalogResolver` - QTI 3.0 catalog management
- `SSMLExtractor` - Automatic SSML extraction and catalog generation
- Playback state management

**Dependencies:**
- `@pie-players/pie-tts` (for interfaces)
- `@pie-players/pie-players-shared` (for UI components, i18n)

**TTS Features:**
- Re-exports all types from `tts` for convenience
- Includes `BrowserTTSProvider` as the default, always-available fallback
- Integrates with QTI 3.0 accessibility catalogs
- **Automatic SSML extraction** from embedded `<speak>` tags
- Coordinates with HighlightCoordinator for word highlighting

### 3. Server-Side TTS Architecture (New)

The new architecture splits TTS into server-side and client-side components for better security and reliability.

#### Server-Side Packages (Node.js)

**@pie-players/tts-server-core**
- Core interfaces for server-side providers
- Speech marks utilities and types
- Caching interface
- Base provider class

**@pie-players/tts-server-polly**
- AWS Polly implementation for Node.js
- Native speech marks support (millisecond-precise)
- Parallel audio + marks requests
- Full SSML support

#### Client-Side Package (Browser)

**@pie-players/tts-client-server**
- Calls server API for synthesis
- Receives audio + speech marks
- 50ms polling-based highlighting
- HTMLAudioElement playback

#### Integration

SvelteKit API routes connect the pieces:
```
Browser → ServerTTSProvider → /api/tts/synthesize → PollyServerProvider → AWS Polly
```

### 4. Server-Side TTS Providers (Recommended)

**For production deployments**, use the new server-side architecture with speech marks support:

**@pie-players/tts-client-server** (Client package)

- Calls server API for TTS synthesis
- Receives audio + speech marks
- Supports word-level highlighting via speech marks
- 50ms polling-based synchronization

**@pie-players/tts-server-polly** (Server package)

- AWS Polly implementation for Node.js
- Native speech marks support (millisecond-precise)
- Parallel audio + marks requests
- Full SSML support
- Secure credential management

**Integration:** SvelteKit API routes connect browser client to server-side provider

```
Browser → ServerTTSProvider → /api/tts/synthesize → PollyServerProvider → AWS Polly
```

See [Server-Side TTS Integration Guide](../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) for setup instructions.

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
import { ServerTTSProvider } from '@pie-players/tts-client-server';

const ttsService = new TTSService();

try {
  // Try to initialize server-side TTS (preferred for production)
  await ttsService.initialize(new ServerTTSProvider({
    apiEndpoint: '/api/tts',
    provider: 'polly',
    voice: 'Joanna',
  }));
  console.log('Using server-side TTS with speech marks');
} catch (error) {
  // Fallback to browser TTS
  console.warn('Server TTS unavailable, falling back to browser TTS', error);
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

| Feature | Browser TTS | Server TTS (Polly) |
| ------- | ----------- | ------------------ |
| **Voice Quality** | ⭐⭐⭐ Synthetic | ⭐⭐⭐⭐⭐ Neural |
| **Word Highlighting** | ⚠️ Unreliable | ✅ Millisecond-precise |
| **SSML Support** | ⚠️ Limited/None | ✅ Full |
| **Cost** | ✅ Free | 💰 $16/1M chars |
| **Offline** | ✅ Works offline | ❌ Requires internet |
| **Latency** | ~50-100ms | ~200-500ms |
| **Consistency** | ⚠️ Varies by OS | ✅ Same everywhere |
| **Bundle Size** | 0 KB (built-in) | ~20 KB (client) |
| **Configuration** | None required | Server endpoint |
| **Security** | N/A | ✅ Credentials on server |

## Word Highlighting Architecture

### Critical Implementation Details

**IMPORTANT:** Word highlighting requires precise text alignment between:
1. The text sent to TTS (spoken text)
2. The text in the DOM (visual text)
3. The speech marks returned by the provider

#### Text Normalization Requirements

All three texts MUST be normalized identically:

```typescript
const normalizedText = rawText.trim().replace(/\s+/g, ' ');
```

This normalization:

- Removes leading/trailing whitespace
- Collapses multiple spaces/tabs/newlines into single spaces
- Ensures character positions align between spoken text and DOM

#### Why Normalization is Critical

JSON content often contains formatting whitespace:

```json
{
  "prompt": "Based on the passage,\n                \n\n       which method..."
}
```

Without normalization:
- **Spoken text**: 100 chars (normalized by TTS provider)
- **DOM text**: 150 chars (includes whitespace)
- **Result**: Speech marks at position 50 highlight wrong word

With normalization:
- **Spoken text**: 100 chars (normalized)
- **DOM text**: 100 chars (normalized)
- **Result**: Speech marks align perfectly

#### Implementation in TTSService

The `TTSService.buildPositionMap()` method:

1. Takes the spoken text (already normalized)
2. Extracts DOM text with `range.toString()`
3. Normalizes DOM text the same way
4. Builds a character-by-character map: `normalized position → {text node, offset}`
5. Handles whitespace collapsing during mapping

#### Implementation in TTS Tools

TTS tools MUST normalize text before calling `speak()`:

```typescript
// ✅ CORRECT
const range = document.createRange();
range.selectNodeContents(targetContainer);
const rawText = range.toString();
const normalizedText = rawText.trim().replace(/\s+/g, ' ');

await ttsService.speak(normalizedText, {
  contentElement: targetContainer
});

// ❌ WRONG - Text mismatch causes highlighting issues
const text = range.toString().trim(); // Only trims, doesn't collapse whitespace
await ttsService.speak(text, { contentElement: targetContainer });
```

#### Common Pitfalls

1. **Using `trim()` without `replace(/\s+/g, ' ')`** - Internal whitespace still misaligned
2. **Extracting text from one element, highlighting in another** - Text content differs
3. **Not rebuilding after TTSService changes** - Old code runs with bugs
4. **Speech marks in wrong coordinate system** - Server returns trimmed positions, must match

#### Testing Checklist

When implementing TTS highlighting:

1. Check console: `[TTSService] Text comparison: { match: true }`
2. Verify: `mapLengthMatchesSpoken: true`
3. Test with content containing lots of whitespace
4. Verify words highlight at correct positions, not ahead/behind
5. Check that highlighted text matches the spoken word

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

## QTI 3.0 Integration with Section Player

The TTS system integrates seamlessly with QTI 3.0 accessibility catalogs through the **PIE Section Player**:

```javascript
import {
  TTSService,
  AccessibilityCatalogResolver,
  BrowserTTSProvider
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs || [],
  'en-US'
);

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Pass to section player - it handles the rest automatically
const sectionPlayer = document.getElementById('section-player');
sectionPlayer.ttsService = ttsService;
sectionPlayer.catalogResolver = catalogResolver;
sectionPlayer.section = section;

// TTS tools in the section player will automatically:
// - Extract SSML from passages and items
// - Use pre-authored SSML from catalogs if available
// - Fall back to generated TTS if no catalog exists
```

## SSML Extraction and Auto-Catalog Generation

The PIE Players automatically extract embedded SSML from item content and convert it into QTI 3.0 accessibility catalogs at runtime.

### Why Automatic Extraction?

Authors can embed SSML directly in content for convenience:
- Proper pronunciation of technical terms (e.g., "polynomial")
- Math expressions spoken correctly ("x squared minus five x")
- Emphasis and pacing control
- No need to maintain separate catalog files

The system automatically:
1. Extracts SSML during item/passage load
2. Generates catalog entries with unique IDs
3. Cleans visual markup (removes SSML tags)
4. Registers catalogs with AccessibilityCatalogResolver

### Example: Before and After Extraction

**Original Item (Author Creates):**
```typescript
{
  config: {
    models: [{
      prompt: `<div>
        <speak xml:lang="en-US">
          Which method should you use to solve
          <prosody rate="slow">x squared, minus five x, plus six</prosody>?
        </speak>
        <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
      </div>`
    }]
  }
}
```

**After Extraction (Runtime):**
```typescript
{
  config: {
    models: [{
      prompt: `<div data-catalog-id="auto-prompt-q1">
        <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
      </div>`
    }],
    extractedCatalogs: [
      {
        identifier: 'auto-prompt-q1',
        cards: [{
          catalog: 'spoken',
          language: 'en-US',
          content: `<speak xml:lang="en-US">
            Which method should you use to solve
            <prosody rate="slow">x squared, minus five x, plus six</prosody>?
          </speak>`
        }]
      }
    ]
  }
}
```

### Extraction Service

**Location:** `packages/assessment-toolkit/src/services/SSMLExtractor.ts`

**Usage:**
```typescript
import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

const extractor = new SSMLExtractor();
const result = extractor.extractFromItemConfig(item.config);

// Update config with cleaned content
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;

// Register with resolver
catalogResolver.addItemCatalogs(result.catalogs);
```

**Integration Points:**
- `pie-section-player-splitpane` - Primary interface for toolkit services
- `PieSectionPlayerSplitPaneElement.svelte` - Composes passages/items and runtime wiring
- Runs transparently during render (no author action needed)

**Usage Pattern:**
The splitpane section player is the primary container for assessment toolkit integration. Pass services as JavaScript properties, and the player handles SSML extraction, catalog management, and TTS tool rendering automatically.

See [Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md) for complete examples.

## Future Providers

Potential additional server-side TTS providers:

- **@pie-players/tts-server-google** - Google Cloud Text-to-Speech
- **@pie-players/tts-server-azure** - Azure Cognitive Services TTS
- **@pie-players/tts-server-elevenlabs** - ElevenLabs high-fidelity voices

All server providers follow the same pattern:

- Implement `ITTSServerProvider` interface from `@pie-players/tts-server-core`
- Expose via SvelteKit API routes in demo apps
- Client uses `ServerTTSProvider` from `@pie-players/tts-client-server`

## Summary

- **@pie-players/pie-tts**: Pure interfaces, zero dependencies
- **@pie-players/pie-assessment-toolkit**: Built-in browser TTS fallback + services
- **Server-side architecture**: Secure, production-ready TTS with speech marks
  - **tts-server-core**: Server provider interfaces
  - **tts-server-polly**: AWS Polly implementation
  - **tts-client-server**: Browser client
- **Pattern**: Try server-side TTS, fallback to browser TTS
- **Benefit**: Always-working TTS with optional high-quality upgrades and precise word highlighting
