# Server-Side TTS API Architecture

## Executive Summary

This document outlines the architecture and implementation plan for a server-side Text-to-Speech (TTS) synthesis service that provides a unified API for multiple TTS providers (AWS Polly, Google Cloud TTS, ElevenLabs, etc.). The service returns both audio and precise timing metadata (speech marks) for word-level highlighting in assessment players.

**Key Goals:**
- Unified API for multiple TTS providers
- Speech marks/timing metadata for precise word highlighting
- Plugin-based provider architecture for extensibility
- Secure server-side credential management
- Redis caching for performance and cost optimization
- Seamless integration with existing pie-players architecture

**Based On:**
- Pieoneer POC implementation at `/Users/eelco.hillenius/dev/prj/kds/pie-api-aws`
- Current pie-players TTS architecture at `/Users/eelco.hillenius/dev/prj/pie/pie-players`
- Proven patterns from AWS Polly integration

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Overview](#architecture-overview)
3. [Package Structure](#package-structure)
4. [Provider Specifications](#provider-specifications)
5. [API Design](#api-design)
6. [Implementation Steps](#implementation-steps)
7. [Migration Path](#migration-path)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Considerations](#deployment-considerations)
10. [Provider Comparison Matrix](#provider-comparison-matrix)

---

## Current State Analysis

### Existing Client-Side Architecture

**Current TTS Packages:**
1. **`@pie-players/pie-tts`** - Core interfaces and types (zero dependencies)
2. **`@pie-players/pie-assessment-toolkit`** - TTS service with browser provider
3. **`@pie-players/pie-tts-polly`** - AWS Polly client-side provider (direct AWS SDK calls)

**Limitations:**
- ❌ Client-side Polly provider exposes AWS credentials in browser
- ❌ No speech marks/timing metadata for word highlighting
- ❌ No server-side caching
- ❌ Direct AWS SDK increases bundle size
- ❌ Limited to browser Web Speech API for free option

### Pieoneer POC Implementation

**Proven Server-Side Architecture:**

**Server Package Structure:**
```
packages/polly/
├── src/
│   ├── synthesize.ts    # Core synthesis with speech marks
│   ├── voices.ts        # Voice listing
│   └── index.ts
└── package.json
```

**Key Features:**
✅ Server-side AWS credential management
✅ Speech marks returned from Polly
✅ Redis caching (24-hour TTL)
✅ Base64 audio encoding
✅ JWT authentication
✅ Word-level timing metadata

**Speech Marks Response Format:**
```typescript
interface SynthesizeResult {
  audio: string;           // base64 encoded MP3
  contentType: string;     // 'audio/mpeg'
  speechMarks: SpeechMark[]; // Word timing metadata
}

interface SpeechMark {
  time: number;   // Milliseconds from start
  type: string;   // 'word'
  start: number;  // Character index
  end: number;    // Character index
  value: string;  // Word text
}
```

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PIE Players (Browser)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @pie-players/pie-assessment-toolkit                     │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  TTSService                                          │ │  │
│  │  │  - State management                                  │ │  │
│  │  │  - Playback coordination                             │ │  │
│  │  │  - Word highlighting                                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │           │                                                │  │
│  │           ▼                                                │  │
│  │  ┌─────────────────┐         ┌─────────────────┐         │  │
│  │  │ BrowserProvider │◄────────┤ ServerProvider  │         │  │
│  │  │ (Web Speech)    │ fallback│ (HTTP API)      │         │  │
│  │  └─────────────────┘         └─────────────────┘         │  │
│  │                                      │                     │  │
│  └──────────────────────────────────────┼─────────────────────┘  │
│                                         │ HTTPS                  │
└─────────────────────────────────────────┼────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              TTS Backend Service (Node.js/Express)               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Layer (Express/Fastify)                               │ │
│  │  - POST /api/tts/synthesize                                │ │
│  │  - GET  /api/tts/voices                                    │ │
│  │  - Authentication (JWT/API Key)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                     │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Provider Router                                           │ │
│  │  - Route to appropriate provider                           │ │
│  │  - Provider selection logic                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                     │
│       ┌─────────────────────┼─────────────────────┐            │
│       │                     │                      │             │
│       ▼                     ▼                      ▼             │
│  ┌─────────┐         ┌─────────┐          ┌─────────┐          │
│  │  Polly  │         │ Google  │          │ElevenLabs│          │
│  │Provider │         │Provider │          │Provider │          │
│  └─────────┘         └─────────┘          └─────────┘          │
│       │                     │                      │             │
│       └─────────────────────┼──────────────────────┘            │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Caching Layer (Redis)                                     │ │
│  │  - Audio cache (24h TTL)                                   │ │
│  │  - Voice list cache (1h TTL)                               │ │
│  │  - Cache key: sha256(text + voice + provider)              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
            ┌─────────────────────────────────────┐
            │   Cloud TTS APIs                     │
            │   - AWS Polly                        │
            │   - Google Cloud TTS                 │
            │   - ElevenLabs                       │
            └─────────────────────────────────────┘
```

### Speech Marks Normalization

Different providers return timing data in different formats. The server normalizes all formats to a unified structure:

```typescript
// Unified speech marks format
interface SpeechMark {
  time: number;   // Milliseconds from audio start
  type: 'word' | 'sentence' | 'ssml';
  start: number;  // Character index in original text
  end: number;    // Character index (exclusive)
  value: string;  // The word/text
}
```

**Provider Mapping:**
- **AWS Polly** - Native word marks via SpeechMarkTypes.WORD
- **Google Cloud TTS** - Timepoint data from `timepoints` array
- **ElevenLabs** - Character-based timing via WebSocket API
- **Fallback** - Estimated marks based on text length (150 WPM)

---

## Package Structure

### Proposed Package Structure

```
packages/
├── tts-server-core/             # Core server-side interfaces
│   ├── src/
│   │   ├── types.ts            # Common types
│   │   ├── provider.ts         # Server provider interface
│   │   ├── speech-marks.ts     # Speech marks utilities
│   │   ├── cache.ts            # Caching interface
│   │   └── index.ts
│   └── package.json
│
├── tts-server-polly/            # AWS Polly provider
│   ├── src/
│   │   ├── PollyServerProvider.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── package.json
│
├── tts-server-google/           # Google Cloud TTS provider
│   ├── src/
│   │   ├── GoogleServerProvider.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── package.json
│
├── tts-server-elevenlabs/       # ElevenLabs provider
│   ├── src/
│   │   ├── ElevenLabsServerProvider.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── package.json
│
├── tts-service-backend/         # Deployable backend service
│   ├── src/
│   │   ├── server.ts           # Express/Fastify server
│   │   ├── routes/
│   │   │   ├── synthesize.ts   # POST /synthesize
│   │   │   └── voices.ts       # GET /voices
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT/API key validation
│   │   │   ├── rate-limit.ts   # Rate limiting
│   │   │   └── error.ts        # Error handling
│   │   ├── cache/
│   │   │   ├── redis.ts        # Redis client
│   │   │   └── memory.ts       # In-memory fallback
│   │   ├── router.ts           # Provider routing logic
│   │   └── index.ts
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
│
└── tts-client-server/           # Client-side provider for server API
    ├── src/
    │   ├── ServerTTSProvider.ts  # Calls backend service
    │   ├── types.ts
    │   └── index.ts
    └── package.json
```

### Integration with Demo Apps

For demo apps (like `apps/example` or `apps/section-demos`):
```
apps/example/
└── src/
    └── routes/
        └── api/
            └── tts/
                ├── synthesize/+server.ts
                └── voices/+server.ts
```

---

## Provider Specifications

### Core Server Provider Interface

```typescript
// packages/tts-server-core/src/provider.ts

/**
 * Server-side TTS Provider interface
 */
export interface ITTSServerProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly version: string;

  initialize(config: TTSServerConfig): Promise<void>;
  synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse>;
  getVoices(options?: GetVoicesOptions): Promise<Voice[]>;
  getCapabilities(): ServerProviderCapabilities;
  destroy(): Promise<void>;
}

export interface SynthesizeRequest {
  text: string;
  voice?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  format?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: number;
  includeSpeechMarks?: boolean;
}

export interface SynthesizeResponse {
  audio: Buffer | string;
  contentType: string;
  speechMarks: SpeechMark[];
  metadata: {
    providerId: string;
    voice: string;
    duration: number;
    charCount: number;
    cached: boolean;
  };
}

export interface SpeechMark {
  time: number;
  type: 'word' | 'sentence' | 'ssml';
  start: number;
  end: number;
  value: string;
}
```

---

## API Design

### POST `/api/tts/synthesize`

Synthesize text to speech and return audio + speech marks.

**Request:**
```typescript
{
  "text": string;
  "provider": string;
  "voice"?: string;
  "language"?: string;
  "rate"?: number;
  "includeSpeechMarks"?: boolean;
}
```

**Response:**
```typescript
{
  "audio": string;
  "contentType": string;
  "speechMarks": SpeechMark[];
  "metadata": {
    "providerId": string;
    "voice": string;
    "duration": number;
    "charCount": number;
    "cached": boolean;
  }
}
```

### GET `/api/tts/voices`

Get available voices for a provider.

**Query Parameters:**
- `provider` - Provider ID
- `language` - Filter by language
- `quality` - Filter by quality

**Response:**
```typescript
{
  "voices": Voice[]
}
```

---

## Implementation Steps

### Phase 1: Core Foundation (Week 1)

1. Create `tts-server-core` package with interfaces
2. Create `tts-server-polly` package based on pieoneer
3. Create `tts-service-backend` package with Express
4. Implement Redis caching

### Phase 2: Client Integration (Week 2)

5. Create `tts-client-server` package
6. Update assessment-toolkit integration
7. Create demo app API routes

### Phase 3: Additional Providers (Week 3)

8. Create `tts-server-google` package
9. Create `tts-server-elevenlabs` package
10. Update backend router for multiple providers

### Phase 4: Production Features (Week 4)

11. Add monitoring and logging
12. Implement rate limiting
13. Create Docker deployment
14. Set up CI/CD

---

## Migration Path

### Current (Client-Side Polly)

```typescript
import { PollyTTSProvider } from '@pie-players/pie-tts-polly';

const ttsService = new TTSService();
await ttsService.initialize(new PollyTTSProvider({
  region: 'us-east-1',
  credentials: {
    accessKeyId: AWS_KEY,    // ❌ Exposed in browser
    secretAccessKey: AWS_SECRET,
  },
}));
```

### New (Server-Side API)

```typescript
import { ServerTTSProvider } from '@pie-players/tts-client-server';

const ttsService = new TTSService();
await ttsService.initialize(new ServerTTSProvider({
  apiEndpoint: '/api/tts',
  provider: 'polly',
  // No credentials needed!
}));
```

---

## Testing Strategy

- **Unit Tests:** 90%+ coverage
- **Integration Tests:** All API endpoints
- **E2E Tests:** Client to server flow
- **Performance Tests:** Load and caching

---

## Deployment Considerations

### Environment Variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=yyy
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
```

### Docker Deployment

```yaml
services:
  tts-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - AWS_REGION=us-east-1
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
```

---

## Provider Comparison Matrix

| Feature | AWS Polly | Google Cloud | ElevenLabs | Browser |
|---------|-----------|--------------|------------|---------|
| Voice Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speech Marks | ✅ Native | ⚠️ Process | ❌ Estimate | ✅ Native |
| SSML | ✅ Full | ✅ Full | ❌ None | ⚠️ Limited |
| Languages | 25+ | 40+ | English | Varies |
| Cost (1M) | $16 | $16 | $300 | Free |

### Recommendations

- **Development:** Browser TTS
- **Production:** AWS Polly with caching
- **Premium:** ElevenLabs for special content
- **International:** Google Cloud TTS

---

## Critical Files Reference

1. **`/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/packages/polly/src/synthesize.ts`**
   - Proven Polly implementation with speech marks

2. **`/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/containers/pieoneer/src/routes/(jwt)/api/tts/synthesize/+server.ts`**
   - API endpoint implementation

3. **`/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/containers/pieoneer/src/lib/services/tts/providers/PollyProvider.ts`**
   - Client-side provider template

---

## Next Steps

1. Review and approve architecture
2. Create package scaffolding
3. Implement Phase 1 (Core + Polly)
4. Test integration
5. Deploy to staging
6. Production rollout
