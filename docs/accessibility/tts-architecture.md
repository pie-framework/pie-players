# TTS Architecture

<!-- markdownlint-disable MD022 MD031 MD032 MD036 MD040 -->

## Overview

The PIE Players TTS (Text-to-Speech) system is layered: a zero-dependency interface package, a browser provider built into the toolkit, and pluggable server-backed providers.

See also:

- [`./tts-deep-dive.md`](./tts-deep-dive.md) for a full runtime walkthrough with
  diagrams
- [`../wcag/readme.md`](../wcag/readme.md) for the WCAG reference library
- [`../wcag/wcag-2.2-aa-baseline.md`](../wcag/wcag-2.2-aa-baseline.md) for the criteria most likely to affect TTS work
- [`../wcag/evaluation-method.md`](../wcag/evaluation-method.md) for evaluation guidance

This document is the source of truth for cross-package TTS architecture. Package
READMEs document package-specific APIs, configuration, and provider setup.

## Package Structure

### 1. @pie-players/pie-tts

**Purpose:** Core TTS interfaces and types - Pure TypeScript with **zero dependencies**.

**Contains:**
- `ITTSProvider` - Provider factory interface
- `ITTSProviderImplementation` - Playback implementation interface
- `TTSProviderCapabilities` - Feature support descriptor
- `TTSConfig` - Configuration types

**Dependencies:** None

**Use Case:**
- Building custom TTS providers
- Type-safe TTS integration
- Framework-agnostic implementations

### 2. @pie-players/pie-assessment-toolkit

**Purpose:** Assessment runtime with built-in browser TTS fallback.

**Contains:**
- `TTSService` - Main TTS orchestrator (state + provider wiring)
- `services/tts/text-processing.ts` - provider-agnostic visible-text extraction, normalization, and DOM mapping
- `BrowserTTSProvider` - Web Speech API adapter (always available)
- `AccessibilityCatalogResolver` - QTI 3.0 catalog management
- `SSMLExtractor` - Utility for converting embedded `<speak>` markup into catalogs
- Playback state management

**Dependencies:**
- `@pie-players/pie-tts` (provider interfaces)
- `@pie-players/pie-players-shared` (UI components, i18n)
- `@pie-players/pie-calculator` and `@pie-players/pie-context`
- `speech-rule-engine` (MathML speech)

**TTS Features:**
- Re-exports the provider types from `tts`: `ITTSProvider`, `ITTSProviderImplementation`, `TTSConfig`, `TTSSpeechSegment` and `TTSProviderCapabilities`
- Includes `BrowserTTSProvider` as the default fallback, available wherever the browser implements the Speech Synthesis API
- Integrates with QTI 3.0 accessibility catalogs
- **Authored SSML/catalog support** through accessibility catalogs and
  `data-catalog-idref`
- **Automatic math speech generation** from rendered MathML via Speech Rule Engine
- Coordinates with HighlightCoordinator for word highlighting

### 3. Server-Side TTS Architecture

