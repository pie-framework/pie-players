# TTS Server API Integration Guide

This guide shows how to integrate the server-side TTS with speech marks into your SvelteKit application.

For the shared TTS architecture and package roles, see
[TTS Architecture](../../../docs/accessibility/tts-architecture.md). This guide
is the Polly-specific SvelteKit integration path.

## Overview

The integration has three parts:

1. **Server-side packages** - Handle AWS Polly API calls
2. **SvelteKit API routes** - Expose TTS endpoints
3. **Client-side provider** - Call API from browser

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

## Step 1: Install Packages

```bash
cd your-sveltekit-app

# Install server-side packages
bun add @pie-players/tts-server-core
bun add @pie-players/tts-server-polly

# Install client-side provider
bun add @pie-players/tts-client-server
```

## Step 2: Configure Environment Variables

Create or update `.env`:

```bash
# AWS Polly credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

**Important:** Never commit `.env` to git. Add to `.gitignore`:

```
.env
.env.local
```

## Step 3: Create SvelteKit API Routes

### Create Directory Structure

```bash
mkdir -p src/routes/api/tts/synthesize
mkdir -p src/routes/api/tts/voices
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
 * AWS SDK error strings can carry region, ARN and credential-shape detail, so
 * the detail stays in the server log and the caller learns only the status.
 */
export function failOpaquely(context: string, err: unknown): never {
  console.error(`[TTS API] ${context}:`, err);

  const detail = err instanceof Error ? err.message : '';

  if (/ThrottlingException|TooManyRequestsException/.test(detail)) {
    throw error(429, { message: 'Text-to-speech is busy. Please try again shortly.' });
  }

  if (/credentials|InvalidSignature|SignatureDoesNotMatch|NetworkingError|ENOTFOUND|ETIMEDOUT/.test(detail)) {
    throw error(503, { message: OPAQUE_FAILURE });
  }

  throw error(500, { message: OPAQUE_FAILURE });
}
```

The standalone files under `sveltekit/` inline these three functions instead, so
that each stays a single self-contained copy.

### Synthesize Endpoint

Copy the example to: **`src/routes/api/tts/synthesize/+server.ts`**

> **Note:** In SvelteKit, use `import { env } from '$env/static/private'` instead of `process.env` for server-side environment variables. The examples below use `process.env` for framework-agnostic readability.

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PollyServerProvider } from '@pie-players/tts-server-polly';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';

// Singleton provider instance
let pollyProvider: PollyServerProvider | null = null;

async function getPollyProvider(): Promise<PollyServerProvider> {
  if (!pollyProvider) {
    pollyProvider = new PollyServerProvider();
    await pollyProvider.initialize({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      engine: 'neural',
      defaultVoice: 'Joanna',
    });
  }
  return pollyProvider;
}

export const POST: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const body = await event.request.json();
    const { text, voice, language, rate, includeSpeechMarks = true } = body;

    if (!text || typeof text !== 'string') {
      throw error(400, { message: 'Text is required' });
    }

    if (text.length > 3000) {
      throw error(400, { message: 'Text too long (max 3000 characters)' });
    }

    const polly = await getPollyProvider();
    const result = await polly.synthesize({
      text,
      voice: voice || 'Joanna',
      language: language || 'en-US',
      rate,
      includeSpeechMarks,
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

Copy the example to: **`src/routes/api/tts/voices/+server.ts`**

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PollyServerProvider } from '@pie-players/tts-server-polly';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';

// Use same singleton as synthesize route
let pollyProvider: PollyServerProvider | null = null;

async function getPollyProvider(): Promise<PollyServerProvider> {
  if (!pollyProvider) {
    pollyProvider = new PollyServerProvider();
    await pollyProvider.initialize({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      engine: 'neural',
    });
  }
  return pollyProvider;
}

export const GET: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const language = event.url.searchParams.get('language') || undefined;
    const gender = event.url.searchParams.get('gender') as 'male' | 'female' | 'neutral' | undefined;

    const polly = await getPollyProvider();
    const voices = await polly.getVoices({ language, gender });

    return json({ voices });
  } catch (err) {
    // Statuses raised above (the guards) are already client-safe.
    if (isHttpError(err)) throw err;

    failOpaquely('Get voices error', err);
  }
};
```

