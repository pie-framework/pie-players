# @pie-players/tts-server-core

The shared contract for server-side text-to-speech (TTS) providers: the provider
interface and base class, the request, response and speech-mark types, the error
codes, a cache interface and the speech-mark utilities. It is for developers
writing a provider, and for host developers whose TTS routes call the bundled
ones: [AWS Polly](../tts-server-polly/README.md),
[Google Cloud](../tts-server-google/README.md) and the
[SC adapter](../tts-server-sc/README.md).
[TTS Architecture](../../docs/accessibility/tts-architecture.md) covers the
browser and server flow across packages.

The package runs on Node.js 20 or later.

## Installation

```bash
npm install @pie-players/tts-server-core
```

## Provider Contract

`ITTSServerProvider` is the interface a route calls; `BaseTTSProvider`
implements its shared parts.

| Member | Contract |
|--------|----------|
| `providerId`, `providerName`, `version` | Identity; `providerId` appears in `metadata`, cache keys and errors |
| `initialize(config)` | Validates the config and creates the vendor client. The bundled providers make no network call here; a failure throws `INITIALIZATION_ERROR` |
| `synthesize(request)` | Returns audio, speech marks and metadata |
| `getVoices(options?)` | Lists voices, filtered by language, gender and quality |
| `getCapabilities()` | Synchronous feature flags and limits |
| `destroy()` | Clears the provider's state; the base class resets `initialized`, the config and the cached voice listing |

