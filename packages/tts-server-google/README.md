# @pie-players/tts-server-google

Google Cloud Text-to-Speech provider for server-side text-to-speech with speech marks support.

For the cross-package TTS architecture and browser/server flow, see
[TTS Architecture](../../docs/accessibility/tts-architecture.md). This README
focuses on Google Cloud provider configuration and behavior.

## Overview

This package provides a server-side TTS provider that uses Google Cloud Text-to-Speech to generate high-quality neural speech with millisecond-precise word timing through SSML mark injection.

## Features

- **Speech Marks Support** - Millisecond-accurate word timing via SSML marks + timepoints (Standard and WaveNet voices; Studio voices return none)
- **WaveNet Neural Voices** - High-quality neural TTS with Google's WaveNet technology
- **SSML** - Google's supported subset
- **Single API Call** - Audio and speech marks in one request
- **Voice Types** - Standard, WaveNet and Studio
- **Flexible Authentication** - Service account, API key, or Application Default Credentials

## Installation

```bash
npm install @pie-players/tts-server-google
```

## Usage

For a server route that wires this provider into an application, see the
[integration guide](./examples/INTEGRATION-GUIDE.md).

### Basic Setup

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';

const provider = new GoogleCloudTTSProvider();

await provider.initialize({
  projectId: 'my-gcp-project',
  credentials: '/path/to/service-account.json', // Or use other auth methods
  voiceType: 'wavenet', // 'wavenet', 'standard', or 'studio' (Studio returns no speech marks)
  defaultVoice: 'en-US-Wavenet-A',
});
```

### Authentication Methods

#### 1. Service Account JSON File (Recommended for Production)

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: '/path/to/service-account.json',
});
```

#### 2. Service Account Object (For Containers/Serverless)

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: {
    client_email: 'service-account@my-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  },
});
```

#### 3. API Key (For Simple Applications)

```typescript
await provider.initialize({
  projectId: 'my-project',
  credentials: {
    apiKey: 'AIza...',
  },
});
```

#### 4. Application Default Credentials (For Local Development)

```typescript
// Omit credentials to use gcloud auth application-default login
await provider.initialize({
  projectId: 'my-project',
});
```

### Synthesize Speech

```typescript
const result = await provider.synthesize({
  text: 'Hello world, this is a test of Google Cloud Text to Speech.',
  voice: 'en-US-Wavenet-A', // Optional, uses defaultVoice if not specified
  includeSpeechMarks: true,
});

console.log('Audio:', result.audio); // Buffer
console.log('Speech marks:', result.speechMarks); // Array of word timings
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

## Configuration

### GoogleCloudTTSConfig

```typescript
interface GoogleCloudTTSConfig {
  projectId: string;                    // Google Cloud project ID (required)
  credentials?:                         // Authentication (optional if using ADC)
    | string                            // Path to service account JSON
    | {                                 // Service account object
        client_email: string;
        private_key: string;
      }
    | { apiKey: string };               // API key
  voiceType?: 'wavenet' | 'standard' | 'studio';  // Voice type (default: 'wavenet')
  defaultVoice?: string;                // Default voice (default: 'en-US-Wavenet-A')
  audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS';  // Audio format (default: 'MP3')
  enableLogging?: boolean;              // Debug logging (default: false)
}
```

### Environment Variables

```bash
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Capabilities

| Feature | Support |
|---------|---------|
| Speech Marks | Via SSML marks; none for Studio voices |
| SSML | Google's supported subset |
| Pitch Control | SSML; none for Studio voices |
| Rate Control | SSML |
| Volume Control | Client-side |
| Max Text Length | 5000 chars |
| Audio Formats | MP3, WAV, OGG |

## Cost

Current rates: <https://cloud.google.com/text-to-speech/pricing>

## Supported Voices

Popular voices include:

### Standard Voices
- **English (US):** en-US-Standard-A/B/C/D/E/F/G/H/I/J
- **English (UK):** en-GB-Standard-A/B/C/D/F
- **Spanish:** es-ES-Standard-A/B/C/D
- **French:** fr-FR-Standard-A/B/C/D/E
- **German:** de-DE-Standard-A/B/C/D/E/F
- **Italian:** it-IT-Standard-A/B/C/D
- **Portuguese:** pt-BR-Standard-A/B/C

### WaveNet (Neural) Voices
- **English (US):** en-US-Wavenet-A/B/C/D/E/F/G/H/I/J
- **English (UK):** en-GB-Wavenet-A/B/C/D/F
- **Spanish:** es-ES-Wavenet-B/C/D
- **French:** fr-FR-Wavenet-A/B/C/D/E
- **German:** de-DE-Wavenet-A/B/C/D/E/F
- **Italian:** it-IT-Wavenet-A/B/C/D
- **Portuguese:** pt-BR-Wavenet-A/B/C

### Studio Voices
- **English (US):** en-US-Studio-O/Q
- **English (UK):** en-GB-Studio-B/C

Studio voices take no SSML `<mark>` tags, so a Studio voice is synthesized as
audio only and returns `speechMarks: []`, so `ServerTTSProvider` reports no word boundaries for it.
They take no `<prosody pitch>` either: a Studio request applies `rate` and drops
`pitch`, and `supportsPitch` is false when `voiceType` is `'studio'`.

Use `getVoices()` for the complete list.

## Voice Naming Convention

Google Cloud voices follow the pattern: `{languageCode}-{voiceType}-{variant}`

Examples:
- `en-US-Wavenet-A` - US English, WaveNet (neural), variant A
- `es-ES-Standard-B` - Spanish (Spain), Standard, variant B
- `fr-FR-Studio-A` - French, Studio (premium), variant A

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

## Google Cloud IAM Permissions

Required IAM permissions for the service account:

```json
{
  "role": "roles/cloudtexttospeech.user",
  "permissions": [
    "texttospeech.operations.get",
    "texttospeech.voices.list",
    "texttospeech.voices.synthesize"
  ]
}
```

Or use the predefined role:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudtexttospeech.user"
```

## Comparison with AWS Polly

| Feature | Google Cloud TTS | AWS Polly |
|---------|------------------|-----------|
| **Speech Marks** | Via SSML marks | Native |
| **API Calls** | Single call | Two parallel calls |
| **Max Text** | 5000 chars | 3000 chars |

## How Speech Marks Work

Unlike AWS Polly (which provides native speech marks), Google Cloud TTS requires SSML mark injection:

1. The provider automatically parses your text and injects `<mark>` tags before each word
2. Google Cloud TTS returns timepoints corresponding to these marks
3. The provider converts timepoints to the unified speech mark format

Speech marks are on unless the request sets `includeSpeechMarks: false`. A voice
whose name contains `Studio`, or one Google answers with its Studio
`<mark>`-unsupported error, is synthesized as audio only and returns
`speechMarks: []`.

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
  enableLogging: true, // Logs SSML injection and speech marks extraction
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
