# @pie-players/tts-server-polly

AWS Polly provider for server-side text-to-speech with native speech marks support.

## Overview

This package provides a server-side TTS provider that uses AWS Polly to generate high-quality neural speech with millisecond-precise word timing through speech marks.

## Features

- ✅ **Native Speech Marks** - Millisecond-accurate word timing from AWS Polly
- ✅ **Neural Voices** - High-quality neural TTS (default) or standard voices
- ✅ **25+ Languages** - Wide language support
- ✅ **Full SSML** - Supports Speech Synthesis Markup Language
- ✅ **Parallel Requests** - Audio and speech marks fetched simultaneously
- ✅ **60+ Voices** - Multiple voices per language

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
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  engine: 'neural', // or 'standard'
  defaultVoice: 'Joanna',
});
```

### Synthesize Speech

```typescript
const result = await provider.synthesize({
  text: 'Hello world, this is a test of AWS Polly text to speech.',
  voice: 'Joanna', // Optional, uses defaultVoice if not specified
  includeSpeechMarks: true,
});

console.log('Audio:', result.audio); // Buffer
console.log('Speech marks:', result.speechMarks); // Array of word timings
console.log('Duration:', result.metadata.duration, 'seconds');
```

### List Available Voices

```typescript
// Get all neural voices
const voices = await provider.getVoices();

// Filter by language
const spanishVoices = await provider.getVoices({ language: 'es-ES' });

// Filter by gender
const femaleVoices = await provider.getVoices({ gender: 'female' });
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
//   { time: 340, type: 'word', start: 6, end: 11, value: 'world' }
// ]
```

## Configuration

### PollyProviderConfig

```typescript
interface PollyProviderConfig {
  region: string;                    // AWS region (required)
  credentials?: {                    // AWS credentials (optional if using IAM)
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  engine?: 'neural' | 'standard';   // Voice engine (default: 'neural')
  defaultVoice?: string;             // Default voice ID (default: 'Joanna')
}
```

### Environment Variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Capabilities

| Feature | Support |
|---------|---------|
| Speech Marks | ✅ Native |
| SSML | ✅ Full |
| Pitch Control | ⚠️ SSML only |
| Rate Control | ✅ SSML |
| Volume Control | ❌ Client-side |
| Max Text Length | 3000 chars |
| Audio Format | MP3 |

## Cost

- **Standard voices:** $4 per 1M characters
- **Neural voices:** $16 per 1M characters
- **Speech marks:** Included (no extra charge)

## Supported Voices

Popular voices include:

- **English (US):** Joanna, Matthew, Ivy, Kendra, Joey
- **English (UK):** Amy, Brian, Emma
- **Spanish:** Lucia, Conchita, Enrique
- **French:** Celine, Mathieu
- **German:** Marlene, Hans
- **Italian:** Carla, Giorgio
- **Portuguese:** Vitoria, Ricardo

Use `getVoices()` for complete list.

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

## AWS IAM Permissions

Required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    }
  ]
}
```

## License

MIT
