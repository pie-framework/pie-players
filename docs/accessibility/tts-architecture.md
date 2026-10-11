# TTS Architecture

<!-- markdownlint-disable MD022 MD031 MD032 MD036 MD040 -->

This document covers the text-to-speech (TTS) packages: where each runs, what it
depends on, how the providers compare and how word highlighting aligns speech
with the page. It is for host integrators choosing a provider and for
contributors working across the TTS packages. The
[TTS deep dive](./tts-deep-dive.md) owns the runtime flow, from the toolbar
button to the highlighted word; each package README owns that package's API and
setup.

For accessibility review, the [WCAG reference library](../wcag/readme.md) lists
the [criteria most likely to affect TTS work](../wcag/wcag-2.2-aa-baseline.md)
and the [evaluation method](../wcag/evaluation-method.md).

## Package Structure

TTS is layered: a dependency-free contract package, a browser provider built
into the toolkit, and server-backed providers a host adds.

### @pie-players/pie-tts

The contracts a provider implements, in pure TypeScript with no dependencies and
no UI framework ([README](../../packages/tts/README.md)):

- `ITTSProvider`: the provider factory
- `ITTSProviderImplementation`: playback
- `TTSProviderCapabilities`: the features a provider supports
- `TTSConfig`: configuration

A custom provider builds on this package alone.

### @pie-players/pie-assessment-toolkit

The assessment runtime, with the browser provider built in
([README](../../packages/assessment-toolkit/README.md)):

- `TTSService`: resolves what to speak, owns playback state, calls the provider
  and coordinates highlighting through `HighlightCoordinator`
- `services/tts/text-processing.ts`: provider-neutral visible-text extraction,
  normalization and DOM mapping
- `BrowserTTSProvider`: the Web Speech API adapter
- `AccessibilityCatalogResolver`: looks up accessibility catalogs, including
  authored spoken alternatives, by the content that owns them
- `SSMLExtractor`: converts embedded `<speak>` markup into catalogs

It re-exports the provider types from `@pie-players/pie-tts` (`ITTSProvider`,
`ITTSProviderImplementation`, `TTSConfig`, `TTSSpeechSegment` and
`TTSProviderCapabilities`), speaks authored SSML from accessibility catalogs
that visible markup references with `data-catalog-idref`, and generates math
speech from rendered MathML with Speech Rule Engine. Its TTS dependencies are
`@pie-players/pie-tts`, `@pie-players/pie-players-shared` (UI components and
i18n) and `speech-rule-engine`.

### Server-Backed TTS

Server-backed TTS splits synthesis between a server the host runs and a browser
client, so provider credentials stay on the server.

#### Server-Side Packages (Node.js)

- [`@pie-players/tts-server-core`](../../packages/tts-server-core/README.md):
  the server provider interfaces, speech-mark utilities and types, a caching
  interface and the `BaseTTSProvider` class the adapters extend.
- [`@pie-players/tts-server-polly`](../../packages/tts-server-polly/README.md):
  AWS Polly. Native word speech marks at millisecond precision, audio and marks
  requested in parallel, and Polly's SSML subset.
- [`@pie-players/tts-server-google`](../../packages/tts-server-google/README.md):
  Google Cloud Text-to-Speech. Speech marks from SSML mark injection and
  timepoints; the README covers the authentication modes.
- [`@pie-players/tts-server-sc`](../../packages/tts-server-sc/README.md): the SC
  adapter, a reference adapter for a custom transport whose service returns
  audio and speech-mark URLs. It normalizes the word marks the service returns
  and allow-lists asset URLs against SSRF.

#### Client-Side Package (Browser)

[`@pie-players/tts-client-server`](../../packages/tts-client-server/README.md)
provides `ServerTTSProvider`. It posts text to the host's synthesis API over the
`pie` or `custom` transport, receives inline or URL-based audio and speech marks,
plays the audio in an `HTMLAudioElement` and polls playback every 50ms to report
the current word.

A host API route connects the client to a server adapter. With the `pie`
transport:

```
Browser → ServerTTSProvider → /api/tts/synthesize → PollyServerProvider → AWS Polly
```

With the `custom` transport:

```
Browser → ServerTTSProvider (custom transport) → Custom root POST API
```

The
[`@pie-players/tts-server-polly` integration guide](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md)
builds SvelteKit routes for Polly.

## Architecture Diagram

![TTS packages by where they run: in the browser the default tool loaders import the inline TTS tool and ServerTTSProvider, the tool depends on the assessment toolkit, and the toolkit and ServerTTSProvider depend on the pie-tts contracts; on the host-run TTS server the Polly, Google Cloud and SC adapters build on tts-server-core, whose speech-mark helpers ServerTTSProvider also uses](../img/tts-packages.excalidraw.svg)

## Provider Selection and Fallback

