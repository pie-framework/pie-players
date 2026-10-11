# AWS Polly Integration Guide

This integration guide builds the server half of server-backed text-to-speech
(TTS) in a SvelteKit host: the routes that `@pie-players/tts-client-server`
calls on its PIE transport, backed by AWS Polly through
`@pie-players/tts-server-polly`. It is for host developers adding read-aloud
with word highlighting.

The package layering and provider fallback are in
[TTS Architecture](../../../docs/accessibility/tts-architecture.md); the client
provider and its request and response shapes, in the
[`@pie-players/tts-client-server` README](../../tts-client-server/README.md).
The [AWS Polly setup guide](../../../docs/accessibility/aws-polly-setup-guide.md)
owns the AWS side: the IAM policy, access keys and production roles.

## Architecture

```
Browser (Client)
    ↓
ServerTTSProvider (@pie-players/tts-client-server)
    ↓ HTTP POST
SvelteKit API Route (/api/tts/synthesize/+server.ts)
    ↓
PollyServerProvider (@pie-players/tts-server-polly)
    ↓
AWS Polly API (audio + speech marks)
```

The synthesize route returns base64 audio with the speech marks inline. A voices
route answers the client's readiness probe, which runs before the toolkit
reports server TTS ready; when the probe fails, the toolkit falls back to
browser TTS.

## Step 1: Install Packages

```bash
bun add @pie-players/tts-server-core @pie-players/tts-server-polly @pie-players/tts-client-server
```

## Step 2: Configure Environment Variables

Create or update `.env`:

```bash
# AWS Polly
AWS_REGION=us-east-1

# Optional: an access key pair. Leave both unset to use the AWS SDK's default
# credential chain instead.
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
# Optional: set alongside the pair when it is temporary
AWS_SESSION_TOKEN=

# Optional: Redis for caching (Step 5)
REDIS_URL=redis://localhost:6379
```

The routes pass credentials to Polly only when both `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` are set, with `AWS_SESSION_TOKEN` when it is set too. One
of the pair alone is ignored. Without the pair the provider gets no credentials,
and the AWS SDK resolves them through its
[default credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html),
which tries environment variables, SSO and shared profiles before the IAM role of
the container or instance.

The routes read `process.env`. A `.env` file reaches SvelteKit's `$env/*` modules
and never `process.env`, so in a SvelteKit app replace `process.env` with `env`
from `$env/dynamic/private`. Use the dynamic module because `$env/static/private`
fails the build when a variable it imports is unset, and these are optional.

The [setup guide](../../../docs/accessibility/aws-polly-setup-guide.md) creates
the IAM user, its minimal policy and the keys. Keep `.env` and `.env.local` out
of version control.

## Step 3: Create SvelteKit API Routes

### Copy the Routes

| Copy | To |
|---|---|
| [`sveltekit/synthesize-server.ts`](sveltekit/synthesize-server.ts) | `src/routes/api/tts/synthesize/+server.ts` |
| [`sveltekit/voices-server.ts`](sveltekit/voices-server.ts) | `src/routes/api/tts/voices/+server.ts` |

Each file is self-contained. With both in one app, move everything above the
handler into `src/lib/server/tts.ts` and import it from both routes: the guards,
the status mapping, the credentials and the provider map. The guards then have
one implementation, and the routes share one provider per engine.

### Guards (required)