The server-side architecture splits TTS into server-side and client-side components for better security and reliability.

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
- SSML (Polly's supported subset)

**@pie-players/tts-server-google**
- Google Cloud Text-to-Speech implementation for Node.js
- Speech marks via SSML mark injection and timepoints
- Supports Google authentication modes documented in the package README

**@pie-players/tts-server-sc**
- SchoolCity-backed reference implementation for custom server-side providers
- Normalizes word marks returned by the SchoolCity service
- Includes asset URL allow-listing and SSRF defenses

#### Client-Side Package (Browser)

**@pie-players/tts-client-server**
- Calls server API for synthesis
- Supports transport adapters (`pie`, `custom`)
- Receives inline audio/marks or URL-based assets, then normalizes playback
- 50ms polling-based highlighting
- HTMLAudioElement playback

#### Integration

SvelteKit API routes connect the pieces:
```
Browser → ServerTTSProvider → /api/tts/synthesize → PollyServerProvider → AWS Polly
```

Custom backend integrations can use:
```
Browser → ServerTTSProvider (custom transport) → Custom root POST API
```

See [Server-Side TTS Integration Guide](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md) for setup instructions.

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
│ assessment-toolkit        │  │ @pie-players/tts-client-server │
│                           │  │                             │
│ - TTSService              │  │ - ServerTTSProvider         │
│ - BrowserTTSProvider      │  │ - Server API integration    │
│   (built-in fallback)     │  │ - Speech-mark highlighting  │
│ - Catalog integration     │  │ - Server-side SSML          │
│ - State management        │  │                             │
└───────────────────────────┘  └─────────────────────────────┘
          │                                  │
          └────────────────┬─────────────────┘
                           ▼
                    Application Code
```

## Fallback Strategy

The assessment toolkit **always includes** `BrowserTTSProvider` as a built-in fallback. It needs no server and no configuration. It fails to initialize where the browser has no Speech Synthesis API, and it speaks only in the voices the device has installed.

### Recommended Pattern

```typescript
import { TTSService } from '@pie-players/pie-assessment-toolkit';
import {
  ServerTTSProvider,
  type ServerTTSProviderConfig,
} from '@pie-players/tts-client-server';

const ttsService = new TTSService();

// Server-side TTS (preferred for production). `initialize` rejects when the
// provider fails to start; falling back to browser speech is the toolkit
// coordinator's job.
const serverConfig: ServerTTSProviderConfig = {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  voice: 'Joanna',
};
await ttsService.initialize(new ServerTTSProvider(), serverConfig);
```

When using toolkit `tools.providers.textToSpeech` configuration (instead of initializing
`ServerTTSProvider` directly), server-backed defaults can be applied for common
cases (for example `apiEndpoint: '/api/tts'` and `transportMode: 'pie'`), so
host config can stay minimal.

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

### 3. **Built-in Fallback**
Browser TTS is built into the toolkit, giving:
- Offline capability, with no server
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
| **Highlighting** | Sentence-level by default | Word-level from speech marks |
| **SSML** | None: tags are stripped and the text is read plainly | Polly's supported subset |
| **Voices** | Those installed on the device | Polly's, the same on every device |
| **Server** | None | A synthesis endpoint the host runs; credentials stay on it |
| **Text per request** | No limit declared | 3000 characters; the toolkit splits longer text |
| **Requests per read** | None | Two SynthesizeSpeech calls (audio and speech marks) |

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

Math content is a special case. When PIE finds MathML in the read target, it converts that MathML to natural-language speech before provider playback and builds a math alignment plan for speech-mark highlighting. The alignment plan tokenizes the visible MathML structure, tokenizes the spoken/SSML source, normalizes provider boundary offsets, and only emits word-level targets when the boundary maps to a visible MathML token with very high local confidence.

When that confidence is not available, PIE deliberately falls back to the smallest reliable visible target:

1. exact token/operator target when mapping is safe
2. MathML subtree or full formula target when token mapping is ambiguous
3. surrounding TTS region when no smaller target is reliable

This conservative fallback is intentional. A full formula highlight is preferable to a visibly wrong word highlight, stale highlight, or lagging boundary. Provider speech marks are treated as evidence, not as truth by assumption, because Polly/SchoolCity/browser boundaries may report raw SSML offsets, normalized spoken-text offsets, or provider-specific mark positions.

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

`TTSService.buildPositionMap()` walks the content's flat tree, open shadow roots
included, with the text core's `collectVisibleTextAndMap`. It normalizes the
visible text the way the spoken text is normalized and maps each normalized
position to its `{text node, offset}`.

A word boundary resolves through that map to one range over the word's
characters, spanning every text node the word covers, or one range per tree when
it crosses a shadow boundary. `HighlightCoordinator.highlightTTSWord(ranges)`
paints them; it is the one word-highlight call. Adjacent alphanumeric text nodes
gain a space in the visible text, so a word an author split across inline
elements is read as two ("Mis sissippi"): a deliberate trade, keeping words in
neighbouring elements from running together at the cost of that split.

#### Implementation in TTS Tools

TTS tools pass the DOM they read, an element or a range, to `speak()`, so every read takes one normalization path.

#### Common Pitfalls

1. **Bypassing `TTSService` normalization path** - custom pre-normalization can desync offsets
2. **Extracting text from one element, highlighting in another** - Text content differs
3. **Speech marks in wrong coordinate system** - Server returns trimmed positions, must match

#### Testing Checklist

When implementing TTS highlighting:

1. With `PIE_TTS_DEBUG=1` or `globalThis.__PIE_TTS_DEBUG__ = true`, check the
   console: `[tts-service] Text comparison: { match: true }`
2. Verify: `mapLengthMatchesSpoken: true`
3. Test with content containing lots of whitespace
4. Verify words highlight at correct positions, not ahead/behind
5. Check that highlighted text matches the spoken word

## Segmenter + Fallback Policy

- Browser adapter sentence chunking uses `Intl.Segmenter` (`granularity: "sentence"`) when available.
- Browser highlighting defaults to sentence-level for stability.
- Server-backed providers that return speech marks keep word-level highlighting; a response without marks highlights its sentence, word mode included.
- Fallback behavior remains regex-based for environments without `Intl.Segmenter`.
- Locale is threaded through TTS settings into both text-processing and browser segmentation.

## Creating Custom Providers

A custom provider implements `ITTSProvider` and `ITTSProviderImplementation`
from `@pie-players/pie-tts`. The [`@pie-players/pie-tts` README](../../packages/tts/README.md)
has the example and the playback, settings and text-length contracts the toolkit
holds a provider to.

## Catalogs and SSML Extraction

The section player resolves registered `spoken` catalogs through the
coordinator's services, plays pre-authored SSML when a card is available, and
falls back to generated speech or visible text. The
[Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md)
owns the wiring
([Section Player Integration](./accessibility-catalogs-integration-guide.md#section-player-integration))
and `SSMLExtractor`
([SSML Extraction from PIE Content](./accessibility-catalogs-integration-guide.md#ssml-extraction-from-pie-content)).
