# @pie-players/tts-server-google

`GoogleCloudTTSProvider`, the Google Cloud Text-to-Speech provider for
server-side text-to-speech (TTS), built on `@pie-players/tts-server-core`. It
returns audio with word timings, which it gets by injecting SSML `<mark>` tags
and reading Google's timepoints; the timings drive read-aloud highlighting in
the browser. This README covers the provider's configuration and behavior for
developers writing a host's TTS routes; the
[integration guide](./examples/INTEGRATION-GUIDE.md) builds those routes, and
[TTS Architecture](../../docs/accessibility/tts-architecture.md) covers the
browser and server flow across packages.

The package runs on Node.js 20 or later.

## Installation

```bash
npm install @pie-players/tts-server-google
```

## Usage

### Basic Setup

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';

const provider = new GoogleCloudTTSProvider();

await provider.initialize({
  projectId: 'my-gcp-project',
  credentials: '/path/to/service-account.json', // or another authentication method
  voiceType: 'wavenet', // 'wavenet', 'standard', or 'studio' (Studio returns no speech marks)
  defaultVoice: 'en-US-Wavenet-A',
});
```

`initialize` validates the config and creates the Google client without calling
Google. A missing `projectId` throws a `TTSError` with `INITIALIZATION_ERROR`.

### Authentication Methods

The project needs the Cloud Text-to-Speech API enabled, with billing, as
Google's [setup page](https://docs.cloud.google.com/text-to-speech/docs/get-started)
describes. The provider reads no environment variables; `credentials` selects
the method.

#### Service Account Key File

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: '/path/to/service-account.json',
});
```

#### Service Account Key Object

For containers and serverless platforms that hold the key as a secret:

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: {
    client_email: 'service-account@my-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  },
});
```

#### API Key

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: {
    apiKey: 'AIza...',
  },
});
```

#### Application Default Credentials

Omitting `credentials` uses
[Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials):
`gcloud auth application-default login` locally, the file named by
`GOOGLE_APPLICATION_CREDENTIALS`, or the attached service account on Google
Cloud.

```typescript
await provider.initialize({
  projectId: 'my-project',
});
```

### Synthesize Speech

```typescript
const result = await provider.synthesize({
  text: 'Hello world, this is a test of Google Cloud Text to Speech.',
  voice: 'en-US-Wavenet-A', // optional; see Voice Selection
  includeSpeechMarks: true,
});

console.log('Audio:', result.audio); // Buffer
console.log('Speech marks:', result.speechMarks); // word timings
console.log('Synthesis time:', result.metadata.duration, 'seconds');
```

### List Available Voices

```typescript
// Get all voices
const voices = await provider.getVoices();

// Filter by language
const spanishVoices = await provider.getVoices({ language: 'es-ES' });

// Filter by gender
const femaleVoices = await provider.getVoices({ gender: 'female' });

// Filter by quality
const neuralVoices = await provider.getVoices({ quality: 'neural' });
```

`getVoices` passes `language` to Google and filters by gender and quality
locally. Quality follows the voice name: `Wavenet` is `neural`, `Studio` is
`premium`, and every other voice is `standard`.

### Speech Marks Example

```typescript
const result = await provider.synthesize({
  text: 'Hello world',
  includeSpeechMarks: true,
});

// result.speechMarks:
// [
//   { time: 0, type: 'word', start: 0, end: 5, value: 'Hello' },
//   { time: 420, type: 'word', start: 6, end: 11, value: 'world' }
// ]
```

### SSML Support

```typescript
const result = await provider.synthesize({
  text: `
    <speak>
      Hello, <break time="500ms"/> this is a test.
      <prosody rate="slow" pitch="+2st">
        I can speak slowly with higher pitch.
      </prosody>
    </speak>
  `,
  includeSpeechMarks: true,
});
```

