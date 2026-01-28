# @pie-players/pie-tts-polly

AWS Polly TTS provider for PIE Assessment Toolkit - High-quality text-to-speech with full SSML support.

> **Note:** This is an optional TTS provider. The assessment toolkit includes a browser-based TTS provider using Web Speech API as the default fallback.

## Features

- ✅ **Full SSML Support** - Prosody, breaks, emphasis, and all SSML tags
- ✅ **Neural Voices** - Natural-sounding speech with AWS Polly Neural engine
- ✅ **Multi-Language** - Support for 25+ languages
- ✅ **QTI 3.0 Compatible** - Perfect for accessibility catalogs
- ✅ **Streaming Audio** - Efficient audio playback with Web Audio API

## Installation

```bash
npm install @pie-players/pie-tts-polly
# or
bun add @pie-players/pie-tts-polly
```

## Prerequisites

You'll need AWS credentials with Polly access:
- AWS Access Key ID
- AWS Secret Access Key
- Appropriate IAM permissions for `polly:SynthesizeSpeech`

## Usage

### Basic Usage

```typescript
import { TTSService } from '@pie-players/pie-assessment-toolkit';
import { PollyTTSProvider } from '@pie-players/pie-tts-polly';

// Initialize TTS service with Polly
const ttsService = new TTSService();
await ttsService.initialize(new PollyTTSProvider({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  voiceId: 'Joanna', // Optional: default voice
  engine: 'neural'    // Optional: use neural engine
}));

// Speak plain text
await ttsService.speak("Hello, student!");

// Speak SSML
await ttsService.speak(`
  <speak>
    <prosody rate="medium">
      Welcome to the assessment.
      <break time="500ms"/>
      Please read each question carefully.
    </prosody>
  </speak>
`);
```

### With QTI 3.0 Accessibility Catalogs

```typescript
import {
  TTSService,
  AccessibilityCatalogResolver
} from '@pie-players/pie-assessment-toolkit';
import { PollyTTSProvider } from '@pie-players/pie-tts-polly';

// Initialize services
const ttsService = new TTSService();
await ttsService.initialize(new PollyTTSProvider({
  region: 'us-east-1',
  credentials: { /* ... */ }
}));

// Set up catalog resolver
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US'
);
ttsService.setCatalogResolver(catalogResolver);

// Speak with catalog support (uses pre-authored SSML)
await ttsService.speak(
  "Welcome to the assessment", // Fallback text
  {
    catalogId: 'welcome-message',
    language: 'en-US'
  }
);
```

## Configuration Options

### PollyTTSConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `region` | `string` | **Required** | AWS region (e.g., 'us-east-1') |
| `credentials` | `object` | Optional | AWS credentials (if not using IAM role) |
| `voiceId` | `VoiceId` | `'Joanna'` | Voice to use (see [Available Voices](#available-voices)) |
| `engine` | `'standard' \| 'neural'` | `'neural'` | Engine type (neural recommended) |
| `rate` | `number` | `1.0` | Speech rate (0.25 to 4.0) |
| `outputFormat` | `OutputFormat` | `'mp3'` | Audio format |
| `sampleRate` | `string` | `'24000'` | Sample rate in Hz |

### Credentials

The provider supports multiple credential methods:

1. **Explicit credentials** (as shown above)
2. **IAM roles** (when running on AWS infrastructure)
3. **Environment variables** (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
4. **AWS credential file** (~/.aws/credentials)

```typescript
// Using environment variables (recommended for production)
await ttsService.initialize(new PollyTTSProvider({
  region: process.env.AWS_REGION || 'us-east-1'
  // credentials auto-loaded from environment/IAM
}));
```

## Available Voices

### Neural Voices (Recommended)

| Voice | Language | Gender | Region |
|-------|----------|--------|--------|
| **Joanna** | English (US) | Female | US |
| **Matthew** | English (US) | Male | US |
| **Amy** | English (British) | Female | UK |
| **Brian** | English (British) | Male | UK |
| **Olivia** | English (Australian) | Female | AU |
| **Lupe** | Spanish (US) | Female | US |
| **Pedro** | Spanish (US) | Male | US |
| **Léa** | French | Female | FR |
| **Vicki** | German | Female | DE |

[See full list of voices](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html)

## SSML Support

Polly supports all standard SSML tags:

```xml
<speak>
  <!-- Prosody: rate, pitch, volume -->
  <prosody rate="slow" pitch="low" volume="loud">
    Slow, low-pitched, loud speech
  </prosody>

  <!-- Breaks/Pauses -->
  Read this. <break time="500ms"/> Then this.

  <!-- Emphasis -->
  This is <emphasis level="strong">very important</emphasis>.

  <!-- Say-As -->
  <say-as interpret-as="digits">12345</say-as>
  <say-as interpret-as="date" format="mdy">10/31/2024</say-as>

  <!-- Language switching -->
  <lang xml:lang="es-ES">Hola</lang>

  <!-- Phonemes -->
  You say <phoneme alphabet="ipa" ph="pɪˈkɑːn">pecan</phoneme>.
</speak>
```

[Full SSML reference](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html)

## Cost Considerations

AWS Polly pricing (as of 2024):
- **Standard voices**: $4.00 per 1 million characters
- **Neural voices**: $16.00 per 1 million characters
- **First 5 million characters per month free** (12 months for new AWS customers)

For typical assessment use:
- Average question: ~200 characters = $0.0032
- 1000 students × 50 questions = ~$160/month (neural voices)

**Tip:** Cache synthesized audio for frequently-used content to reduce costs.

## Browser Compatibility

| Browser | Web Audio API | Compatibility |
|---------|---------------|---------------|
| Chrome | ✅ Full | Fully supported |
| Firefox | ✅ Full | Fully supported |
| Safari | ✅ Full | Fully supported |
| Edge | ✅ Full | Fully supported |

## Error Handling

```typescript
try {
  await ttsService.speak("Hello, world!");
} catch (error) {
  if (error.name === 'AccessDeniedException') {
    console.error('AWS credentials invalid or insufficient permissions');
  } else if (error.name === 'ThrottlingException') {
    console.error('Rate limit exceeded');
  } else {
    console.error('TTS error:', error);
  }
}
```

## Comparison: Polly vs Browser TTS

| Feature | Polly | Browser (Web Speech API) |
|---------|-------|--------------------------|
| Voice Quality | ⭐⭐⭐⭐⭐ Neural | ⭐⭐⭐ Synthetic |
| SSML Support | ✅ Full | ⚠️ Limited/None |
| Cost | 💰 Pay per use | ✅ Free |
| Offline | ❌ Requires internet | ✅ Works offline |
| Latency | ~200-500ms | ~50-100ms |
| Consistency | ✅ Same across devices | ⚠️ Varies by OS |

**Recommendation:**
- **Use Polly** for production assessments with QTI 3.0 catalogs
- **Use Browser TTS** for development, demos, or offline scenarios

## Examples

See the [PIE Players example app](../../apps/example) for complete integration examples with QTI 3.0 assessments.

## License

MIT

## Links

- [PIE Assessment Toolkit](https://github.com/pie-framework/pie-players)
- [AWS Polly Documentation](https://docs.aws.amazon.com/polly/)
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0)
