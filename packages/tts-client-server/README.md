# @pie-players/tts-client-server

`ServerTTSProvider`, the browser-side text-to-speech (TTS) provider that sends
synthesis to a server API the host runs. The server picks the vendor (AWS Polly,
Google Cloud TTS, or any provider built on `@pie-players/tts-server-core`) and
holds its credentials; the client plays the returned audio and reports word
boundaries from the server's speech marks. This README covers the provider's API
for host integrators adding server-backed read-aloud. For the package layering,
see [TTS Architecture](../../docs/accessibility/tts-architecture.md); for the
runtime flow, the [TTS deep dive](../../docs/accessibility/tts-deep-dive.md).

## Features

- **Server-side synthesis**: vendor credentials stay on the server
- **Speech marks**: word timings from the server drive highlighting
- **Word highlighting**: the audio clock is polled every 50ms
- **Audio playback**: an `HTMLAudioElement` playing a Blob URL, with pause and
  resume

## Installation

```bash
npm install @pie-players/tts-client-server
```

## Usage

### Basic Setup

```typescript
import {
  ServerTTSProvider,
  type ServerTTSProviderConfig,
} from '@pie-players/tts-client-server';
import { TTSService } from '@pie-players/pie-assessment-toolkit';

const provider = new ServerTTSProvider();
const config: ServerTTSProviderConfig = {
  apiEndpoint: '/api/tts',  // the host's TTS API route
  provider: 'polly',         // Server-side provider to use
  voice: 'Joanna',
  language: 'en-US',
};

const ttsService = new TTSService();
await ttsService.initialize(provider, config);
```

`apiEndpoint`, `provider`, `voice` and `language` are top-level fields; the
provider reads none of them from `providerOptions`. `providerOptions` carries
request extras: the PIE transport forwards its `engine` (when no top-level
`engine` is set), `sampleRate`, `format` and `speechMarkTypes`, and the custom
transport reads its `speedRate` (else a bucket from `rate`), `lang_id` (else the
content language, else `language`, else `en-US`) and `cache` (default `true`).

`apiEndpoint` is required when using `ServerTTSProvider` directly, and
`initialize` throws without it. Toolkit-level `tools.providers.textToSpeech`
integration defaults it to `/api/tts` for server-backed backends.

### With Authentication

```typescript
await ttsService.initialize(provider, {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  authToken: 'your-jwt-token', // sent as `Authorization: Bearer <token>`
});
```

### Speak with Word Highlighting

```typescript
// The provider automatically coordinates word highlighting
await ttsService.speak(document.getElementById('content'));
```

## Transport Modes

`ServerTTSProvider` supports two transport modes:

- `pie`: POST `${apiEndpoint}/synthesize`, inline base64 audio + inline speech marks
- `custom`: POST to root endpoint, then fetch `audioContent` and JSONL marks URLs

With `transportMode` unset, the transport is `custom` when `provider` is
`"custom"` and `pie` otherwise. `endpointMode` defaults to `synthesizePath` for
`pie` and `rootPost` for `custom`. The toolkit's `tools.providers.textToSpeech`
applies the same default from `serverProvider`.

The provider reports SSML support only on the `pie` transport with `provider`
`polly` (the default) or `google`. There the toolkit voices generated math as
SSML; everywhere else, the custom transport included, generated speech is plain
text.

### PIE mode request

**Request:**
```json
{
  "text": "Hello world",
  "provider": "polly",
  "voice": "Joanna",
  "language": "en-US",
  "rate": 1.0,
  "includeSpeechMarks": true
}
```

**Response:**
```json
{
  "audio": "base64-encoded-audio",
  "contentType": "audio/mpeg",
  "speechMarks": [
    { "time": 0, "type": "word", "start": 0, "end": 5, "value": "Hello" },
    { "time": 340, "type": "word", "start": 6, "end": 11, "value": "world" }
  ],
  "metadata": {
    "providerId": "aws-polly",
    "voice": "Joanna",
    "duration": 1.5,
    "charCount": 11,
    "cached": false
  }
}
```

### Custom mode request

```json
{
  "text": "Hello world",
  "speedRate": "medium",
  "lang_id": "en-US",
  "langId": "en-US",
  "cache": true
}
```

The language travels under both `lang_id` and `langId`, so a server that binds
JSON in camelCase reads it without a mapping of its own. It is the host's
`providerOptions.lang_id`, else the language a speak names, else `language`,
else `en-US`. In PIE mode, `language` is the language a speak names, else the
configured one.

### Custom mode response

```json
{
  "audioContent": "https://cdn.example.com/audio.mp3",
  "word": "https://cdn.example.com/marks.jsonl"
}
```

Speech marks are fetched from the `word` URL and parsed as JSONL.

### Optional voices endpoint

`GET ${apiEndpoint}/voices` remains optional and is only used when endpoint validation is configured with `endpointValidationMode: "voices"`. With `provider: "polly"` or `"google"` the probe tries `${apiEndpoint}/<provider>/voices` first and falls back to `${apiEndpoint}/voices` when that route returns 404. A failed probe makes the toolkit switch to browser TTS.

## SvelteKit Implementation Example

The [`@pie-players/tts-server-polly` integration guide](../tts-server-polly/examples/INTEGRATION-GUIDE.md) builds these routes for Polly, and the [`@pie-players/tts-server-google` integration guide](../tts-server-google/examples/INTEGRATION-GUIDE.md) for Google.

