# @pie-players/tts-server-core

Core types, interfaces, and utilities for server-side Text-to-Speech (TTS) providers.

## Overview

This package provides the foundation for building server-side TTS providers that return audio with precise word-level timing metadata (speech marks) for synchronized highlighting.

## Features

- **Provider Interface** - Standard interface for all TTS providers
- **Speech Marks** - Unified format for word-level timing across providers
- **Caching** - Interface and utilities for caching synthesis results
- **Type Safety** - Full TypeScript support with comprehensive types
- **Utilities** - Helper functions for speech marks manipulation

## Installation

```bash
npm install @pie-players/tts-server-core
```

## Usage

### Implementing a Provider

```typescript
import { BaseTTSProvider, type SynthesizeRequest, type SynthesizeResponse } from '@pie-players/tts-server-core';

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

    // Your synthesis logic here
    const audio = await this.callTTSAPI(request.text);
    const speechMarks = await this.getSpeechMarks(request.text);

    return {
      audio,
      contentType: 'audio/mpeg',
      speechMarks,
      metadata: {
        providerId: this.providerId,
        voice: request.voice || 'default',
        duration: 0,
        charCount: request.text.length,
        cached: false,
      },
    };
  }

  // ... implement other required methods
}
```

### Using Speech Marks Utilities

```typescript
import { estimateSpeechMarks, adjustSpeechMarksForRate } from '@pie-players/tts-server-core';

// Generate estimated marks when provider doesn't support them
const marks = estimateSpeechMarks('Hello world');

// Adjust timing for different speech rates
const fasterMarks = adjustSpeechMarksForRate(marks, 1.5);
```

### Using Cache

```typescript
import { MemoryCache, generateHashedCacheKey } from '@pie-players/tts-server-core';

const cache = new MemoryCache();

// Generate cache key
const cacheKey = await generateHashedCacheKey({
  providerId: 'my-tts',
  text: 'Hello world',
  voice: 'default',
});

// Check cache
const cached = await cache.get(cacheKey);
if (cached) {
  return cached;
}

// Store in cache (24 hour TTL)
await cache.set(cacheKey, result, 86400);
```

## API Reference

### Types

- `SpeechMark` - Word timing information
- `SynthesizeRequest` - Synthesis request parameters
- `SynthesizeResponse` - Synthesis result with audio and marks
- `Voice` - Voice definition
- `ServerProviderCapabilities` - Provider feature flags

### Interfaces

- `ITTSServerProvider` - Provider interface
- `ITTSCache` - Cache interface

### Classes

- `BaseTTSProvider` - Abstract base class for providers
- `MemoryCache` - In-memory cache implementation
- `TTSError` - Structured error class

### Functions

- `estimateSpeechMarks()` - Generate estimated timing
- `adjustSpeechMarksForRate()` - Adjust for speech rate
- `validateSpeechMarks()` - Validate marks
- `generateCacheKey()` - Create cache key
- `hashText()` - SHA-256 hash for cache keys

## Speech Marks Format

All providers return speech marks in this unified format:

```typescript
interface SpeechMark {
  time: number;      // Milliseconds from audio start
  type: 'word' | 'sentence' | 'ssml';
  start: number;     // Character index (inclusive)
  end: number;       // Character index (exclusive)
  value: string;     // The word text
}
```

Example:
```json
[
  { "time": 0, "type": "word", "start": 0, "end": 5, "value": "Hello" },
  { "time": 340, "type": "word", "start": 6, "end": 11, "value": "world" }
]
```

## License

MIT