Both routes reach AWS on every request. Without an auth check and a rate limit
they are open, unmetered proxies to your Polly account: whoever can reach the URL
spends your budget, and the 3000-character cap bounds one request rather than the
number of them. `requireAuthenticatedCaller` and `enforceRateLimit` reject every
request with a 503 until you replace their bodies; keep their call sites.
[Authentication](#authentication-required) and
[Rate Limiting](#rate-limiting-required) sketch implementations.

### Synthesize Request

`POST /api/tts/synthesize` takes a JSON object, the body `ServerTTSProvider` sends
on its default `pie` transport. The client takes `engine` from its config, and
`format`, `sampleRate` and `speechMarkTypes` from its `providerOptions`.

Only `text` is required. A field of the wrong type or out of range is a 400 before
anything reaches AWS, and `null` counts as absent.

| Field | Accepts | Polly receives |
|---|---|---|
| `text` | 1–3000 characters | the text, as SSML when it contains SSML tags |
| `voice` | a Polly voice id, e.g. `Joanna` | that voice; without one, a voice for `language`, else `Joanna` |
| `language` | a BCP 47 tag, e.g. `es-US` | nothing directly: it picks the voice when `voice` is absent |
| `engine` | `neural` (default), `standard` | the engine, through the provider initialized for it |
| `rate` | 0.25–4 | `<prosody rate>` around plain text, capped at Polly's 200% |
| `pitch` | 0–2 | `<prosody pitch>` around plain text, on the standard engine only |
| `format` | `mp3` (default), `ogg`, `pcm` | `OutputFormat` |
| `sampleRate` | a positive integer, in Hz | `SampleRate`, default 24000; `pcm` takes only 8000 and 16000 |
| `includeSpeechMarks` | boolean, default `true` | a second request, for the speech marks |
| `speechMarkTypes` | a list of `word`, `sentence`, `ssml` | `SpeechMarkTypes`, default `["word"]` |

`provider` is accepted and ignored, since the route serves only Polly. `volume`
is not read: the provider has no volume control (`supportsVolume: false`).

The response:

```json
{
  "audio": "<base64>",
  "contentType": "audio/mpeg",
  "speechMarks": [{ "time": 0, "type": "word", "start": 0, "end": 5, "value": "Hello" }],
  "metadata": {
    "providerId": "aws-polly",
    "voice": "Joanna",
    "duration": 0.41,
    "charCount": 11,
    "cached": false,
    "timestamp": "2026-10-10T12:00:00.000Z"
  }
}
```

### Voices Request

`GET /api/tts/voices` returns `{ "voices": [...] }`. Its query parameters are
optional; an empty one counts as absent, and a value outside the list is a 400.

| Parameter | Accepts | Effect |
|---|---|---|
| `engine` | `neural` (default), `standard` | lists that engine's voices |
| `language` | a Polly language code, e.g. `en-US` | Polly's `LanguageCode` filter |
| `gender` | `male`, `female`, `neutral` | keeps voices of that gender |
| `quality` | `standard`, `premium`, `neural` | keeps voices whose `quality` matches; every voice carries its engine's name there, so this keeps all or none |

## Step 4: Configure the Client

With the toolkit, server TTS is one provider entry:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'server',
      serverProvider: 'polly',
    },
  },
}
```

Its defaults, `apiEndpoint: '/api/tts'` and the voices probe, match the routes
above; [Minimal Server-Backed TTS Config](../../assessment-toolkit/README.md#minimal-server-backed-tts-config)
lists them, and [Configuring Tools](../../../docs/tools-and-accomodations/tool_provider_system.md)
covers provider configuration in general. A host without the toolkit constructs
`ServerTTSProvider` directly, as the
[client README](../../tts-client-server/README.md#basic-setup) shows.

## Step 5: Add Redis Caching (Optional)

A cache in front of Polly answers repeat reads of the same text without a
synthesis call. A single-process host can use `MemoryCache` from
`@pie-players/tts-server-core`; each replica keeps its own copy, so a scaled
deployment shares one cache through Redis.

```bash
bun add ioredis
```

Add this to the copied synthesize route, and in `POST` replace the
`polly.synthesize` call and the `return json(...)` after it with
`return json(await synthesizeCached(polly, engine, request));`.

```typescript
import {
  generateHashedCacheKey,
  type SynthesizeRequest,
} from '@pie-players/tts-server-core';
import type { PollyServerProvider } from '@pie-players/tts-server-polly';
import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/** The response body, from Redis when an identical request was served before. */
async function synthesizeCached(
  polly: PollyServerProvider,
  engine: string,
  request: SynthesizeRequest,
) {
  // The text slot hashes the whole request, so the fields the other slots do
  // not name (pitch, sample rate, speech mark types) still change the key.
  const cacheKey = await generateHashedCacheKey({
    providerId: `aws-polly:${engine}`,
    text: JSON.stringify(request),
    voice: request.voice || 'default',
    language: request.language,
    rate: request.rate,
    format: request.format,
  });

  // A cache failure is logged and falls through to Polly.
  const cached = await redis?.get(cacheKey).catch((cacheError) => {
    console.warn('[TTS API] Cache read error:', cacheError);
    return null;
  });
  if (cached) {
    const response = JSON.parse(cached);
    return { ...response, metadata: { ...response.metadata, cached: true } };
  }

  const result = await polly.synthesize(request);
  const response = {
    audio:
      typeof result.audio === 'string'
        ? result.audio
        : result.audio.toString('base64'),
    contentType: result.contentType,
    speechMarks: result.speechMarks,
    metadata: result.metadata,
  };

  await redis
    ?.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(response))
    .catch((cacheError) => console.warn('[TTS API] Cache write error:', cacheError));
  return response;
}
```

The cache key has the form below. The readable slots name the engine, voice,
language, rate and format; two requests share a key only when every field
matches, since the hash covers the whole request.

```
tts:aws-polly:neural:Joanna:en-US:1.00:mp3:<sha256-hash-of-request>
```

## Step 6: Test the Integration

The guard stubs from Step 3 answer 503 until you implement them. With the guards
in place, send whatever credential they check:

```bash
curl -X POST http://localhost:5173/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Hello world", "voice": "Joanna"}'

