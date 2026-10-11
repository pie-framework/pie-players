# Google Cloud TTS Integration Guide

This integration guide builds the server half of server-backed text-to-speech
(TTS) on Google Cloud: the routes that `@pie-players/tts-client-server` calls on
its PIE transport, backed by `@pie-players/tts-server-google`. It is for host
developers adding read-aloud with word highlighting, and covers SvelteKit,
Express and the Next.js App Router.

The [AWS Polly integration guide](../../tts-server-polly/examples/INTEGRATION-GUIDE.md)
owns what the two providers share: the auth and rate-limit guards, the security
model and the response cache. The provider's configuration and behavior are in
the [package README](../README.md); the package layering and provider fallback,
in [TTS Architecture](../../../docs/accessibility/tts-architecture.md).

## Prerequisites

A Google Cloud project with billing and the Cloud Text-to-Speech API enabled, as
Google's [setup page](https://docs.cloud.google.com/text-to-speech/docs/get-started)
describes.

## Authentication Setup

The routes below pick a method from the environment. The README's
[authentication methods](../README.md#authentication-methods) list every shape
`credentials` takes.

- **Service account (production).** In IAM & Admin → Service Accounts, create a
  service account and download a JSON key. `GOOGLE_APPLICATION_CREDENTIALS`
  names the key file.
- **API key.** In APIs & Services → Credentials, create an API key and restrict
  it to the Cloud Text-to-Speech API. `GOOGLE_API_KEY` holds it.
- **Application Default Credentials (local development).** With neither
  variable set, the provider uses ADC: `gcloud auth application-default login`
  on a workstation, the attached service account on Google Cloud.

## SvelteKit Integration

### 1. Install Packages

```bash
npm install @pie-players/tts-server-core @pie-players/tts-server-google @pie-players/tts-client-server
```

### 2. Configure Environment Variables

```bash
GOOGLE_CLOUD_PROJECT=your-project-id

# One of the two, or neither for Application Default Credentials:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# GOOGLE_API_KEY=AIza...
```

Keep `.env`, `.env.local` and the key file out of version control.

### 3. Create the Provider Module

The routes share one provider instance. The module reads `process.env`, so the
Express and Next.js routes below reuse it; in SvelteKit, `env` from
`$env/dynamic/private` replaces it, since `$env/static/private` cannot import
variables a deployment leaves unset.

Create **`src/lib/server/google-tts.ts`**:

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';

let provider: GoogleCloudTTSProvider | null = null;

export async function getGoogleProvider(): Promise<GoogleCloudTTSProvider> {
  if (provider) return provider;

  const apiKey = process.env.GOOGLE_API_KEY;
  const next = new GoogleCloudTTSProvider();
  await next.initialize({
    projectId: process.env.GOOGLE_CLOUD_PROJECT!,
    // An API key, else a key file; with neither, Application Default Credentials.
    credentials: apiKey ? { apiKey } : process.env.GOOGLE_APPLICATION_CREDENTIALS,
    voiceType: 'wavenet',
    defaultVoice: 'en-US-Wavenet-A',
  });
  provider = next;
  return provider;
}
```

The routes also call the guards in `src/lib/server/tts-guards.ts`. Create that
module as the Polly guide's [shared guards](../../tts-server-polly/examples/INTEGRATION-GUIDE.md#shared-guards-required)
section shows; it is provider-neutral. Every route reaches Google on every
request, so without the guards it is an open, unmetered proxy to your Google
Cloud project.

### 4. Create the Synthesize Route

With `serverProvider: 'google'`, the client sends the text, voice, language and
rate, and a `sampleRate` when the host's `providerOptions` set one. The route
forwards those. The output encoding is the provider's `audioEncoding`, so the
route ignores `format`.

Create **`src/routes/api/tts/synthesize/+server.ts`**:

```typescript
import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGoogleProvider } from '$lib/server/google-tts';
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
      sampleRate,
      includeSpeechMarks = true,
    } = await event.request.json();

    if (!text || typeof text !== 'string') {
      throw error(400, { message: 'Text is required' });
    }

    if (text.length > 3000) {
      throw error(400, { message: 'Text too long (max 3000 characters)' });
    }

    const google = await getGoogleProvider();
    const result = await google.synthesize({
      text,
      // Unset, the provider picks a voice for `language`, else its defaultVoice.
      voice,
      language,
      rate,
      sampleRate,
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

The 3000-character cap matches what `ServerTTSProvider` declares; the toolkit
splits longer reads to fit.

### 5. Create the Voices Route

The client's readiness probe tries `/api/tts/google/voices` and falls back to
`/api/tts/voices` on a 404. A host with Google alone puts the route at
`voices/`; a host serving Polly and Google puts each provider's route under its
own path and dispatches synthesis on the request's `provider` field.

Create **`src/routes/api/tts/voices/+server.ts`**:

```typescript
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGoogleProvider } from '$lib/server/google-tts';
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
    const quality = (params.get('quality') || undefined) as
      | 'standard'
      | 'premium'
      | 'neural'
      | undefined;

    const google = await getGoogleProvider();
    const voices = await google.getVoices({ language, gender, quality });

    return json({ voices });
  } catch (err) {
    // Statuses raised above (the guards) are already client-safe.
    if (isHttpError(err)) throw err;

    failOpaquely('Get voices error', err);
  }
};
```

### 6. Configure the Client

With the toolkit, server TTS on Google is one provider entry:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'server',
      serverProvider: 'google',
    },
  },
}
```

The Polly guide's [client step](../../tts-server-polly/examples/INTEGRATION-GUIDE.md#step-4-configure-the-client)
covers the defaults this entry relies on and a host without the toolkit.

## Other Frameworks

Express and Next.js reuse `src/lib/server/google-tts.ts` from step 3 and need the
same guards: an auth check and a rate limit ahead of every TTS route, and a catch
that logs the provider error and returns a fixed message. One helper maps the
provider's error codes to statuses, as `failOpaquely` does in SvelteKit.

Create **`src/lib/server/tts-status.ts`**:

```typescript
import { TTSError, TTSErrorCode } from '@pie-players/tts-server-core';

