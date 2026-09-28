# @pie-players/tts-client-server

Client-side TTS provider that calls a server API for synthesis with speech marks support.

For the cross-package TTS architecture and provider layering, see
[TTS Architecture](../../docs/accessibility/tts-architecture.md). This README
focuses on the browser-side server provider API.

## Overview

This package provides a browser-side TTS provider that offloads synthesis to a server API. The server handles provider selection (AWS Polly, Google Cloud TTS, etc.) and credential management, while the client plays audio and coordinates word highlighting.

## Features

- ✅ **Server-Side Synthesis** - Keeps credentials secure on server
- ✅ **Speech Marks** - Precise word-level timing from server
- ✅ **Multiple Providers** - Server can use Polly, Google, ElevenLabs, etc.
- ✅ **Word Highlighting** - 50ms polling for smooth synchronization
- ✅ **Audio Playback** - HTMLAudioElement with pause/resume
- ✅ **Blob URLs** - Efficient memory management

## Installation

```bash
npm install @pie-players/tts-client-server
```

## Usage

### Basic Setup

```typescript
import { ServerTTSProvider } from '@pie-players/tts-client-server';
import { TTSService } from '@pie-players/pie-assessment-toolkit';

const provider = new ServerTTSProvider();

const ttsService = new TTSService();
await ttsService.initialize(provider, {
  apiEndpoint: '/api/tts',  // Your SvelteKit API route
  provider: 'polly',         // Server-side provider to use
  voice: 'Joanna',
  language: 'en-US',
});
```

`apiEndpoint`, `provider`, `voice` and `language` are top-level fields; the
provider reads none of them from `providerOptions`. `providerOptions` carries
request extras: the PIE transport forwards its `engine` (when no top-level
`engine` is set), `sampleRate`, `format` and `speechMarkTypes`, and the custom
transport reads its `speedRate`.

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
await ttsService.speak('Hello world, this is a test.', {
  contentElement: document.getElementById('content'),
});
```

## Transport Modes

`ServerTTSProvider` now supports two transport modes:

- `pie` (default): POST `${apiEndpoint}/synthesize`, inline base64 audio + inline speech marks
- `custom`: POST to root endpoint, then fetch `audioContent` and JSONL marks URLs

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

### PIE mode response

```json
{
  "audio": "base64-encoded-audio",
  "contentType": "audio/mpeg",
  "speechMarks": [
    { "time": 0, "type": "word", "start": 0, "end": 5, "value": "Hello" }
  ]
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
JSON in camelCase reads it without a mapping of its own.

### Custom mode response

```json
{
  "audioContent": "https://cdn.example.com/audio.mp3",
  "word": "https://cdn.example.com/marks.jsonl"
}
```

Speech marks are fetched from the `word` URL and parsed as JSONL.

### Optional voices endpoint

`GET ${apiEndpoint}/voices` remains optional and is only used when endpoint validation is configured with `endpointValidationMode: "voices"`.

## SvelteKit Implementation Example

See the implementation guide in [tts-architecture.md](../../docs/accessibility/tts-architecture.md).

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
  endpointValidationMode?: 'voices' | 'endpoint' | 'none';
  validateEndpoint?: boolean; // Probe the endpoint during initialize()
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

1. **Client calls** `speak(text)`
2. **Adapter builds** backend-specific request payload
3. **Provider POSTs** to resolved synthesis endpoint (`/synthesize` or root POST)
4. **Adapter normalizes** response into audio + speech marks
5. **Client loads** audio as Blob URL
6. **Client plays** audio via HTMLAudioElement
7. **Client polls** audio time every 50ms
8. **Client fires** word boundary callbacks at correct times
9. **TTSService** highlights words in DOM

## Word Highlighting Synchronization

The provider uses a polling-based approach for reliable synchronization:

```typescript
// Every 50ms, check current audio time
const currentTime = audio.currentTime * 1000; // Convert to ms

// Find words that should be highlighted
for (const timing of wordTimings) {
  if (currentTime >= timing.time) {
    onWordBoundary('', timing.charIndex, timing.length);
  }
}
```

This is **much more reliable** than browser's `onboundary` events (which are broken in Safari and unreliable in Chrome).

## Memory Management

The provider automatically manages Blob URLs:

- Creates Blob URL from base64 audio
- Plays audio from Blob URL
- Revokes Blob URL when done (frees memory)
- Cleans up on stop/error

## Error Handling

```typescript
try {
  await ttsService.speak('Hello world');
} catch (error) {
  console.error('TTS failed:', error.message);
  // Fallback to browser TTS or show error
}
```

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

Requires:

- `HTMLAudioElement` API
- `fetch` API
- `URL.createObjectURL`
- `atob` for base64 decoding

## Performance

- **Audio caching:** Server-side (Redis)
- **Blob URLs:** Efficient memory usage
- **50ms polling:** Smooth highlighting without jank
- **Parallel requests:** Audio + marks fetched together

## License

MIT
