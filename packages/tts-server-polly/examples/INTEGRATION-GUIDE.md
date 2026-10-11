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

```bash
AWS_REGION=us-east-1
# Access keys for local development; production uses an IAM role instead.
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
# Temporary credentials (AWS SSO, an assumed role) also need:
# AWS_SESSION_TOKEN=...

# Optional: Redis for caching (Step 5)
REDIS_URL=redis://localhost:6379
```

The [setup guide](../../../docs/accessibility/aws-polly-setup-guide.md) creates
the IAM user, its minimal policy and the keys. Keep `.env` and `.env.local` out
of version control.

## Step 3: Create SvelteKit API Routes

The routes share two server modules: one holds the Polly providers, the other the
guards every TTS route calls. The examples read `process.env` so they work in
any framework; in SvelteKit, `env` from `$env/dynamic/private` replaces it, since
`$env/static/private` cannot import the key variables an IAM-role deployment
leaves unset.

### Polly Provider

Create **`src/lib/server/polly.ts`**:

```typescript
import { PollyServerProvider } from '@pie-players/tts-server-polly';

type PollyEngine = 'neural' | 'standard';

// The engine is fixed per provider instance, so there is one per engine.
const providers = new Map<PollyEngine, PollyServerProvider>();

export async function getPollyProvider(
  engine: PollyEngine = 'neural',
): Promise<PollyServerProvider> {
  const existing = providers.get(engine);
  if (existing) return existing;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const provider = new PollyServerProvider();
  await provider.initialize({
    region: process.env.AWS_REGION || 'us-east-1',
    // Without keys, the AWS SDK default credential chain applies (an IAM role).
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN }
        : undefined,
    engine,
    defaultVoice: 'Joanna',
  });
  providers.set(engine, provider);
  return provider;
}
```

### Shared Guards (required)

Both routes reach AWS on every request. Without an auth check and a rate limit
they are open, unmetered proxies to your Polly account: whoever can reach the URL
spends your budget, and the 3000-character cap bounds one request rather than the
number of them. Put both guards in one module and call them from every TTS route.

Create **`src/lib/server/tts-guards.ts`**:

```typescript
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { TTSError, TTSErrorCode } from '@pie-players/tts-server-core';

/** The only failure detail a caller ever receives. */
export const OPAQUE_FAILURE = 'Text-to-speech is unavailable.';

/**
 * Reject callers your app has not authenticated.
 *
 * Replace the body with your real check; do not delete the function or its call
 * sites. It fails closed so a copied route cannot ship open by accident.
 */
export async function requireAuthenticatedCaller(event: RequestEvent): Promise<void> {
  // Your check, e.g. against what hooks.server.ts left on event.locals:
  //   if (event.locals.session) return;
  console.error(
    '[TTS API] requireAuthenticatedCaller is not implemented, rejecting',
    event.url.pathname,
  );
  throw error(503, { message: OPAQUE_FAILURE });
}

/**
 * Reject callers who have spent their quota.
 *
 * Replace the body with your real limiter; do not delete the function or its
 * call sites. Rate limiting is what bounds the cost of a shared or leaked
 * credential.
 */
export async function enforceRateLimit(event: RequestEvent): Promise<void> {
  // Your limiter, keyed on caller identity where you have it:
  //   const key = event.locals.session?.userId ?? event.getClientAddress();
  //   if (await limiter.take(key)) return;
  console.error(
    '[TTS API] enforceRateLimit is not implemented, rejecting',
    event.url.pathname,
  );
  throw error(503, { message: OPAQUE_FAILURE });
}

/**
 * Log the failure and raise a client-safe one in its place.
 *
 * Vendor error strings can carry region, ARN and credential-shape detail, so the
 * detail stays in the server log and the caller learns only the status. The
 * provider reports every vendor failure as a TTSError with a code.
 */
export function failOpaquely(context: string, err: unknown): never {
  console.error(`[TTS API] ${context}:`, err);

  const code = err instanceof TTSError ? err.code : undefined;

  if (code === TTSErrorCode.RATE_LIMIT_EXCEEDED) {
    throw error(429, { message: 'Text-to-speech is busy. Please try again shortly.' });
  }

  if (code === TTSErrorCode.AUTHENTICATION_ERROR || code === TTSErrorCode.INITIALIZATION_ERROR) {
    throw error(503, { message: OPAQUE_FAILURE });
  }

  if (code === TTSErrorCode.INVALID_REQUEST || code === TTSErrorCode.TEXT_TOO_LONG) {
    throw error(400, { message: 'Text-to-speech could not read this request.' });
  }

  throw error(500, { message: OPAQUE_FAILURE });
}
```

The standalone files under `sveltekit/` inline the guards instead, so that each
stays a single self-contained copy.

### Synthesize Endpoint

Create **`src/routes/api/tts/synthesize/+server.ts`**. It forwards every field
the client sends: with `serverProvider: 'polly'` the toolkit sends `engine`,
`format`, `sampleRate` and `speechMarkTypes` (word and sentence marks by
default) alongside the text, voice, language and rate.

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPollyProvider } from '$lib/server/polly';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';

