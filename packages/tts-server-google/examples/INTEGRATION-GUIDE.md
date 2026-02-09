# Google Cloud TTS Integration Guide

This guide shows how to integrate the Google Cloud Text-to-Speech provider into your server-side application.

## Prerequisites

1. **Google Cloud Project**: Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. **Enable Text-to-Speech API**: Go to APIs & Services → Enable "Cloud Text-to-Speech API"
3. **Authentication**: Set up one of the authentication methods below

## Authentication Setup

### Option 1: Service Account (Recommended for Production)

1. Go to IAM & Admin → Service Accounts
2. Create a service account
3. Grant the role: "Cloud Text-to-Speech User"
4. Create and download a JSON key file

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';

const provider = new GoogleCloudTTSProvider();

await provider.initialize({
  projectId: 'your-project-id',
  credentials: './config/service-account.json',
  voiceType: 'wavenet',
});
```

### Option 2: API Key (Simple but Less Secure)

1. Go to APIs & Services → Credentials
2. Create credentials → API Key
3. Restrict the key to "Cloud Text-to-Speech API"

```typescript
await provider.initialize({
  projectId: 'your-project-id',
  credentials: {
    apiKey: process.env.GOOGLE_TTS_API_KEY!,
  },
});
```

### Option 3: Application Default Credentials (Local Development)

1. Install Google Cloud SDK
2. Run: `gcloud auth application-default login`

```typescript
await provider.initialize({
  projectId: 'your-project-id',
  // No credentials needed - uses ADC
});
```

## SvelteKit Integration

### 1. Install Dependencies

```bash
npm install @pie-players/tts-server-google
```

### 2. Create TTS API Route

**File: `src/routes/api/tts/synthesize/+server.ts`**

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Initialize provider once (singleton pattern)
let ttsProvider: GoogleCloudTTSProvider | null = null;

async function getTTSProvider() {
  if (!ttsProvider) {
    ttsProvider = new GoogleCloudTTSProvider();
    await ttsProvider.initialize({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      voiceType: 'wavenet',
      defaultVoice: 'en-US-Wavenet-A',
    });
  }
  return ttsProvider;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { text, voice, includeSpeechMarks } = await request.json();

    const provider = await getTTSProvider();

    const result = await provider.synthesize({
      text,
      voice,
      includeSpeechMarks: includeSpeechMarks ?? true,
    });

    // Convert audio buffer to base64 for JSON response
    const audioBase64 = result.audio.toString('base64');

    return json({
      audio: audioBase64,
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('TTS synthesis failed:', error);
    return json(
      { error: error instanceof Error ? error.message : 'TTS synthesis failed' },
      { status: 500 }
    );
  }
};
```

### 3. Create Voices API Route

**File: `src/routes/api/tts/voices/+server.ts`**

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

let ttsProvider: GoogleCloudTTSProvider | null = null;

async function getTTSProvider() {
  if (!ttsProvider) {
    ttsProvider = new GoogleCloudTTSProvider();
    await ttsProvider.initialize({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      voiceType: 'wavenet',
    });
  }
  return ttsProvider;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const language = url.searchParams.get('language') || undefined;
    const gender = url.searchParams.get('gender') as 'male' | 'female' | 'neutral' | undefined;

    const provider = await getTTSProvider();

    const voices = await provider.getVoices({ language, gender });

    return json({ voices });
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voices' },
      { status: 500 }
    );
  }
};
```

### 4. Environment Variables

**File: `.env`**

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Or use API key
# GOOGLE_TTS_API_KEY=AIza...
```

### 5. Client-Side Usage

**File: `src/lib/tts-client.ts`**

```typescript
export interface TTSResult {
  audio: string; // Base64 encoded
  contentType: string;
  speechMarks: Array<{
    time: number;
    type: string;
    start: number;
    end: number;
    value: string;
  }>;
  metadata: {
    providerId: string;
    voice: string;
    duration: number;
  };
}

export async function synthesizeSpeech(
  text: string,
  voice?: string
): Promise<TTSResult> {
  const response = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, includeSpeechMarks: true }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  return response.json();
}

export async function playAudio(result: TTSResult): Promise<void> {
  // Convert base64 to blob
  const audioData = atob(result.audio);
  const audioArray = new Uint8Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    audioArray[i] = audioData.charCodeAt(i);
  }
  const blob = new Blob([audioArray], { type: result.contentType });

  // Play audio
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();

  // Clean up
  audio.onended = () => URL.revokeObjectURL(url);
}

export async function getVoices(language?: string) {
  const params = new URLSearchParams();
  if (language) params.set('language', language);

  const response = await fetch(`/api/tts/voices?${params}`);
  const { voices } = await response.json();
  return voices;
}
```

