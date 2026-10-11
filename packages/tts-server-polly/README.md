# @pie-players/tts-server-polly

`PollyServerProvider`, the AWS Polly provider for server-side text-to-speech
(TTS), built on `@pie-players/tts-server-core`. It returns audio together with
Polly's speech marks, the word timings that drive read-aloud highlighting in the
browser. This README covers the provider's configuration and behavior for
developers writing a host's TTS routes. The
[integration guide](./examples/INTEGRATION-GUIDE.md) builds those routes in
SvelteKit; the [AWS Polly setup guide](../../docs/accessibility/aws-polly-setup-guide.md)
covers credentials and the IAM policy; [TTS Architecture](../../docs/accessibility/tts-architecture.md)
covers the browser and server flow across packages.

The package runs on Node.js 20 or later.

## Installation

```bash
npm install @pie-players/tts-server-polly
```

## Usage

### Basic Setup

```typescript
import { PollyServerProvider } from '@pie-players/tts-server-polly';

const provider = new PollyServerProvider();

await provider.initialize({
  region: 'us-east-1',
  // Omit credentials to use the AWS SDK default credential chain (an IAM role).
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  engine: 'neural', // or 'standard'
  defaultVoice: 'Joanna',
});
```

`initialize` validates the config and creates the Polly client without calling
AWS. A missing `region` throws a `TTSError` with `INITIALIZATION_ERROR`.

### Synthesize Speech

```typescript
const result = await provider.synthesize({
  text: 'Hello world, this is a test of AWS Polly text to speech.',
  voice: 'Joanna', // optional; see Voice Selection
  includeSpeechMarks: true,
});

console.log('Audio:', result.audio); // Buffer
console.log('Speech marks:', result.speechMarks); // word timings
console.log('Synthesis time:', result.metadata.duration, 'seconds');
```

### List Available Voices

```typescript
// Voices for the configured engine
const voices = await provider.getVoices();

// Filter by language
const spanishVoices = await provider.getVoices({ language: 'es-ES' });

// Filter by gender
const femaleVoices = await provider.getVoices({ gender: 'female' });
```

`getVoices` asks Polly for the configured engine's voices, in the requested
language when one is given, and filters by gender and quality locally. Each
voice's `providerMetadata` carries Polly's `supportedEngines` and
`additionalLanguageCodes`.

### Speech Marks Example

```typescript
const result = await provider.synthesize({
  text: 'Hello world',
  includeSpeechMarks: true,
});

// result.speechMarks:
// [
//   { time: 0, type: 'word', start: 0, end: 5, value: 'Hello' },
//   { time: 340, type: 'word', start: 6, end: 11, value: 'world' }
// ]
```

`time` is milliseconds into the audio. `start` and `end` are UTF-16 indexes into
the request text, end exclusive; the provider re-anchors Polly's UTF-8 byte
offsets to them.

## Configuration

### PollyProviderConfig

```typescript
interface PollyProviderConfig {
  region: string;                    // AWS region (required)
  credentials?: {                    // omitted: AWS SDK default credential chain
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  engine?: 'neural' | 'standard';   // fixed per instance (default: 'neural')
  defaultVoice?: string;             // default: 'Joanna'
  enableLogging?: boolean;           // log SSML detection (default: false)
}
```

The provider reads no environment variables; the host passes region and
credentials in. The [setup guide](../../docs/accessibility/aws-polly-setup-guide.md)
lists the variables the demo routes read and the IAM role setup for production.

## Synthesis Behavior

- **Requests.** Each synthesis sends two SynthesizeSpeech requests in parallel,
  one for the audio and one for the speech marks. `includeSpeechMarks: false`
  skips the second.
- **Speech-mark types.** `providerOptions.speechMarkTypes` selects among `word`,
  `sentence` and `ssml`. Without it, or when it names none of them, Polly returns
  word marks.
- **Engine.** The engine is set at `initialize`, and a request cannot change it.
  A host that offers both engines runs one instance per engine.
- **Output.** `format: 'ogg'` returns Ogg Vorbis, `'pcm'` returns PCM, and
  anything else MP3; `'wav'` fails validation. `sampleRate` defaults to 24000 Hz.
  `contentType` is the one Polly reports, `audio/mpeg` when it reports none.
- **SSML and prosody.** Text containing SSML tags, Polly's `<amazon:…>` and
  `<aws-…>` extensions included, goes to Polly unchanged. Plain text with a
  `rate` or `pitch` other than 1 is escaped and wrapped in `<speak><prosody>`,
  so the two apply to plain text only. A `rate` above 2 speaks at 2, Polly's
  200% ceiling. The neural engine drops `pitch`.

### Voice Selection

A request's `voice` wins. Without one, the provider picks a voice for the
request's `language` from the engine's voice listing and falls back to
`defaultVoice`; the core README's [voice resolution](../tts-server-core/README.md#voice-resolution)
section has the matching rules.

## Capabilities

| Feature | Support |
|---------|---------|
| Speech Marks | Word, sentence and SSML marks |
| SSML | Polly's supported subset |
| Pitch Control | Standard engine only; plain text |
| Rate Control | Plain text, through `<prosody>`; up to 2× |
| Volume Control | Not supported |
| Max Text Length | 3000 characters |
| Audio Formats | MP3, Ogg Vorbis, PCM |
| Sample Rate | Per request (default 24000 Hz) |

## Cost

Polly bills each SynthesizeSpeech request by characters; a synthesis with speech
marks makes two (audio and marks). Current rates:
<https://aws.amazon.com/polly/pricing/>

## Voices

Polly's [voice list](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)
names each voice and the engines it supports; `getVoices()` returns the voices
available to the configured engine. A voice the engine does not support fails
with `INVALID_REQUEST`.

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
  }
}
```

AWS failures from `synthesize` and `getVoices` arrive as a `TTSError`:

| AWS failure | `TTSErrorCode` |
|-------------|----------------|
| `TextLengthExceededException` | `TEXT_TOO_LONG` |
| Invalid SSML, sample rate, language, engine, speech-mark, lexicon or S3/SNS input; `ValidationException` | `INVALID_REQUEST` |
| `ThrottlingException`, `ServiceQuotaExceededException`, HTTP 429 | `RATE_LIMIT_EXCEEDED` |
| HTTP 401 or 403 | `AUTHENTICATION_ERROR` |
| Anything else | `PROVIDER_ERROR` |

Request validation runs before any AWS call and throws a plain `Error`: empty
text, text over 3000 characters, an unsupported format, or a rate or pitch out
of range. A call before `initialize` throws a plain `Error` too.

## AWS IAM Permissions

The provider needs `polly:SynthesizeSpeech` and `polly:DescribeVoices`. The
[AWS Polly Setup Guide](../../docs/accessibility/aws-polly-setup-guide.md) has the
policy and the credential setup.

## License

MIT