export const POST: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const {
      text,
      voice,
      language,
      rate,
      engine,
      format,
      sampleRate,
      speechMarkTypes,
      includeSpeechMarks = true,
    } = await event.request.json();

    if (!text || typeof text !== 'string') {
      throw error(400, { message: 'Text is required' });
    }

    if (text.length > 3000) {
      throw error(400, { message: 'Text too long (max 3000 characters)' });
    }

    const polly = await getPollyProvider(engine === 'standard' ? 'standard' : 'neural');
    const result = await polly.synthesize({
      text,
      // Unset, the provider picks a voice for `language`, else its defaultVoice.
      voice,
      language,
      rate,
      format,
      sampleRate,
      includeSpeechMarks,
      providerOptions: Array.isArray(speechMarkTypes) ? { speechMarkTypes } : undefined,
    });

    return json({
      audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (err) {
    // Statuses raised above (the guards, request validation) are already
    // client-safe and pass through unchanged.
    if (isHttpError(err)) throw err;

    failOpaquely('Synthesis error', err);
  }
};
```

### Voices Endpoint

Create **`src/routes/api/tts/voices/+server.ts`**. The client's probe tries
`/api/tts/polly/voices` first and falls back to `/api/tts/voices` on a 404, so
either path works. The route returns the configured engine's voices.

```typescript
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPollyProvider } from '$lib/server/polly';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';

export const GET: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const params = event.url.searchParams;
    const language = params.get('language') || undefined;
    const gender = (params.get('gender') || undefined) as 'male' | 'female' | 'neutral' | undefined;
    const quality = (params.get('quality') || undefined) as 'standard' | 'neural' | undefined;

    const polly = await getPollyProvider();
    const voices = await polly.getVoices({ language, gender, quality });

    return json({ voices });
  } catch (err) {
    // Statuses raised above (the guards) are already client-safe.
    if (isHttpError(err)) throw err;

    failOpaquely('Get voices error', err);
  }
};
```

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
synthesis call. `generateHashedCacheKey` from `@pie-players/tts-server-core`
builds the key from the provider id, voice, language, rate, format and a SHA-256
hash of the text:

```
tts:aws-polly:Joanna:en-US:1.00:mp3:<sha256-hash-of-text>
```

The route below appends the other request fields that change the response:
engine, sample rate and speech-mark types. A single-process host can use
`MemoryCache` from the same package; each replica keeps its own copy.

```bash
bun add ioredis
```

Replace the synthesize route with:

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateHashedCacheKey } from '@pie-players/tts-server-core';
import { getPollyProvider } from '$lib/server/polly';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';
import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

export const POST: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const {
      text,
      voice,
      language,
      rate,
      engine: requestedEngine,
      format,
      sampleRate,
      speechMarkTypes,
      includeSpeechMarks = true,
    } = await event.request.json();

    if (!text || typeof text !== 'string') {
      throw error(400, { message: 'Text is required' });
    }

    if (text.length > 3000) {
      throw error(400, { message: 'Text too long (max 3000 characters)' });
    }

    const engine = requestedEngine === 'standard' ? 'standard' : 'neural';
    const markTypes: string[] | undefined = Array.isArray(speechMarkTypes)
      ? speechMarkTypes
      : undefined;
    const marks = includeSpeechMarks ? (markTypes ?? ['word']).join('+') : 'none';

    const baseKey = await generateHashedCacheKey({
      providerId: 'aws-polly',
      text,
      voice: voice ?? '',
      language,
      rate,
      format,
    });
    const cacheKey = `${baseKey}:${engine}:${sampleRate ?? 24000}:${marks}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const response = JSON.parse(cached);
          response.metadata.cached = true;
          return json(response);
        }
      } catch (cacheError) {
        // A cache failure costs a synthesis call, never the read.
        console.warn('[TTS API] Cache read error:', cacheError);
      }
    }

    const polly = await getPollyProvider(engine);
    const result = await polly.synthesize({
      text,
      voice,
      language,
      rate,
      format,
      sampleRate,
      includeSpeechMarks,
      providerOptions: markTypes ? { speechMarkTypes: markTypes } : undefined,
    });

    const response = {
      audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    };

    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(response));
      } catch (cacheError) {
        console.warn('[TTS API] Cache write error:', cacheError);
      }
    }

    return json(response);
  } catch (err) {
    // Statuses raised above (the guards, request validation) are already
    // client-safe and pass through unchanged.
    if (isHttpError(err)) throw err;

    failOpaquely('Synthesis error', err);
  }
};
```

## Step 6: Test the Integration

The guard stubs from Step 3 answer 503 until you implement them. With the guards
in place, send whatever credential they check:

```bash
curl -X POST http://localhost:5173/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"text": "Hello world", "voice": "Joanna"}'

curl -H "Authorization: Bearer <token>" http://localhost:5173/api/tts/voices
```

A working synthesize route returns `audio`, `contentType`, `speechMarks` and
`metadata`.

## Security Considerations

### Credentials

AWS credentials stay on the server; neither route returns them. Production runs
on an IAM role with no keys in the environment, as the setup guide's
[Production Deployment](../../../docs/accessibility/aws-polly-setup-guide.md#production-deployment)
section describes; `getPollyProvider` passes no credentials when the keys are
unset, so the AWS SDK default credential chain picks up the role.

### Error Responses

Return a status and a generic message; keep the detail in the server log. AWS SDK
error strings can name the region, an ARN, or the shape of the credential that
failed, so forwarding `err.message` to the caller hands that to whoever is
probing the endpoint. `failOpaquely` in Step 3 maps the provider's `TTSErrorCode`
to a status and is the only place that mapping lives.

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
// src/lib/server/tts-guards.ts
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
    throw error(429, { message: 'Rate limit exceeded' });
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
or `enforceRateLimit is not implemented` means the Step 3 stubs are still in
place. A `TTSError` with `AUTHENTICATION_ERROR` or `INITIALIZATION_ERROR` means
the region or credentials are missing or rejected; the setup guide's
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
Missing sentence marks mean `speechMarkTypes` was not forwarded: without
`providerOptions.speechMarkTypes`, as Step 3 passes it, Polly returns word marks
only.

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