**File: `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import { synthesizeSpeech, playAudio, getVoices } from '$lib/tts-client';
  import { onMount } from 'svelte';

  let text = 'Hello world, this is Google Cloud Text to Speech!';
  let voice = 'en-US-Wavenet-A';
  let voices: any[] = [];
  let speechMarks: any[] = [];
  let isPlaying = false;

  onMount(async () => {
    voices = await getVoices('en-US');
  });

  async function handleSpeak() {
    try {
      isPlaying = true;
      const result = await synthesizeSpeech(text, voice);
      speechMarks = result.speechMarks;
      await playAudio(result);
    } catch (error) {
      console.error('Speech failed:', error);
      alert('Speech synthesis failed');
    } finally {
      isPlaying = false;
    }
  }
</script>

<div class="container">
  <h1>Google Cloud TTS Demo</h1>

  <div class="controls">
    <label>
      Text to speak:
      <textarea bind:value={text} rows="4"></textarea>
    </label>

    <label>
      Voice:
      <select bind:value={voice}>
        {#each voices as v}
          <option value={v.id}>{v.name} ({v.gender})</option>
        {/each}
      </select>
    </label>

    <button on:click={handleSpeak} disabled={isPlaying}>
      {isPlaying ? 'Speaking...' : 'Speak'}
    </button>
  </div>

  {#if speechMarks.length > 0}
    <div class="speech-marks">
      <h2>Speech Marks</h2>
      <ul>
        {#each speechMarks as mark}
          <li>
            {mark.value} ({mark.time}ms)
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    font-family: inherit;
  }

  select {
    width: 100%;
    padding: 0.5rem;
  }

  button {
    padding: 0.75rem 1.5rem;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .speech-marks {
    margin-top: 2rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .speech-marks ul {
    list-style: none;
    padding: 0;
  }

  .speech-marks li {
    padding: 0.25rem;
    font-family: monospace;
  }
</style>
```

## Express.js Integration

```typescript
import express from 'express';
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';

const app = express();
app.use(express.json());

// Initialize provider
const ttsProvider = new GoogleCloudTTSProvider();
await ttsProvider.initialize({
  projectId: process.env.GOOGLE_CLOUD_PROJECT!,
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  voiceType: 'wavenet',
});

// Synthesize endpoint
app.post('/api/tts/synthesize', async (req, res) => {
  try {
    const { text, voice, includeSpeechMarks } = req.body;

    const result = await ttsProvider.synthesize({
      text,
      voice,
      includeSpeechMarks: includeSpeechMarks ?? true,
    });

    // Return audio as buffer
    res.json({
      audio: result.audio.toString('base64'),
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('TTS synthesis failed:', error);
    res.status(500).json({ error: 'TTS synthesis failed' });
  }
});

// Voices endpoint
app.get('/api/tts/voices', async (req, res) => {
  try {
    const { language, gender } = req.query;

    const voices = await ttsProvider.getVoices({
      language: language as string,
      gender: gender as 'male' | 'female' | 'neutral',
    });

    res.json({ voices });
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Next.js App Router Integration

**File: `app/api/tts/synthesize/route.ts`**

```typescript
import { GoogleCloudTTSProvider } from '@pie-players/tts-server-google';
import { NextResponse } from 'next/server';

let ttsProvider: GoogleCloudTTSProvider | null = null;

async function getTTSProvider() {
  if (!ttsProvider) {
    ttsProvider = new GoogleCloudTTSProvider();
    await ttsProvider.initialize({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      voiceType: 'wavenet',
    });
  }
  return ttsProvider;
}

export async function POST(request: Request) {
  try {
    const { text, voice, includeSpeechMarks } = await request.json();

    const provider = await getTTSProvider();

    const result = await provider.synthesize({
      text,
      voice,
      includeSpeechMarks: includeSpeechMarks ?? true,
    });

    return NextResponse.json({
      audio: result.audio.toString('base64'),
      contentType: result.contentType,
      speechMarks: result.speechMarks,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('TTS synthesis failed:', error);
    return NextResponse.json(
      { error: 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
```

## Security Best Practices

1. **Never expose API keys in client code** - Always use server-side endpoints
2. **Restrict API keys** - Limit to specific APIs and IP addresses
3. **Use service accounts in production** - More secure than API keys
4. **Rate limiting** - Implement rate limiting to prevent abuse
5. **Cache results** - Cache TTS output to reduce API calls and costs
6. **Validate input** - Sanitize and validate user input before synthesis

## Cost Optimization

1. **Cache frequently used phrases** - Store audio for common text
2. **Use standard voices when possible** - $4/1M vs $16/1M for neural
3. **Batch requests** - Group multiple synthesis requests when feasible
4. **Monitor usage** - Set up billing alerts in Google Cloud Console

## Troubleshooting

### Authentication Errors

```
Error: Google Cloud authentication failed
```

**Solution**: Verify your credentials are correct and the service account has the "Cloud Text-to-Speech User" role.

### Rate Limit Exceeded

```
Error: Google Cloud rate limit exceeded
```

**Solution**: Implement exponential backoff and request rate limiting. Consider increasing your quota in Google Cloud Console.

### No Audio Content

```
Error: No audio content received from Google Cloud TTS
```

**Solution**: Check that your project has the Text-to-Speech API enabled and your billing is active.

## Support

For issues specific to this package, please file an issue on GitHub.

For Google Cloud TTS API issues, see the [official documentation](https://cloud.google.com/text-to-speech/docs).