## Step 4: Use in Client Code

### Basic Usage

```typescript
import { ServerTTSProvider } from '@pie-players/tts-client-server';
import { TTSService } from '@pie-players/pie-assessment-toolkit';

// Initialize TTS service with server provider
const provider = new ServerTTSProvider();
const ttsService = new TTSService();

await ttsService.initialize(provider, {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  voice: 'Joanna',
  language: 'en-US',
  rate: 1.0,
});

// Speak with word highlighting
await ttsService.speak('Hello world, this is a test.', {
  contentElement: document.getElementById('content'),
});
```

### With Svelte Component

```svelte
<script lang="ts">
  import { ServerTTSProvider } from '@pie-players/tts-client-server';
  import { TTSService } from '@pie-players/pie-assessment-toolkit';
  import { onMount } from 'svelte';

  let ttsService: TTSService;
  let contentElement: HTMLElement;

  onMount(async () => {
    const provider = new ServerTTSProvider();
    ttsService = new TTSService();

    await ttsService.initialize(provider, {
      apiEndpoint: '/api/tts',
      provider: 'polly',
      voice: 'Joanna',
    });
  });

  async function handleSpeak() {
    await ttsService.speak('Hello world', {
      contentElement,
    });
  }
</script>

<div bind:this={contentElement}>
  <p>Hello world, this is a test of text to speech.</p>
</div>

<button onclick={handleSpeak}>Speak</button>
```

## Step 5: Add Redis Caching (Optional)

### Install Redis

```bash
bun add ioredis
```

### Update API Route with Caching

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PollyServerProvider } from '@pie-players/tts-server-polly';
import { generateHashedCacheKey } from '@pie-players/tts-server-core';
import {
  requireAuthenticatedCaller,
  enforceRateLimit,
  failOpaquely,
} from '$lib/server/tts-guards';
import Redis from 'ioredis';

// Singleton instances
let pollyProvider: PollyServerProvider | null = null;
let redis: Redis | null = null;

async function getRedis(): Promise<Redis> {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
  }
  return redis!;
}

async function getPollyProvider(): Promise<PollyServerProvider> {
  if (!pollyProvider) {
    pollyProvider = new PollyServerProvider();
    await pollyProvider.initialize({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      engine: 'neural',
    });
  }
  return pollyProvider;
}