The [TTS authoring guide](../../docs/accessibility/tts-authoring-guide.md#ssml-provider-support)
covers how much of authored SSML Google voices.

## Configuration

### GoogleCloudTTSConfig

```typescript
interface GoogleCloudTTSConfig {
  projectId: string;                    // Google Cloud project ID (required)
  credentials?:                         // omitted: Application Default Credentials
    | string                            // Path to a service account key file
    | {                                 // Service account key object
        client_email: string;
        private_key: string;
        project_id?: string;
      }
    | { apiKey: string };               // API key
  voiceType?: 'wavenet' | 'standard' | 'studio';  // default: 'wavenet'
  defaultVoice?: string;                // default: 'en-US-Wavenet-A'
  audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS';  // output encoding (default: 'MP3')
  enableLogging?: boolean;              // default: false
}
```

## Synthesis Behavior

- **Requests.** One SynthesizeSpeech call returns the audio and, with speech
  marks requested, the timepoints of the injected marks.
- **Output.** `audioEncoding` fixes the output for the instance: `MP3` returns
  `audio/mpeg`, `LINEAR16` `audio/wav`, `OGG_OPUS` `audio/ogg`. A request's
  `format` is only validated against `mp3`, `wav` and `ogg`. `sampleRate`
  defaults to 24000 Hz. The language code sent to Google comes from the voice
  name.
- **Prosody.** Plain text with a `rate` or `pitch` other than 1 is escaped and
  wrapped in `<prosody>`. Authored SSML goes to Google with its markup
  unchanged, so `rate` and `pitch` apply to plain text only. A Studio voice
  drops `pitch`.
- **Limits.** The provider accepts 5000 characters per request.
  `ServerTTSProvider` declares 3000, and the toolkit splits longer reads to fit,
  so requests from the browser stay under the provider's limit.

### Voice Selection

A request's `voice` wins. Without one, the provider picks a voice for the
request's `language` from Google's voice listing, preferring voices of the
configured `voiceType`, and falls back to `defaultVoice`; the core README's
[voice resolution](../tts-server-core/README.md#voice-resolution) section has the
matching rules.

### Speech Marks

Speech marks are on unless the request sets `includeSpeechMarks: false`, and are
word marks only.

1. The provider places a `<mark>` before each word: a run of letters, combining
   marks, digits and apostrophes, so accented words stay whole.
2. Google returns a timepoint for each mark.
3. The provider converts the timepoints to speech marks in milliseconds, sorted
   by time.

Plain-text offsets are UTF-16 indexes into the request text. Authored SSML keeps
its markup and takes marks in its text nodes, so its offsets index the SSML.
Entities are never read as words, and an element whose content the engine
replaces (`<sub>`, `<say-as>`, `<phoneme>`) takes one mark before its opening
tag, valued with its text.

Studio voices take no `<mark>` tags. A voice whose name contains `Studio`, or
one Google answers with its Studio `<mark>`-unsupported error, is synthesized as
audio only and returns `speechMarks: []`, so `ServerTTSProvider` reports no word
boundaries for it.

## Capabilities

| Feature | Support |
|---------|---------|
| Speech Marks | Word marks via SSML marks; none for Studio voices |
| SSML | Google's supported subset |
| Pitch Control | Plain text; none for Studio voices |
| Rate Control | Plain text, through `<prosody>` |
| Volume Control | Not supported |
| Max Text Length | 5000 characters |
| Audio Formats | MP3, WAV (LINEAR16), OGG (Opus) |
| Sample Rate | Per request (default 24000 Hz) |

The [provider comparison](../../docs/accessibility/tts-architecture.md#provider-comparison)
sets these against Polly and the custom transport.

## Cost

Current rates: <https://cloud.google.com/text-to-speech/pricing>

## Voices

Google's [voice list](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
names the voices per language and type; `getVoices()` returns those the project
can use. Names follow `{languageCode}-{voiceType}-{variant}`:

- `en-US-Wavenet-A`: US English, WaveNet (neural), variant A
- `es-ES-Standard-B`: Spanish (Spain), Standard, variant B
- `fr-FR-Studio-A`: French, Studio (premium), variant A

## Error Handling

```typescript
import { TTSError, TTSErrorCode } from '@pie-players/tts-server-core';

try {
  const result = await provider.synthesize({ text: 'Hello' });
} catch (error) {
  if (error instanceof TTSError) {
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    console.error('Provider:', error.providerId);

    // Handle specific error types
    if (error.code === TTSErrorCode.AUTHENTICATION_ERROR) {
      console.error('Check your Google Cloud credentials');
    } else if (error.code === TTSErrorCode.RATE_LIMIT_EXCEEDED) {
      console.error('Rate limit exceeded, retry after some time');
    }
  }
}
```

`synthesize` maps Google's gRPC status codes:

| Google failure | `TTSErrorCode` |
|----------------|----------------|
| `PERMISSION_DENIED` (7) | `AUTHENTICATION_ERROR` |
| `RESOURCE_EXHAUSTED` (8) | `RATE_LIMIT_EXCEEDED` |
| `INVALID_ARGUMENT` (3) | `INVALID_REQUEST` |
| Anything else, a response without audio included | `PROVIDER_ERROR` |

Every `getVoices` failure is a `PROVIDER_ERROR`. Request validation runs before
any Google call and throws a plain `Error`: empty text, text over 5000
characters, an unsupported format, or a rate or pitch out of range. A call
before `initialize` throws a plain `Error` too.

## Advanced Configuration

### Custom Audio Encoding

```typescript
await provider.initialize({
  projectId: 'my-project',
  audioEncoding: 'LINEAR16', // For WAV format
});
```

### Enable Debug Logging

```typescript
await provider.initialize({
  projectId: 'my-project',
  enableLogging: true, // Logs SSML detection and the marks injected and extracted
});
```

### Custom Sample Rate

```typescript
const result = await provider.synthesize({
  text: 'Hello',
  sampleRate: 48000, // 48kHz (default is 24kHz)
});
```

## License

MIT
