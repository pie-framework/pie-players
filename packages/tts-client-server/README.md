# @pie-players/tts-client-server

Client-side TTS provider that calls a server API for synthesis with speech marks support.

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
  voiceId: 'Joanna',
  language: 'en-US',
});
```

### With Authentication

```typescript
await ttsService.initialize(provider, {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  authToken: 'your-jwt-token',
  organizationId: 'org-123',
});
```

### Speak with Word Highlighting

```typescript
// The provider automatically coordinates word highlighting
await ttsService.speak('Hello world, this is a test.', {
  contentElement: document.getElementById('content'),
});
```

## API Requirements

The server API must implement two endpoints:

### POST `/api/tts/synthesize`

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

### GET `/api/tts/voices`

**Response:**
```json
{
  "voices": [
    {
      "id": "Joanna",
      "name": "Joanna",
      "language": "English",
      "languageCode": "en-US",
      "gender": "female",
      "quality": "neural"
    }
  ]
}
```

## SvelteKit Implementation Example

See the implementation guide in [tts-server-api-architecture.md](../../docs/tts-server-api-architecture.md).

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
  authToken?: string;         // JWT or API key
  organizationId?: string;    // For multi-tenant setups
  headers?: Record<string, string>;  // Custom headers
  voiceId?: string;           // Voice ID
  language?: string;          // Language code
  rate?: number;              // Speech rate (0.25-4.0)
  volume?: number;            // Volume (0-1)
}
```

## How It Works

1. **Client calls** `speak(text)`
2. **Provider POSTs** to `/api/tts/synthesize` with text
3. **Server synthesizes** using provider (Polly, Google, etc.)
4. **Server returns** base64 audio + speech marks
5. **Client converts** base64 to Blob URL
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
    onWordBoundary('', timing.charIndex);
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