curl -H "Authorization: Bearer <token>" "http://localhost:5173/api/tts/voices?language=en-US"
```

A working synthesize route returns `audio`, `contentType`, `speechMarks` and
`metadata`.

## Security Considerations

### Credentials

- AWS credentials stay on the server; the browser never sees them.
- In production, leave the key pair unset and give the container or instance an
  IAM role: the routes then pass no credentials, and the SDK's default chain
  finds the role.
- An access key pair in the environment is for local development and for hosts
  without a role.

### Error Responses

The provider reports every AWS failure as a `TTSError`, and the routes pick the
status by its `code`. The body carries a fixed message per status, and the error
itself goes to the server log: AWS SDK error strings can name the region, an
ARN, or the shape of the credential that failed, so forwarding `err.message`
hands that to whoever probes the endpoint.

| `TTSErrorCode` | Status | `message` |
|---|---|---|
| `INVALID_REQUEST`, `INVALID_VOICE`, `TEXT_TOO_LONG` | 400 | Text-to-speech cannot read this request. |
| `RATE_LIMIT_EXCEEDED` | 429 | Text-to-speech is busy. Please try again shortly. |
| `AUTHENTICATION_ERROR`, `INITIALIZATION_ERROR`, `NETWORK_ERROR`, `PROVIDER_ERROR` | 503 | Text-to-speech is unavailable. |
| `INVALID_PROVIDER`, and any error that is not a `TTSError` | 500 | Text-to-speech is unavailable. |

Polly reports a missing credential chain and a network failure as
`PROVIDER_ERROR`, and a request outside its limits (blank or over-length text,
an unsupported format, a rate or pitch out of range) as `TEXT_TOO_LONG` or
`INVALID_REQUEST`. The guards and the routes' type checks on the body raise
their own 503 and 400 before the provider is called. `STATUS_BY_CODE` is a `Record` over
`TTSErrorCode`, so a code added to `@pie-players/tts-server-core` fails the type
check until it is mapped.

### Authentication (required)

`requireAuthenticatedCaller` in Step 3 is the per-route guard. Back it with a
`handle` hook so the check cannot be missed by a route added later:

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Check if request is to TTS API
  if (event.url.pathname.startsWith('/api/tts')) {
    // Verify JWT token or API key
    const authHeader = event.request.headers.get('Authorization');
    if (!authHeader || !isValidToken(authHeader)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return resolve(event);
};
```