Example route structure:
```
apps/<host-app>/src/routes/api/tts/
├── synthesize/+server.ts
└── voices/+server.ts
```

## Configuration

### ServerTTSProviderConfig

```typescript
interface ServerTTSProviderConfig {
  apiEndpoint: string;        // API base URL (required)
  provider?: string;          // Server provider ('polly', 'google', etc.)
  transportMode?: 'pie' | 'custom';
  endpointMode?: 'synthesizePath' | 'rootPost';
  endpointValidationMode?: 'voices' | 'endpoint' | 'none'; // Probe run by initialize(); default 'none'
  authToken?: string;         // JWT or API key
  includeAuthOnAssetFetch?: boolean;
  assetOrigins?: string[];    // Trusted origins for Authorization header
  credentials?: 'omit' | 'same-origin' | 'include'; // Fetch credentials mode
  headers?: Record<string, string>;  // Custom headers
  voice?: string;             // Voice ID, e.g. 'Joanna'
  engine?: 'standard' | 'neural';    // Polly engine
  language?: string;          // Language code
  rate?: number;              // Speech rate (0.25-4.0)
  volume?: number;            // Volume (0-1)
  providerOptions?: Record<string, unknown>; // Request extras (see Basic Setup)
}
```

## Security

`ServerTTSProvider` treats `apiEndpoint` and `authToken` as host-owned.
The host is responsible for authenticating `/api/tts/*` (session cookie,
JWT, or equivalent), rate-limiting callers, and keeping vendor
credentials (AWS, Google, etc.) server-side only. End-to-end guidance —
including a SvelteKit `hooks.server.ts` sketch and rate-limit example —
lives in
[`@pie-players/tts-server-polly` → INTEGRATION-GUIDE.md § Security Considerations](../tts-server-polly/examples/INTEGRATION-GUIDE.md#security-considerations).

The provider itself enforces one piece of security directly: it scrubs
the `Authorization` header when following URLs returned by the TTS
server that fall outside a trusted origin set.

- **`assetOrigins`** — allow-list of origins permitted to receive the
  bearer token when the provider fetches custom-transport audio or
  speech-mark URLs. Defaults to the origin of `apiEndpoint` (or, for a
  relative `apiEndpoint`, `window.location.origin`). Non-`http(s)`
  URLs and malformed URLs are always rejected, regardless of this
  setting.
- **`includeAuthOnAssetFetch`** — defaults to `false`. When `true`, the
  provider will forward `Authorization` on asset fetches *only* to
  origins in `assetOrigins`; off-allow-list origins are fetched without
  auth. Leave at the default unless your CDN / storage backend actually
  requires the bearer token to read assets.
- **`credentials`** — the fetch `credentials` mode, unset by default, which
  leaves the browser default (`"same-origin"`). Set `"include"` when the TTS
  server sits on another origin and authenticates by cookie; the server must
  answer CORS with `Access-Control-Allow-Credentials: true` and an explicit
  origin. Speech-mark and audio fetches to an origin outside `assetOrigins`
  keep the browser default, so cookies follow the same allow-list as the
  bearer token.

See
[`docs/tools-and-accomodations/tool_host_contract.md#backend-endpoints-for-tool-providers`](../../docs/tools-and-accomodations/tool_host_contract.md#backend-endpoints-for-tool-providers)
for the host-wide contract this provider fits into.

## How It Works

1. **TTSService calls** `speak(text)` with the text it resolved from the element or range
2. **Adapter builds** backend-specific request payload
3. **Provider POSTs** to resolved synthesis endpoint (`/synthesize` or root POST)
4. **Adapter normalizes** response into audio + speech marks
5. **Client loads** audio as Blob URL
6. **Client plays** audio via HTMLAudioElement
7. **Client polls** audio time every 50ms
8. **Client reports** the word at the current audio time through the word-boundary callback
9. **TTSService** highlights words in DOM

## Word Highlighting Synchronization

Every 50ms the provider reads the audio's current time and reports the last
word whose start time has arrived, once:

```typescript
const currentTimeMs = audio.currentTime * 1000;
const index = lastTimingAtOrBefore(wordTimings, currentTimeMs);
if (index >= 0 && index !== lastReported) {
  lastReported = index;
  const timing = wordTimings[index];
  onWordBoundary(timing.word, timing.charIndex, timing.length);
}
```

Words a tick crossed are skipped: the callback names the word being spoken, so
replaying them would paint highlights the learner never sees and leave the
highlight behind the audio. A background tab's clamped timer resyncs on its next
tick for the same reason.

## Memory Management

The provider automatically manages Blob URLs:

- Creates Blob URL from base64 audio
- Plays audio from Blob URL
- Revokes Blob URL when done (frees memory)
- Cleans up on stop/error

## Error Handling

```typescript
try {
  await ttsService.speak(document.getElementById('content'));
} catch (error) {
  console.error('TTS failed:', error.message);
  // A failed read rejects without switching provider; the toolkit coordinator
  // falls back to browser TTS only when a provider fails to start.
}
```

## Browser Compatibility

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

Requires:

- `HTMLAudioElement` API
- `fetch` API
- `URL.createObjectURL`
- `atob` for base64 decoding

## Caching

The client keeps no audio cache. Caching is server-side, through the host's
`ITTSCache` (`@pie-players/tts-server-core`); the custom transport also sends a
`cache` flag, `true` unless `providerOptions.cache` is `false`.

## License

MIT