export const POST: RequestHandler = async (event) => {
  try {
    // Guards first: reject before spending anything on the request.
    await requireAuthenticatedCaller(event);
    await enforceRateLimit(event);

    const body = await event.request.json();
    const { text, voice = 'Joanna', language = 'en-US', rate = 1.0, includeSpeechMarks = true } = body;

    if (!text || typeof text !== 'string') {
      throw error(400, { message: 'Text is required' });
    }

    if (text.length > 3000) {
      throw error(400, { message: 'Text too long (max 3000 characters)' });
    }

    // Generate cache key
    const cacheKey = await generateHashedCacheKey({
      providerId: 'aws-polly',
      text,
      voice,
      language,
      rate,
      format: 'mp3',
    });

    // Check Redis cache
    if (process.env.REDIS_URL) {
      try {
        const redisClient = await getRedis();
        const cached = await redisClient.get(cacheKey);

        if (cached) {
          console.log('[TTS API] Cache hit:', cacheKey);
          const result = JSON.parse(cached);
          result.metadata.cached = true;
          return json(result);
        }
      } catch (cacheError) {
        console.warn('[TTS API] Cache read error:', cacheError);
        // Continue without cache
      }
    }

    // Synthesize with Polly
    const polly = await getPollyProvider();
    const result = await polly.synthesize({
      text,
      voice,
      language,
      rate,
      includeSpeechMarks,
    });

    const response = {
      audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    };

    // Cache result
    if (process.env.REDIS_URL) {
      try {
        const redisClient = await getRedis();
        await redisClient.setex(cacheKey, 24 * 60 * 60, JSON.stringify(response));
        console.log('[TTS API] Cached result:', cacheKey);
      } catch (cacheError) {
        console.warn('[TTS API] Cache write error:', cacheError);
        // Non-fatal, continue
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

### Test API Endpoints

```bash
# Test synthesize endpoint
curl -X POST http://localhost:5173/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "Joanna"}'

# Test voices endpoint
curl http://localhost:5173/api/tts/voices
```

### Test in Browser

```typescript
// In browser console
const response = await fetch('/api/tts/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello world, this is a test.',
    voice: 'Joanna',
  }),
});

const data = await response.json();
console.log('Speech marks:', data.speechMarks);
console.log('Metadata:', data.metadata);
```

## Redis Caching Benefits

With Redis caching enabled:

- **First request:** Full Polly API call (~300-500ms)
- **Cached requests:** Redis retrieval (~10-20ms)
- **Cost savings:** 80-90% reduction in Polly API calls
- **TTL:** 24 hours (configurable)

### Cache Key Format

```
tts:aws-polly:Joanna:en-US:1.00:mp3:<sha256-hash-of-text>
```

## Security Considerations

### Credentials

- ✅ AWS credentials stay on server (never exposed to browser)
- ✅ Use IAM roles in production (no hardcoded credentials)
- ✅ Use environment variables for configuration

### Error Responses

Return a status and a generic message; keep the detail in the server log. AWS SDK
error strings can name the region, an ARN, or the shape of the credential that
failed, so forwarding `err.message` to the caller hands that to whoever is
probing the endpoint. `failOpaquely` in Step 3 is where that mapping lives.

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

### AWS Polly Pricing

- **Neural voices:** $16 per 1M characters
- **Standard voices:** $4 per 1M characters

### Example Costs

**Scenario:** 1000 students taking an assessment

- Average assessment: 5 passages × 500 words × 5 chars = 12,500 chars per student
- Total: 12.5M characters
- Cost without caching: $200 (neural) or $50 (standard)
- Cost with 80% cache hit rate: $40 (neural) or $10 (standard)

### Optimization Tips

1. **Use Redis caching** - 24-hour TTL captures repeated content
2. **Standard voices for development** - Switch to neural for production
3. **Monitor usage** - Track API calls and cache hit rates
4. **Pre-generate common content** - Cache frequently used passages

## Troubleshooting

### Error: "AWS credentials not found"

Check environment variables are set:
```bash
echo $AWS_REGION
echo $AWS_ACCESS_KEY_ID
```

### Error: "Text too long"

AWS Polly limit is 3000 characters. Split longer text:

```typescript
function splitText(text: string, maxLength = 2500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

### Error: "Speech marks empty"

Check that:
1. Speech marks are requested in API call
2. Provider supports speech marks
3. Text is not empty

### Redis connection errors

If Redis is unavailable, the API will work without caching. Check Redis:

```bash
redis-cli ping
# Should return: PONG
```

## Production Deployment

### Environment Setup

```bash
# Production environment variables
export NODE_ENV=production
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=yyy
export REDIS_URL=redis://your-redis-host:6379
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
RUN npm run build
EXPOSE 3000
CMD ["node", "build"]
```

### Health Check

Add a health endpoint:

```typescript
// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      polly: await checkPolly(),
      redis: await checkRedis(),
    },
  };

  return json(health);
};
```

## Next Steps

1. **Test in your app** - Create a demo page
2. **Monitor usage** - Track API calls and costs
3. **Add more providers** - Google Cloud TTS, ElevenLabs
4. **Optimize caching** - Fine-tune TTL and eviction

## Complete Example

See the section-player demo for a complete working example:
- `apps/section-demos` - Client-side usage
- API routes would be added to a SvelteKit app

## Support

For issues or questions:
- Check the [Tool Provider System](../../../docs/tools-and-accomodations/tool_provider_system.md)
- See [TTS Architecture](../../../docs/accessibility/tts-architecture.md)