### Rate Limiting (required)

Rate limiting bounds the cost of a credential that is shared, leaked, or simply
used more than you planned. Key it on caller identity where the session gives you
one, and on the client address where it does not. This is what
`enforceRateLimit` in Step 3 delegates to:

```typescript
// src/lib/server/tts.ts
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limiter';

export async function enforceRateLimit(event: RequestEvent): Promise<void> {
  const key = event.locals.session?.userId ?? event.getClientAddress();

  const allowed = await rateLimit.check(key, {
    maxRequests: 60, // 60 requests
    windowMs: 60000, // per minute
  });

  if (!allowed) {
    throw error(429, 'Rate limit exceeded');
  }
}
```

## Cost Optimization

Polly bills each SynthesizeSpeech request by characters
([current rates](https://aws.amazon.com/polly/pricing/)). A read with speech marks
makes two requests, one for the audio and one for the marks, and standard voices
bill at a lower rate than neural ones. The cache in Step 5 removes repeat
synthesis of the same text; the setup guide's
[Cost Management](../../../docs/accessibility/aws-polly-setup-guide.md#cost-management)
section covers usage monitoring.

## Troubleshooting

### 503 from Every Request

The server log names the cause. `requireAuthenticatedCaller is not implemented`
or `enforceRateLimit is not implemented` means the guard stubs are still in
place. A `CredentialsProviderError` means neither an access key pair nor the
SDK's default chain supplied credentials: set both `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`, since one alone is ignored, or configure a profile or
role the SDK can find. In a SvelteKit app, check that the routes read
`$env/dynamic/private` ([Step 2](#step-2-configure-environment-variables)): a
`.env` file never reaches `process.env`. The other `TTSErrorCode` values that
map to 503 are in [Error Responses](#error-responses); the setup guide's
[Troubleshooting](../../../docs/accessibility/aws-polly-setup-guide.md#troubleshooting)
section covers each AWS error.

### Browser Voice Instead of Polly

The toolkit fell back to browser TTS because the voices probe failed: neither
`/api/tts/polly/voices` nor `/api/tts/voices` answered with a success status
within the probe's five-second timeout.

### Text Too Long

Polly accepts 3000 characters per request, and the route rejects longer text
with 400. `ServerTTSProvider` reports the same limit, and the toolkit splits a
longer read into pieces that fit. A caller that posts to the route directly
splits its own text.

### Empty Speech Marks

The request sent `includeSpeechMarks: false`, which skips the marks request.
Missing sentence marks mean `speechMarkTypes` did not reach the route: without
it Polly returns word marks only.

### Redis Connection Errors

The route synthesizes without the cache when Redis is unavailable and logs the
failure. Check the server:

```bash
redis-cli ping
# Should return: PONG
```

## Production Deployment

Run the routes on an IAM role with `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` unset
([IAM Roles](../../../docs/accessibility/aws-polly-setup-guide.md#iam-roles));
set `AWS_REGION` and, for caching, `REDIS_URL`. Implement both guards before the
routes are reachable.

## Reference Implementation

The section-demos app serves Polly and Google through one synthesize route, plus
the voices routes the probe reads, in
[`apps/section-demos/src/routes/api/tts/`](../../../apps/section-demos/src/routes/api/tts/).
Those routes are unauthenticated and serve local development only
([Demo endpoints](../../../docs/tools-and-accomodations/tool_host_contract.md#demo-endpoints)).
[`sveltekit/`](./sveltekit/) holds standalone synthesize and voices routes with
the guards inlined.