`TTSServerConfig` is an open record; each provider declares its own config type.
Vendor failures throw a [`TTSError`](#errors) with a code, so a route can map
them to statuses. Request validation and a call before `initialize` throw a plain
`Error`.

### Implementing a Provider

```typescript
import {
  BaseTTSProvider,
  TTSError,
  TTSErrorCode,
  type ServerProviderCapabilities,
  type SynthesizeRequest,
  type SynthesizeResponse,
  type TTSServerConfig,
  type Voice,
} from '@pie-players/tts-server-core';

export class MyTTSProvider extends BaseTTSProvider {
  readonly providerId = 'my-tts';
  readonly providerName = 'My TTS Service';
  readonly version = '1.0.0';

  async initialize(config: TTSServerConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  async synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse> {
    this.ensureInitialized();
    this.validateRequest(request, this.getCapabilities());

    const voice = await this.resolveRequestVoice(request, 'default');
    const started = Date.now();

    try {
      const audio = await myEngine.synthesize(request.text, voice);

      return {
        audio,
        contentType: 'audio/mpeg',
        // An engine without word timings returns none.
        speechMarks: [],
        metadata: {
          providerId: this.providerId,
          voice,
          duration: (Date.now() - started) / 1000,
          charCount: request.text.length,
          cached: false,
        },
      };
    } catch (err) {
      throw new TTSError(
        TTSErrorCode.PROVIDER_ERROR,
        `My TTS error: ${err instanceof Error ? err.message : String(err)}`,
        { error: err },
        this.providerId,
      );
    }
  }

  async getVoices(): Promise<Voice[]> {
    return myEngine.listVoices();
  }

  getCapabilities(): ServerProviderCapabilities {
    return {
      standard: {
        supportsSSML: false,
        supportsPitch: false,
        supportsRate: true,
        supportsVolume: false,
        supportsMultipleVoices: true,
        maxTextLength: 3000,
      },
      extensions: {
        supportsSpeechMarks: false,
        supportedFormats: ['mp3'],
        supportsSampleRate: false,
      },
    };
  }
}
```

## Base Class Helpers

`BaseTTSProvider` gives subclasses these protected helpers:

| Helper | Behavior |
|--------|----------|
| `ensureInitialized()` | Throws a plain `Error` before `initialize` has run |
| `validateRequest(request, capabilities)` | Throws a plain `Error` for empty text, text over `maxTextLength`, a `format` outside `supportedFormats`, `rate` outside 0.25–4.0, `pitch` outside 0–2 or `volume` outside 0–1 |
| `resolveRequestVoice(request, defaultVoice, prefer?)` | Picks the voice for a request; see [Voice Resolution](#voice-resolution) |
| `detectSSML(text, extraTags?)` | True when the text contains `<speak`, `<prosody`, `<emphasis`, `<break`, `<phoneme`, `<say-as`, `<mark` or one of the provider's extra tags |
| `escapeSSML(text)` | Escapes `&`, `<`, `>`, `"` and `'` |
| `buildProsodyAttrs(request)` | `rate` as `rate="N%"` and `pitch` as a signed relative percentage (1.2 is `+20%`); a value of 1, or none, adds nothing |
| `applyProsody(text, request, extraSsmlTags?)` | Returns SSML input unchanged; wraps plain text in `<speak><prosody>` with the escaped text when `buildProsodyAttrs` has attributes; otherwise returns the text as is. The result says whether it is SSML |

### Voice Resolution

`resolveRequestVoice` gives every provider the same rules:

1. A request's `voice` wins.
2. Without a `language`, the result is `defaultVoice`.
3. Otherwise the provider's `getVoices()` listing is fetched once per instance
   and reused. A failed listing returns `defaultVoice` and is retried on the
   next request.
4. Candidates are the voices whose language code matches the request's tag
   exactly, ignoring case; with none, those that share its primary subtag
   (`es` for `es-MX`).
5. `defaultVoice` wins when it is a candidate. Otherwise the first candidate
   `prefer` accepts, else the first candidate; with no candidate at all,
   `defaultVoice`.

## Requests and Responses

`SynthesizeRequest` combines the standard parameters (`StandardTTSParameters`,
`text` through `volume`) with the provider extensions (`TTSProviderExtensions`):

| Field | Meaning |
|-------|---------|
| `text` | Plain text or SSML |
| `voice` | Provider voice id |
| `language` | BCP 47 tag, such as `en-US` |
| `rate` | Speed multiplier, 0.25–4.0, default 1 |
| `pitch` | Pitch multiplier, 0–2, default 1 |
| `volume` | 0–1, default 1 |
| `format` | `mp3`, `wav`, `ogg` or `pcm`, as the provider's `supportedFormats` allow |
| `sampleRate` | Hz |
| `includeSpeechMarks` | Word timings; on unless `false` |
| `providerOptions` | Provider-specific options, such as Polly's `speechMarkTypes` |

`SynthesizeResponse` carries `audio` (`SynthesizedAudioBytes`, a Node.js
`Buffer` from the bundled providers, or a base64 string), `contentType`,
`speechMarks` and `metadata` (`SynthesizeMetadata`): `providerId`, `voice`,
`duration`, `charCount`, `cached` and an optional `timestamp`. `duration` is
the seconds the provider took to synthesize; the audio's length is not
reported.

`getVoices` returns `Voice` records: `id`, `name`, `language` (the language's
name), `languageCode`, `gender`, `quality` (`standard`, `premium` or `neural`),
`supportedFeatures` (`VoiceFeatures`: SSML, emotions, styles) and
`providerMetadata`. `GetVoicesOptions` filters on `language`, `quality` and
`gender`.

`ServerProviderCapabilities` splits into `standard` (SSML, pitch, rate, volume,
multiple voices, `maxTextLength`) and `extensions` (`supportsSpeechMarks`,
`supportedFormats`, `supportsSampleRate`, an open `providerSpecific` record).

## Speech Marks

All providers return speech marks in one format:

```typescript
interface SpeechMark {
  time: number;      // milliseconds from audio start
  type: 'word' | 'sentence' | 'ssml';
  start: number;     // UTF-16 index into the request text (inclusive)
  end: number;       // UTF-16 index into the request text (exclusive)
  value: string;     // the word or text
}
```

```json
[
  { "time": 0, "type": "word", "start": 0, "end": 5, "value": "Hello" },
  { "time": 340, "type": "word", "start": 6, "end": 11, "value": "world" }
]
```

Two utilities bring vendor offsets to this format:

- `anchorSpeechMarks(marks, requestText)` re-derives `start` and `end` from
  where each mark's `value` occurs in the request text, in time order and per
  mark type. A mark whose value is not found near its predicted offset keeps
  that offset. It is idempotent on offsets that already index the text. Polly
  uses it to convert UTF-8 byte offsets, and `ServerTTSProvider` applies it to
  every PIE-transport response.
- `normalizeSpeechMarks(raw, requestText)` parses a JSONL word-mark response
  (one mark object per line), keeps word marks, converts a timeline in seconds
  to milliseconds, anchors the offsets and clamps them to the text. The SC
  adapter and the custom transport of `ServerTTSProvider` use it.

## Errors

`TTSError(code, message, details?, providerId?)` is the structured error;
`toJSON()` returns `{ error: { code, message, details, provider } }`.

| `TTSErrorCode` | Meaning |
|----------------|---------|
| `INVALID_REQUEST` | The vendor rejected the request's input |
| `TEXT_TOO_LONG` | The vendor rejected the text's length |
| `AUTHENTICATION_ERROR` | Credentials missing, invalid or not permitted |
| `RATE_LIMIT_EXCEEDED` | Throttled or over quota |
| `INITIALIZATION_ERROR` | `initialize` failed |
| `PROVIDER_ERROR` | Any other vendor failure |
| `INVALID_VOICE`, `INVALID_PROVIDER`, `NETWORK_ERROR` | Defined for provider and route authors; no package in this repository raises them |

`resolveTTSErrorCodeForHttpStatus(status)` maps an HTTP status for a provider
over a REST API: 401 and 403 to `AUTHENTICATION_ERROR`, 429 to
`RATE_LIMIT_EXCEEDED`, 400 to `INVALID_REQUEST`, anything else to
`PROVIDER_ERROR`.

## Caching

`ITTSCache` is the cache interface: `get`, `set(key, value, ttlSeconds?)`,
`has`, `delete`, `clear` and an optional `getStats` returning `CacheStats` (hits,
misses, hit rate, key count).

```typescript
import { MemoryCache, generateHashedCacheKey } from '@pie-players/tts-server-core';

const cache = new MemoryCache();

const cacheKey = await generateHashedCacheKey({
  providerId: 'my-tts',
  text: 'Hello world',
  voice: 'default',
});

// Serve a hit; otherwise synthesize and store the result for 24 hours.
const result =
  (await cache.get(cacheKey)) ?? (await provider.synthesize(request));
if (!result.metadata.cached) {
  await cache.set(cacheKey, result, 86400);
}
```

`generateHashedCacheKey` takes `CacheKeyComponents` and returns
`tts:<providerId>:<voice>:<language>:<rate>:<format>:<sha256 of text>`, with
`language` empty, `rate` 1.00 (two decimals) and `format` `mp3` when unset. A
route whose output varies with more fields appends them; the Polly integration
guide's [caching step](../tts-server-polly/examples/INTEGRATION-GUIDE.md#step-5-add-redis-caching-optional)
adds engine, sample rate and speech-mark types and stores responses in Redis.

`MemoryCache` is a bounded LRU in one process's heap, for development and
testing. It holds 100 entries by default (the constructor's `maxSize`), keeps
entries for 24 hours unless `set` gives a TTL, and marks a hit's
`metadata.cached` true. An insertion at capacity scans every entry, dropping
expired ones first, then the least recently used. The cache is lost on restart,
and each replica of a scaled deployment fills its own; a production host
implements `ITTSCache` over shared storage.

## Rate Buckets

`resolveSpeedRateBucket(rate, fallback = 'medium')` maps a rate multiplier to a
`SpeedRateBucket`, the three-value speed some backends take in place of a
continuous rate: at most 0.95 is `slow`, at least 1.5 is `fast`, anything
between is `fallback`. The custom transport of `ServerTTSProvider` derives its
`speedRate` field with it unless the host sets a bucket.

## License

MIT