Hosts configure TTS through the toolkit's `tools.providers.textToSpeech`:
`backend: 'browser'`, or `backend: 'server'` with `serverProvider` `polly`,
`google` or `custom`. The
[minimal server-backed config](../../packages/assessment-toolkit/README.md#minimal-server-backed-tts-config)
defaults `apiEndpoint` to `/api/tts` and derives the transport from
`serverProvider`, so host config stays small.

The toolkit always includes `BrowserTTSProvider`. It needs no server and no
configuration. It fails to initialize where the browser has no Speech Synthesis
API, and it speaks only in the voices the device has installed.

The toolkit coordinator owns fallback: when a server-backed provider fails to
initialize, it re-initializes TTS on the browser backend and reports
`pie-tool-init-fallback`
([Browser Fallback](../../packages/assessment-toolkit/README.md#browser-fallback)).
A read that fails after initialization rejects without switching provider.

A host that drives `TTSService` without the coordinator initializes the provider
itself and owns fallback:

```typescript
import { TTSService } from '@pie-players/pie-assessment-toolkit';
import {
  ServerTTSProvider,
  type ServerTTSProviderConfig,
} from '@pie-players/tts-client-server';

const ttsService = new TTSService();

// `initialize` rejects when the provider fails to start.
const serverConfig: ServerTTSProviderConfig = {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  voice: 'Joanna',
};
await ttsService.initialize(new ServerTTSProvider(), serverConfig);
```

## Provider Comparison

| Feature | Browser TTS | Server, Polly | Server, Google Cloud | Server, custom transport (SC adapter) |
| ------- | ----------- | ------------- | -------------------- | ------------------------------------- |
| **Highlighting** | Sentence-level by default | Word-level from speech marks | Word-level from SSML marks and timepoints | Word-level from the speech marks the service returns |
| **Generated math** | Plain text | SSML | SSML | Plain text |
| **Authored SSML** | Voiced as its spoken text | Polly's supported subset | Google's SSML | Passed to the service |
| **Voices** | Those installed on the device | Polly's, the same on every device | Google's, the same on every device | The service's |
| **Server** | None | A synthesis endpoint the host runs; credentials stay on it | Same | Same |
| **Text per request** | No limit declared | 3000 characters; the toolkit splits longer text | Same | Same |
| **Requests per read** | None | Two SynthesizeSpeech calls (audio and speech marks) | One SynthesizeSpeech call | One synthesis call, then fetches of the returned audio and speech-mark URLs |

On every server column, a response without speech marks highlights its
sentence. The [TTS authoring guide](./tts-authoring-guide.md#ssml-provider-support)
owns the per-provider SSML detail.

## Word Highlighting Architecture

### Text Alignment

Word highlighting rests on one invariant: the spoken text, the visible DOM text
and the provider's speech-mark offsets share one coordinate system. `TTSService`
normalizes the spoken text and the visible text the same way:

```typescript
const normalizedText = rawText.trim().replace(/\s+/g, ' ');
```

Normalization trims leading and trailing whitespace and collapses each run of
spaces, tabs and newlines to one space, so a character position in the spoken
text is the same position in the visible text.

Item JSON often carries formatting whitespace:

```json
{
  "prompt": "Based on the passage,\n                \n\n       which method..."
}
```

Unnormalized, that prompt is 150 DOM characters against 100 spoken ones, and a
speech mark at position 50 highlights the wrong word. Normalized, both are 100
characters and the marks align.

### Math Alignment

When PIE finds MathML in the read target, it converts the MathML to
natural-language speech before playback and builds a math alignment plan for
speech-mark highlighting. The plan tokenizes the visible MathML structure and
the spoken or SSML source, normalizes provider boundary offsets, and emits a
word-level target only when a boundary maps to a visible MathML token with very
high local confidence.

Without that confidence, PIE falls back to the smallest reliable visible target:

1. the exact token or operator, when the mapping is safe
2. the MathML subtree or whole formula, when token mapping is ambiguous
3. the surrounding TTS region, when no smaller target is reliable

A whole-formula highlight is preferable to a visibly wrong, stale or lagging
word highlight. Speech marks are evidence the plan checks, because Polly, the SC
adapter and the browser may report raw SSML offsets, normalized spoken-text
offsets or provider-specific mark positions. The deep dive's
[generated math walkthrough](./tts-deep-dive.md#generated-math-walkthrough)
covers when an equation highlights by token and when by expression.

### Position Mapping in TTSService

`TTSService.buildPositionMap()` walks the content's flat tree, open shadow roots
included, with the text core's `collectVisibleTextAndMap`. It normalizes the
visible text the way the spoken text is normalized and maps each normalized
position to its `{text node, offset}`.

A word boundary resolves through that map to one range over the word's
characters, spanning every text node the word covers, or one range per tree when
it crosses a shadow boundary. `HighlightCoordinator.highlightTTSWord(ranges)`
paints them; it is the one word-highlight call.

Adjacent alphanumeric text nodes gain a space in the visible text, so a word an
author split across inline elements is read as two ("Mis sissippi"). A
deliberate trade: words in neighboring elements never run together, at the cost
of that split.

### TTS Tools

TTS tools pass the DOM they read, an element or a range, to `speak()`, so every
read takes one normalization path.

### Common Pitfalls

1. **Bypassing the `TTSService` normalization path**: custom pre-normalization
   desynchronizes offsets.
2. **Extracting text from one element and highlighting another**: the two texts
   differ.
3. **Speech marks in another coordinate system**: the server must return
   positions in the trimmed text.

### Alignment Checks

With [debug logging](./tts-deep-dive.md#debug-logging) on, the console's
`[tts-service] Text comparison` line reports `match: true` and the position-map
line `mapLengthMatchesSpoken: true` when spoken and visible text align. Read
content with heavy whitespace and confirm each highlighted word is the spoken
word, neither ahead nor behind.

## Segmenter and Fallback Policy

- Browser sentence chunking uses `Intl.Segmenter` (`granularity: "sentence"`)
  where available, and a regular expression elsewhere.
- Browser highlighting defaults to sentence-level for stability.
- Server-backed providers that return speech marks keep word-level
  highlighting; a response without marks highlights its sentence, word mode
  included.
- Locale is threaded through TTS settings into both text processing and browser
  segmentation.

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