/** The HTTP status for a provider failure; the message stays in the server log. */
export function statusForTTSFailure(err: unknown): number {
  const code = err instanceof TTSError ? err.code : undefined;
  if (code === TTSErrorCode.RATE_LIMIT_EXCEEDED) return 429;
  if (code === TTSErrorCode.AUTHENTICATION_ERROR || code === TTSErrorCode.INITIALIZATION_ERROR) {
    return 503;
  }
  if (code === TTSErrorCode.INVALID_REQUEST || code === TTSErrorCode.TEXT_TOO_LONG) return 400;
  return 500;
}
```

### Express

```typescript
import express from 'express';
import { getGoogleProvider } from './lib/server/google-tts';
import { statusForTTSFailure } from './lib/server/tts-status';

const app = express();
app.use(express.json());
// Mount your auth and rate-limit middleware on /api/tts before these routes.

app.post('/api/tts/synthesize', async (req, res) => {
  const { text, voice, language, rate, sampleRate, includeSpeechMarks = true } = req.body;

  if (!text || typeof text !== 'string' || text.length > 3000) {
    res.status(400).json({ error: 'Text is required (max 3000 characters)' });
    return;
  }

  try {
    const google = await getGoogleProvider();
    const result = await google.synthesize({
      text,
      voice,
      language,
      rate,
      sampleRate,
      includeSpeechMarks,
    });

    res.json({
      audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (err) {
    console.error('[TTS API] Synthesis error:', err);
    res.status(statusForTTSFailure(err)).json({ error: 'Text-to-speech is unavailable.' });
  }
});

app.get('/api/tts/voices', async (req, res) => {
  try {
    const google = await getGoogleProvider();
    const voices = await google.getVoices({
      language: typeof req.query.language === 'string' ? req.query.language : undefined,
      gender: req.query.gender as 'male' | 'female' | 'neutral' | undefined,
      quality: req.query.quality as 'standard' | 'premium' | 'neural' | undefined,
    });

    res.json({ voices });
  } catch (err) {
    console.error('[TTS API] Get voices error:', err);
    res.status(statusForTTSFailure(err)).json({ error: 'Text-to-speech is unavailable.' });
  }
});

app.listen(3000);
```

### Next.js App Router

Create **`app/api/tts/synthesize/route.ts`**; the voices route follows the same
pattern with `GET`.

```typescript
import { NextResponse } from 'next/server';
import { getGoogleProvider } from '@/lib/server/google-tts';
import { statusForTTSFailure } from '@/lib/server/tts-status';

export async function POST(request: Request) {
  // Run your auth check and rate limit here, or in middleware.ts.

  const { text, voice, language, rate, sampleRate, includeSpeechMarks = true } =
    await request.json();

  if (!text || typeof text !== 'string' || text.length > 3000) {
    return NextResponse.json(
      { error: 'Text is required (max 3000 characters)' },
      { status: 400 },
    );
  }

  try {
    const google = await getGoogleProvider();
    const result = await google.synthesize({
      text,
      voice,
      language,
      rate,
      sampleRate,
      includeSpeechMarks,
    });

    return NextResponse.json({
      audio: result.audio instanceof Buffer ? result.audio.toString('base64') : result.audio,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (err) {
    console.error('[TTS API] Synthesis error:', err);
    return NextResponse.json(
      { error: 'Text-to-speech is unavailable.' },
      { status: statusForTTSFailure(err) },
    );
  }
}
```

## Security

The Polly guide's [security considerations](../../tts-server-polly/examples/INTEGRATION-GUIDE.md#security-considerations)
apply unchanged: guarded routes, opaque error responses, and credentials held on
the server only. On Google:

- Production uses a service account, whose access IAM grants and revokes.
- An API key is restricted to the Cloud Text-to-Speech API and, where the server
  has fixed egress addresses, to those addresses.
- The JSON key file is a secret: it stays out of the repository and the client
  bundle, and a platform secret store holds it where one exists.

## Cost Optimization

Google bills by characters synthesized, at rates that differ by voice type:
<https://cloud.google.com/text-to-speech/pricing>. One request returns the
audio and the speech marks.

- **Cache.** The Polly guide's [response cache](../../tts-server-polly/examples/INTEGRATION-GUIDE.md#step-5-add-redis-caching-optional)
  works for Google with `providerId: 'google-cloud-tts'` in the key.
- **Voice type.** The rate follows the voice that synthesizes: the request's
  `voice`, else the one [voice resolution](../../tts-server-core/README.md#voice-resolution)
  picks from `defaultVoice` and `voiceType`.
- **Billing alerts.** Budgets and alerts in the Google Cloud console bound an
  unexpected spend.

## Troubleshooting

The routes log the provider's error, Google's message included, before returning
a fixed one, so the server log carries the cause.

### 503 from Every Request

The guard stubs reject every request until they are implemented. After that, a
503 is an `INITIALIZATION_ERROR`, for an unset `GOOGLE_CLOUD_PROJECT`, or an
`AUTHENTICATION_ERROR`: Google answered `PERMISSION_DENIED`. Check the key or
service account, that the project has the Cloud Text-to-Speech API enabled, and
that billing is active.

### 500 from Synthesis

Any other Google failure arrives as `PROVIDER_ERROR`, a response without audio
(`No audio content received from Google Cloud TTS`) and missing Application
Default Credentials among them. Check the credentials, the API and billing as
above.

### 429 Rate Limit

Google answered `RESOURCE_EXHAUSTED`. Retry with backoff, cache repeat reads, or
raise the project's quota in the Google Cloud console.

### No Word Highlighting

Studio voices take no `<mark>` tags, so the provider returns no speech marks for
them. Use a WaveNet or Standard voice where highlighting matters.
