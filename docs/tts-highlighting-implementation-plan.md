# TTS Highlighting Synchronization Implementation Plan

## Executive Summary

This document outlines the implementation plan to fix TTS highlighting synchronization issues in pie-players by adopting the proven AWS Polly Speech Marks approach from the pieoneer project.

### Key Finding

The pieoneer implementation at `/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/containers/pieoneer/src/lib/assessment-toolkit` achieves excellent TTS highlighting synchronization through **AWS Polly Speech Marks** - a feature that provides millisecond-precise word timing metadata, which is not available from the browser's Web Speech API.

---

## Table of Contents

1. [Background & Problem Analysis](#background--problem-analysis)
2. [Pieoneer's Proven Solution](#pioneers-proven-solution)
3. [Implementation Strategy](#implementation-strategy)
4. [Phase 1: AWS Polly Speech Marks Integration](#phase-1-aws-polly-speech-marks-integration)
5. [Phase 2: Fix Remaining Issues](#phase-2-fix-remaining-issues)
6. [Phase 3: Polish & Optimization](#phase-3-polish--optimization)
7. [Testing Strategy](#testing-strategy)
8. [Success Criteria](#success-criteria)

---

## Background & Problem Analysis

### Current Issues in Pie-Players

Based on comprehensive analysis, the pie-players TTS implementation has four critical issues:

#### 1. Character Position Misalignment (HIGH)
- **Location:** [TTSService.ts:110-136](../packages/assessment-toolkit/src/services/TTSService.ts#L110-L136)
- **Problem:** Text node mapping doesn't handle HTML entities, multi-node words, or DOM mutations
- **Impact:** Words highlight incorrectly or not at all

#### 2. Polly Resume Not Implemented (HIGH)
- **Location:** [polly-provider.ts:200-207](../packages/tts-polly/src/polly-provider.ts#L200-L207)
- **Problem:** Resume just has a TODO comment; pausing/resuming restarts from beginning
- **Impact:** Poor user experience when pausing

#### 3. Browser Word Boundaries Unreliable (HIGH)
- **Location:** [browser-provider.ts:137-161](../packages/assessment-toolkit/src/services/tts/browser-provider.ts#L137-L161)
- **Problem:** Safari detection disables ALL highlighting; Chrome/Firefox boundaries work ~80% of time
- **Impact:** Inconsistent highlighting across browsers

#### 4. No Playback Position Tracking (MEDIUM)
- **Problem:** No way to get current playback time or progress
- **Impact:** Can't build progress bars or time-based features

### Root Cause: Browser Web Speech API Limitations

The browser's `onboundary` events are fundamentally unreliable:
- **Safari:** Word boundaries completely broken (returns same charIndex repeatedly)
- **Chrome/Edge:** Works ~80% of time (Bug 40715888)
- **Firefox:** Unreliable
- **All browsers:** No precise timing information, only character positions

**Conclusion:** Timer-based and browser event-based approaches cannot provide reliable synchronization.

---

## Pieoneer's Proven Solution

### Architecture Overview

```
Browser Client
    ↓
TTSService (Facade)
    ├── PollyProvider (AWS Polly - Premium)
    ├── WebSpeechProvider (Fallback)
    └── HighlightCoordinator (CSS Custom Highlight API)

PollyProvider
    ├── Synthesize request to server API
    ├── Receives: Audio (base64) + Speech Marks (WORD-level timing)
    └── Schedules highlighting via requestAnimationFrame

Server-Side (/api/tts/synthesize)
    ↓
AWS Polly SDK
    ├── Makes PARALLEL requests to AWS Polly:
    │   ├── Request 1: Audio synthesis (MP3 format)
    │   └── Request 2: Speech marks (JSON format, WORD type)
    └── Returns: { audio, contentType, speechMarks[] }
```

### What Are AWS Polly Speech Marks?

Speech marks are AWS Polly's feature providing **millisecond-precise word-level timing metadata**.

**Example Speech Marks for "Hello world":**
```json
[
  { "time": 0,    "type": "word", "start": 0,  "end": 5,  "value": "Hello" },
  { "time": 340,  "type": "word", "start": 6,  "end": 11, "value": "world" }
]
```

**Key advantages:**
- ✅ Millisecond-accurate timing
- ✅ Consistent across all browsers (server-side)
- ✅ Character position for each word
- ✅ Works with any playback mechanism

### Polling-Based Synchronization

Instead of relying on browser events, pieoneer polls audio playback time every 50ms:

```typescript
private startWordHighlighting(callbacks: TTSCallbacks): void {
  this.highlightInterval = window.setInterval(() => {
    const currentTime = this.currentAudio.currentTime * 1000; // ms

    // Find current word based on timing
    for (let i = 0; i < this.wordTimings.length; i++) {
      const timing = this.wordTimings[i];
      if (currentTime >= timing.time && i > lastWordIndex) {
        callbacks.onWord!(timing.wordIndex, timing.charIndex, timing.length);
        lastWordIndex = i;
        break;
      }
    }
  }, 50);
}
```

**Why this works:**
- Audio playback time is accurate across all browsers
- Speech marks provide exact timing to compare against
- 50ms polling is smooth enough for highlighting
- No dependency on unreliable browser events

---

## Implementation Strategy

### Updated Approach: Port Pieoneer's Solution

Instead of trying to fix the unreliable browser-based approach, we'll port pieoneer's proven AWS Polly speech marks implementation to pie-players.

### Three-Phase Implementation

1. **Phase 1:** AWS Polly Speech Marks Integration (Core solution)
2. **Phase 2:** Fix Remaining Issues (Text mapping, resume, position tracking)
3. **Phase 3:** Polish & Optimization (Caching, error handling, testing)

---

## Phase 1: AWS Polly Speech Marks Integration

### Overview

Implement AWS Polly provider with speech marks support, following pieoneer's architecture.

### Step 1.1: Create Speech Marks Types & Utilities

**New file:** `/packages/assessment-toolkit/src/services/tts/speechMarks.ts`

```typescript
/**
 * AWS Polly Speech Mark
 * Represents a timing event from AWS Polly synthesis
 */
export interface SpeechMark {
  time: number;      // Milliseconds from start of audio
  type: string;      // 'word', 'sentence', 'viseme', 'ssml'
  start: number;     // Character position in original text
  end: number;       // Character end position
  value: string;     // The actual word or text
}

/**
 * Word timing information for highlighting
 */
export interface WordTiming {
  time: number;      // Milliseconds from start
  wordIndex: number; // Index of word in sequence
  charIndex: number; // Character position in original text
  length: number;    // Length of word in characters
}

/**
 * Parse AWS Polly speech marks into word timings
 */
export function parseSpeechMarks(marks: SpeechMark[]): WordTiming[] {
  return marks
    .filter(mark => mark.type === 'word')
    .map((mark, index) => ({
      time: mark.time,
      wordIndex: index,
      charIndex: mark.start,
      length: mark.end - mark.start,
    }));
}

/**
 * Estimate word timings when speech marks unavailable
 * Fallback mechanism - not as accurate as real marks
 */
export function estimateWordTimings(text: string): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const msPerWord = (60 * 1000) / 150; // 150 words/min average

  let charIndex = 0;
  const timings: WordTiming[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Find word position in original text
    const wordStart = text.indexOf(word, charIndex);
    if (wordStart === -1) {
      charIndex += word.length + 1;
      continue;
    }

    timings.push({
      time: i * msPerWord,
      wordIndex: i,
      charIndex: wordStart,
      length: word.length,
    });

    charIndex = wordStart + word.length;
  }

  return timings;
}
```

### Step 1.2: Create Highlighting Synchronizer

**New file:** `/packages/assessment-toolkit/src/services/tts/HighlightingSynchronizer.ts`

```typescript
import type { WordTiming } from './speechMarks';

/**
 * Synchronizes word highlighting with audio playback
 * Uses polling-based approach with word timings from speech marks
 */
export class HighlightingSynchronizer {
  private interval: number | null = null;
  private lastWordIndex = -1;
  private isRunning = false;

  /**
   * Start synchronizing highlights with audio playback
   *
   * @param audio - HTMLAudioElement to track
   * @param timings - Word timings from speech marks
   * @param onWord - Callback fired when word should be highlighted
   */
  start(
    audio: HTMLAudioElement,
    timings: WordTiming[],
    onWord: (wordIndex: number, charIndex: number, length: number) => void
  ): void {
    this.stop();
    this.lastWordIndex = -1;
    this.isRunning = true;

    // Poll every 50ms for smooth highlighting
    this.interval = window.setInterval(() => {
      if (!this.isRunning) {
        this.stop();
        return;
      }

      // Get current playback time in milliseconds
      const currentTime = audio.currentTime * 1000;

      // Find words that should be highlighted at current time
      for (let i = 0; i < timings.length; i++) {
        const timing = timings[i];

        // Check if we've reached this word's time and haven't highlighted it yet
        if (currentTime >= timing.time && i > this.lastWordIndex) {
          // Fire callback with word information
          onWord(timing.wordIndex, timing.charIndex, timing.length);
          this.lastWordIndex = i;

          // Only highlight one word per polling interval
          break;
        }
      }
    }, 50); // 50ms = 20 times per second, smooth enough
  }

  /**
   * Stop synchronization
   */
  stop(): void {
    this.isRunning = false;

    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.lastWordIndex = -1;
  }

  /**
   * Reset to beginning (e.g., when seeking)
   */
  reset(): void {
    this.lastWordIndex = -1;
  }

  /**
   * Check if synchronizer is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
```

### Step 1.3: Update Polly Provider for Speech Marks

**File:** `/packages/tts-polly/src/polly-provider.ts`

**Major changes:**

1. Add speech marks to provider configuration:
```typescript
interface PollyProviderConfig {
  // ... existing config ...
  enableSpeechMarks?: boolean; // Default: true
  apiEndpoint?: string; // Server endpoint for Polly synthesis
}
```

2. Update speak method to request speech marks:
```typescript
import { parseSpeechMarks, type WordTiming } from '../assessment-toolkit/src/services/tts/speechMarks';
import { HighlightingSynchronizer } from '../assessment-toolkit/src/services/tts/HighlightingSynchronizer';

private wordTimings: WordTiming[] = [];
private synchronizer = new HighlightingSynchronizer();
private currentAudio: HTMLAudioElement | null = null;

async speak(text: string): Promise<void> {
  // Call server endpoint for Polly synthesis
  const response = await fetch(this.config.apiEndpoint || '/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceId: this.config.voiceId || 'Joanna',
      engine: 'neural',
      enableSpeechMarks: this.config.enableSpeechMarks !== false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Polly synthesis failed: ${response.statusText}`);
  }

  const { audio, speechMarks } = await response.json();

  // Parse speech marks into word timings
  if (speechMarks && speechMarks.length > 0) {
    this.wordTimings = parseSpeechMarks(speechMarks);
    console.log(`[PollyProvider] Received ${this.wordTimings.length} word timings`);
  } else {
    console.warn('[PollyProvider] No speech marks received, using estimation fallback');
    this.wordTimings = estimateWordTimings(text);
  }

  // Convert base64 audio to blob and create audio element
  const audioBlob = this.base64ToBlob(audio, 'audio/mpeg');
  const audioUrl = URL.createObjectURL(audioBlob);

  this.currentAudio = new Audio(audioUrl);
  this.audioDuration = 0;

  // Setup audio event handlers
  return new Promise((resolve, reject) => {
    if (!this.currentAudio) {
      reject(new Error('Failed to create audio element'));
      return;
    }

    this.currentAudio.onloadedmetadata = () => {
      if (this.currentAudio) {
        this.audioDuration = this.currentAudio.duration;
      }
    };

    this.currentAudio.onended = () => {
      this.synchronizer.stop();
      this._isPlaying = false;
      this._isPaused = false;
      resolve();
    };

    this.currentAudio.onerror = (error) => {
      this.synchronizer.stop();
      reject(new Error('Audio playback failed'));
    };

    // Start word highlighting if callback provided
    if (this.onWordBoundary && this.wordTimings.length > 0) {
      this.startWordHighlighting();
    }

    // Play audio
    this.currentAudio.play()
      .then(() => {
        this._isPlaying = true;
        this._isPaused = false;
      })
      .catch(reject);
  });
}

private startWordHighlighting(): void {
  if (!this.currentAudio || !this.onWordBoundary) return;

  this.synchronizer.start(
    this.currentAudio,
    this.wordTimings,
    (wordIndex, charIndex, length) => {
      // Extract actual word from text (for logging/debugging)
      const word = this.lastSpokenText.substring(charIndex, charIndex + length);
      console.log(`[PollyProvider] Highlighting word: "${word}" at ${charIndex}`);

      if (this.onWordBoundary) {
        this.onWordBoundary(word, charIndex);
      }
    }
  );
}

private base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

stop(): void {
  this.synchronizer.stop();

  if (this.currentAudio) {
    this.currentAudio.pause();
    this.currentAudio.src = '';
    this.currentAudio = null;
  }

  this._isPlaying = false;
  this._isPaused = false;
}
```

3. Update pause/resume with proper audio buffer handling:
```typescript
pause(): void {
  if (this.currentAudio && !this._isPaused && this._isPlaying) {
    this.currentAudio.pause();
    this.synchronizer.stop(); // Pause synchronization

    this.pausedAt = this.currentAudio.currentTime;
    this._isPaused = true;
    this._isPlaying = false;

    console.log(`[PollyProvider] Paused at ${this.pausedAt.toFixed(2)}s`);
  }
}

resume(): void {
  if (this.currentAudio && this._isPaused) {
    // Resume audio playback
    this.currentAudio.play()
      .then(() => {
        this._isPaused = false;
        this._isPlaying = true;

        // Restart word highlighting from current position
        if (this.onWordBoundary && this.wordTimings.length > 0) {
          // Reset to find the correct word based on current time
          this.synchronizer.reset();
          this.startWordHighlighting();
        }

        console.log(`[PollyProvider] Resumed from ${this.pausedAt.toFixed(2)}s`);
      })
      .catch(error => {
        console.error('[PollyProvider] Resume failed:', error);
        this._isPaused = false;
        this._isPlaying = false;
      });
  }
}
```

4. Update capabilities:
```typescript
getCapabilities(): TTSProviderCapabilities {
  return {
    supportsPause: true,
    supportsResume: true,
    supportsWordBoundary: true, // ✅ Now actually supported via speech marks!
    supportsVoiceSelection: true,
    supportsRateControl: true,
    supportsPitchControl: false,
    maxTextLength: 3000,
  };
}
```

### Step 1.4: Create Server-Side API Endpoint

**New file:** `/packages/tts-polly/src/server/synthesize.ts`

```typescript
import { PollyClient, SynthesizeSpeechCommand, Engine, OutputFormat, SpeechMarkType, VoiceId } from '@aws-sdk/client-polly';
import type { SpeechMark } from '../assessment-toolkit/src/services/tts/speechMarks';

interface SynthesizeRequest {
  text: string;
  voiceId?: string;
  engine?: 'neural' | 'standard';
  enableSpeechMarks?: boolean;
}

interface SynthesizeResponse {
  audio: string; // base64 encoded
  contentType: string;
  speechMarks?: SpeechMark[];
}

/**
 * Server-side function to synthesize speech with AWS Polly
 * Makes parallel requests for audio and speech marks
 */
export async function synthesizeSpeech(
  request: SynthesizeRequest
): Promise<SynthesizeResponse> {
  const pollyClient = new PollyClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const { text, voiceId = 'Joanna', engine = 'neural', enableSpeechMarks = true } = request;

  // Create audio synthesis command
  const audioCommand = new SynthesizeSpeechCommand({
    Engine: engine === 'neural' ? Engine.NEURAL : Engine.STANDARD,
    OutputFormat: OutputFormat.MP3,
    Text: text,
    TextType: 'text',
    VoiceId: voiceId as VoiceId,
  });

  // Create speech marks command
  const speechMarksCommand = new SynthesizeSpeechCommand({
    Engine: engine === 'neural' ? Engine.NEURAL : Engine.STANDARD,
    OutputFormat: OutputFormat.JSON,
    Text: text,
    TextType: 'text',
    VoiceId: voiceId as VoiceId,
    SpeechMarkTypes: [SpeechMarkType.WORD],
  });

  // Make parallel requests for better performance
  const promises = [pollyClient.send(audioCommand)];
  if (enableSpeechMarks) {
    promises.push(pollyClient.send(speechMarksCommand));
  }

  const [audioResponse, speechMarksResponse] = await Promise.all(promises);

  // Convert audio stream to base64
  const audioChunks: Uint8Array[] = [];
  if (audioResponse.AudioStream) {
    const stream = audioResponse.AudioStream;

    if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        audioChunks.push(chunk);
      }
    } else if (stream instanceof Uint8Array) {
      audioChunks.push(stream);
    }
  }

  const audioBuffer = Buffer.concat(audioChunks);
  const audioBase64 = audioBuffer.toString('base64');

  // Parse speech marks (NDJSON format - one JSON object per line)
  let speechMarks: SpeechMark[] = [];
  if (enableSpeechMarks && speechMarksResponse?.AudioStream) {
    const marksChunks: Uint8Array[] = [];
    const marksStream = speechMarksResponse.AudioStream;

    if (Symbol.asyncIterator in marksStream) {
      for await (const chunk of marksStream as AsyncIterable<Uint8Array>) {
        marksChunks.push(chunk);
      }
    } else if (marksStream instanceof Uint8Array) {
      marksChunks.push(marksStream);
    }

    const marksText = Buffer.concat(marksChunks).toString('utf-8');

    // Parse NDJSON (newline-delimited JSON)
    speechMarks = marksText
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  return {
    audio: audioBase64,
    contentType: audioResponse.ContentType || 'audio/mpeg',
    speechMarks: enableSpeechMarks ? speechMarks : undefined,
  };
}
```

**Note:** This is a server-side function. You'll need to integrate it into your backend API (Express, Next.js API route, etc.).

### Step 1.5: Update TTSService Integration

**File:** `/packages/assessment-toolkit/src/services/TTSService.ts`

No major changes needed! The existing word boundary callback system works:

```typescript
// Existing code in speak() method already handles this:
if (this.highlightCoordinator && this.currentContentElement) {
  this.provider.onWordBoundary = (word, charIndex) => {
    console.log(`[TTSService] Word boundary event: "${word}" at position ${charIndex}`);
    const location = this.findTextNodeAtPosition(charIndex, word.length);
    if (location && this.highlightCoordinator) {
      this.highlightCoordinator.highlightTTSWord(
        location.node,
        location.start,
        location.end
      );
    }
  };
}
```

The beauty of this approach: **TTSService doesn't need to know about speech marks**. The Polly provider handles all the timing logic and fires the existing `onWordBoundary` callback at the right times.

---

## Phase 2: Fix Remaining Issues

Now that we have reliable word boundary events from speech marks, we can fix the remaining issues.

### Step 2.1: Create TextNodeMapper Utility

**New file:** `/packages/assessment-toolkit/src/services/tts/TextNodeMapper.ts`

```typescript
interface TextNodeMapping {
  node: Text;
  start: number; // Character position in full text
  end: number;
}

export interface TextNodeLocation {
  node: Text;
  start: number; // Offset within node
  end: number;   // Offset within node
}

/**
 * Maps character positions to DOM text nodes
 * Handles HTML entities, multi-node words, and whitespace normalization
 */
export class TextNodeMapper {
  private textNodeMap: TextNodeMapping[] = [];
  private totalLength = 0;
  private plainText = '';

  constructor(rootElement: Element) {
    this.buildMap(rootElement);
  }

  /**
   * Build mapping of text nodes with character positions
   */
  private buildMap(element: Element): void {
    this.textNodeMap = [];
    this.plainText = '';
    let currentPosition = 0;

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const text = textNode.textContent || '';

        // Normalize whitespace to match what TTS engine sees
        const normalizedText = this.normalizeText(text);

        if (normalizedText.length > 0) {
          this.textNodeMap.push({
            node: textNode,
            start: currentPosition,
            end: currentPosition + normalizedText.length,
          });

          this.plainText += normalizedText;
          currentPosition += normalizedText.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;

        // Skip script and style elements
        if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
          return;
        }

        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
      }
    };

    walk(element);
    this.totalLength = currentPosition;
  }

  /**
   * Normalize text to match TTS engine's view
   */
  private normalizeText(text: string): string {
    // Collapse multiple spaces to single space
    // Convert non-breaking spaces to regular spaces
    // Trim leading/trailing whitespace
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find all text nodes that intersect with character range
   * Handles words that span multiple DOM text nodes
   */
  findNodesAtPosition(charIndex: number, length: number): TextNodeLocation[] {
    const result: TextNodeLocation[] = [];
    const endIndex = charIndex + length;

    for (const mapping of this.textNodeMap) {
      // Check if this node intersects the range
      if (charIndex < mapping.end && endIndex > mapping.start) {
        // Calculate local offsets within this node
        const localStart = Math.max(0, charIndex - mapping.start);
        const localEnd = Math.min(
          mapping.node.textContent!.length,
          endIndex - mapping.start
        );

        result.push({
          node: mapping.node,
          start: localStart,
          end: localEnd,
        });
      }
    }

    return result;
  }

  /**
   * Validate that DOM hasn't changed since mapping
   */
  validateMapping(): boolean {
    let currentText = '';

    for (const mapping of this.textNodeMap) {
      const text = mapping.node.textContent || '';
      currentText += this.normalizeText(text);
    }

    return currentText === this.plainText;
  }

  /**
   * Get total character count
   */
  getTotalLength(): number {
    return this.totalLength;
  }

  /**
   * Get plain text that TTS will speak
   */
  getPlainText(): string {
    return this.plainText;
  }
}
```

### Step 2.2: Update TTSService to Use TextNodeMapper

**File:** `/packages/assessment-toolkit/src/services/TTSService.ts`

```typescript
import { TextNodeMapper } from './tts/TextNodeMapper';

// Replace textNodeMap with TextNodeMapper
private textNodeMapper: TextNodeMapper | null = null;

// In speak() method, replace buildTextNodeMap() call:
if (this.currentContentElement && this.highlightCoordinator) {
  // Build text node mapping
  this.textNodeMapper = new TextNodeMapper(this.currentContentElement);

  // Verify extracted text matches what we're speaking
  const extractedText = this.textNodeMapper.getPlainText();
  if (extractedText !== contentToSpeak.trim()) {
    console.warn('[TTSService] Text mismatch between DOM and TTS', {
      extracted: extractedText.substring(0, 50) + '...',
      toSpeak: contentToSpeak.substring(0, 50) + '...',
    });
  }

  // Setup word boundary handler with multi-node support
  this.provider.onWordBoundary = (word, charIndex) => {
    // Validate mapping still valid
    if (!this.textNodeMapper?.validateMapping()) {
      console.warn('[TTSService] DOM changed during playback, disabling highlighting');
      this.provider.onWordBoundary = undefined;
      return;
    }

    // Find all text nodes intersecting this word
    const locations = this.textNodeMapper.findNodesAtPosition(charIndex, word.length);

    if (locations.length === 0) {
      console.warn(`[TTSService] Could not find text node for word "${word}" at position ${charIndex}`);
      return;
    }

    // Highlight each node segment
    for (const location of locations) {
      if (this.highlightCoordinator) {
        this.highlightCoordinator.highlightTTSWord(
          location.node,
          location.start,
          location.end
        );
      }
    }
  };
}
```

### Step 2.3: Update HighlightCoordinator for Multi-Node Words

**File:** `/packages/assessment-toolkit/src/services/HighlightCoordinator.ts`

```typescript
/**
 * Highlight TTS word (may span multiple text nodes)
 * Uses requestAnimationFrame for smooth rendering
 */
highlightTTSWord(textNode: Text, startOffset: number, endOffset: number): void {
  if (!this.ttsWordHighlight) return;

  // Use requestAnimationFrame for smooth rendering
  requestAnimationFrame(() => {
    if (!this.ttsWordHighlight) return;

    // Clear previous word highlight
    this.ttsWordHighlight.clear();

    // Add range for this word segment
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);
    this.ttsWordHighlight.add(range);
  });
}
```

**Note:** The current API takes single node parameters. For true multi-node support, consider creating an overload or alternative method:

```typescript
highlightTTSWordMultiNode(locations: Array<{node: Text, start: number, end: number}>): void {
  if (!this.ttsWordHighlight) return;

  requestAnimationFrame(() => {
    if (!this.ttsWordHighlight) return;

    this.ttsWordHighlight.clear();

    for (const location of locations) {
      const range = document.createRange();
      range.setStart(location.node, location.start);
      range.setEnd(location.node, location.end);
      this.ttsWordHighlight.add(range);
    }
  });
}
```

### Step 2.4: Add Playback Position Tracking

**Update provider interface:** `/packages/assessment-toolkit/src/services/interfaces.ts`

```typescript
export interface ITTSProviderImplementation {
  // ... existing methods ...

  /**
   * Get current playback position in seconds
   * Returns null if not playing or not supported
   */
  getCurrentTime(): number | null;

  /**
   * Get total duration in seconds
   * Returns null if not available or not supported
   */
  getDuration(): number | null;

  /**
   * Get playback progress (0.0 to 1.0)
   * Returns null if not available
   */
  getProgress(): number | null;
}
```

**Implement in PollyProvider:**

```typescript
getCurrentTime(): number | null {
  if (!this.currentAudio) return null;

  if (this._isPaused) {
    return this.pausedAt;
  }

  if (!this._isPlaying) {
    return null;
  }

  return this.currentAudio.currentTime;
}

getDuration(): number | null {
  if (!this.currentAudio) return null;
  return this.audioDuration > 0 ? this.audioDuration : null;
}

getProgress(): number | null {
  const current = this.getCurrentTime();
  const duration = this.getDuration();

  if (current === null || duration === null || duration === 0) {
    return null;
  }

  return Math.min(1.0, current / duration);
}
```

**Add to TTSService:**

```typescript
/**
 * Get current playback time in seconds
 */
getCurrentTime(): number | null {
  if (!this.provider) return null;
  return this.provider.getCurrentTime();
}

/**
 * Get total duration in seconds
 */
getDuration(): number | null {
  if (!this.provider) return null;
  return this.provider.getDuration();
}

/**
 * Get playback progress (0.0 to 1.0)
 */
getProgress(): number | null {
  if (!this.provider) return null;
  return this.provider.getProgress();
}

/**
 * Subscribe to progress updates
 */
onProgress(callback: (progress: number) => void): () => void {
  const progressInterval = setInterval(() => {
    const progress = this.getProgress();
    if (progress !== null) {
      callback(progress);
    }
  }, 100);

  // Return cleanup function
  return () => clearInterval(progressInterval);
}
```

---

## Phase 3: Polish & Optimization

### Step 3.1: Add Redis Caching (Optional)

For production environments, cache Polly synthesis results to reduce API calls and costs.

**Cache key structure:**
```typescript
const cacheKey = `tts:${voiceId}:${engine}:${hash(text)}`;
```

**TTL:** 24 hours (same as pieoneer)

**Implementation:** Use your existing Redis setup or add ioredis:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedSynthesis(cacheKey: string): Promise<SynthesizeResponse | null> {
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

async function cacheSynthesis(cacheKey: string, response: SynthesizeResponse): Promise<void> {
  await redis.setex(cacheKey, 86400, JSON.stringify(response)); // 24 hours
}
```

### Step 3.2: Improve Browser Provider Fallback

Keep browser provider as fallback, but acknowledge limitations:

```typescript
// In browser-provider.ts
async speak(text: string): Promise<void> {
  console.warn('[BrowserProvider] Using browser TTS - word highlighting may be unreliable. Consider using AWS Polly for production.');

  // Continue with existing implementation...
}
```

### Step 3.3: Add Configuration Options

```typescript
interface TTSServiceConfig {
  // Provider selection
  preferredProvider?: 'polly' | 'browser'; // default: 'polly'
  pollyApiEndpoint?: string; // default: '/api/tts/synthesize'

  // Speech marks
  enableSpeechMarks?: boolean; // default: true
  fallbackToEstimation?: boolean; // default: true

  // Highlighting
  enableWordHighlighting?: boolean; // default: true
  enableSentenceHighlighting?: boolean; // default: true

  // Performance
  enableCaching?: boolean; // default: true (if Redis available)

  // Synchronization
  pollingInterval?: number; // default: 50ms

  // DOM validation
  enableMutationDetection?: boolean; // default: true
}
```

### Step 3.4: Error Handling & Logging

Add comprehensive error handling:

```typescript
try {
  await ttsService.speak(text, { provider: 'polly' });
} catch (error) {
  if (error.code === 'POLLY_API_ERROR') {
    console.warn('Polly failed, falling back to browser TTS');
    await ttsService.speak(text, { provider: 'browser' });
  } else {
    console.error('TTS failed:', error);
  }
}
```

---

## Testing Strategy

### Unit Tests

**New test files:**
1. `/packages/assessment-toolkit/src/services/tts/speechMarks.test.ts`
2. `/packages/assessment-toolkit/src/services/tts/HighlightingSynchronizer.test.ts`
3. `/packages/assessment-toolkit/src/services/tts/TextNodeMapper.test.ts`
4. `/packages/tts-polly/src/polly-provider.test.ts` (update)

### Integration Tests

**Test scenarios:**
1. ✅ Speech marks parsing from AWS Polly response
2. ✅ Word highlighting synchronizes with audio playback
3. ✅ Multi-node words highlight correctly
4. ✅ HTML entities handled correctly
5. ✅ Pause/resume maintains position
6. ✅ Progress tracking accurate
7. ✅ Fallback to browser TTS works
8. ✅ DOM mutations detected
9. ✅ Long content (3000+ characters)
10. ✅ Nested HTML structures

### Browser Compatibility Testing

**Target browsers:**
- Chrome (latest) ✅
- Firefox (latest) ✅
- Safari (latest) ✅
- Edge (latest) ✅
- Mobile Safari ✅
- Mobile Chrome ✅

**Key tests:**
- Audio playback works
- Highlighting renders correctly
- CSS Custom Highlight API support
- Performance is acceptable

### Manual Testing Checklist

- [ ] Word highlighting aligns with speech in simple text
- [ ] Word highlighting works with HTML entities (`&nbsp;`, `&mdash;`)
- [ ] Word highlighting works with formatted text (bold, italic, links)
- [ ] Words spanning multiple nodes highlight correctly
- [ ] Pause/resume works correctly (Polly)
- [ ] Progress bar updates smoothly
- [ ] Fallback to browser TTS works when Polly unavailable
- [ ] No memory leaks after multiple play/stop cycles
- [ ] Works with QTI accessibility catalogs
- [ ] Screen reader compatibility maintained
- [ ] Mobile devices work correctly

---

## Success Criteria

### Phase 1 Complete When:

1. **AWS Polly Speech Marks Integration**
   - [ ] Speech marks requested and parsed correctly
   - [ ] HighlightingSynchronizer polls audio time accurately
   - [ ] Word boundaries fire at correct times (±50ms accuracy)
   - [ ] Server API endpoint returns audio + speech marks
   - [ ] Polly provider resume works correctly

2. **Highlighting Synchronization**
   - [ ] Words highlight in sync with audio (visual confirmation)
   - [ ] No missed words
   - [ ] No highlighting drift over long content
   - [ ] Works across all target browsers

### Phase 2 Complete When:

3. **Text Alignment (Issue 1 Fixed)**
   - [ ] HTML entities handled correctly
   - [ ] Multi-node words highlight properly
   - [ ] No highlighting errors with complex HTML
   - [ ] 100% test coverage for TextNodeMapper

4. **Position Tracking (Issue 4 Fixed)**
   - [ ] getCurrentTime() returns accurate position
   - [ ] getDuration() returns total duration
   - [ ] getProgress() returns 0.0-1.0 progress
   - [ ] Progress events fire regularly (100ms)
   - [ ] Can build progress bar with real-time updates

### Phase 3 Complete When:

5. **Polish & Optimization**
   - [ ] Redis caching reduces Polly API calls
   - [ ] Error handling gracefully falls back
   - [ ] Configuration options work correctly
   - [ ] Documentation complete
   - [ ] All tests passing

---

## Implementation Timeline

### Week 1: AWS Polly Speech Marks Core (Phase 1)

**Days 1-2:**
- Create speech marks types and utilities
- Create HighlightingSynchronizer
- Write unit tests

**Days 3-4:**
- Update Polly provider for speech marks
- Create server-side synthesis endpoint
- Integration testing

**Day 5:**
- Test synchronization accuracy
- Fix any timing issues
- Documentation

### Week 2: Fix Remaining Issues (Phase 2)

**Days 1-2:**
- Create TextNodeMapper utility
- Update TTSService integration
- Multi-node word support

**Days 3-4:**
- Add playback position tracking
- Update HighlightCoordinator
- Integration testing

**Day 5:**
- Edge case testing
- Bug fixes
- Documentation

### Week 3: Polish & Production Ready (Phase 3)

**Days 1-2:**
- Add Redis caching
- Improve error handling
- Configuration options

**Days 3-4:**
- Browser compatibility testing
- Performance optimization
- Final bug fixes

**Day 5:**
- Documentation completion
- Demo preparation
- Release preparation

---

## Migration & Breaking Changes

### Breaking Changes

#### HighlightCoordinator API Change (Optional)

**Old:**
```typescript
highlightTTSWord(textNode: Text, startOffset: number, endOffset: number): void
```

**New (if implementing multi-node overload):**
```typescript
highlightTTSWord(textNode: Text, startOffset: number, endOffset: number): void
highlightTTSWordMultiNode(locations: Array<{node: Text, start: number, end: number}>): void
```

**Migration:** Backward compatible - old method still works.

#### Provider Interface Extension

**Added methods:**
- `getCurrentTime(): number | null`
- `getDuration(): number | null`
- `getProgress(): number | null`

**Migration:** All methods return null if not supported, so existing providers continue to work.

### Configuration Requirements

**New environment variables needed:**
```bash
# AWS Polly credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379

# Optional: Custom API endpoint
TTS_API_ENDPOINT=/api/tts/synthesize
```

---

## Cost Considerations

### AWS Polly Pricing (as of 2024)

- **Standard voices:** $4 per 1 million characters
- **Neural voices:** $16 per 1 million characters
- **Speech marks:** Included (no extra charge)

### Example Costs

**Scenario:** Educational assessment with 1000 students, each listening to 5 passages of 500 words each

- Total characters: 1000 students × 5 passages × 500 words × 5 chars/word = **12.5M characters**
- Cost with neural voices: **~$200** (without caching)
- Cost with 24-hour caching: **Depends on unique content** (could be as low as $20 if content is reused)

### Caching ROI

With Redis caching and typical content reuse patterns:
- **First synthesis:** Full Polly cost
- **Subsequent requests (24 hrs):** $0 (served from cache)
- **Typical savings:** 70-90% reduction in API costs

---

## Key Files Modified/Created

### New Files

| File | Purpose |
|------|---------|
| `/packages/assessment-toolkit/src/services/tts/speechMarks.ts` | Speech marks types and parsing |
| `/packages/assessment-toolkit/src/services/tts/HighlightingSynchronizer.ts` | Polling-based synchronization |
| `/packages/assessment-toolkit/src/services/tts/TextNodeMapper.ts` | DOM text node mapping utility |
| `/packages/tts-polly/src/server/synthesize.ts` | Server-side Polly synthesis |

### Modified Files

| File | Changes |
|------|---------|
| `/packages/tts-polly/src/polly-provider.ts` | Speech marks integration, resume fix, position tracking |
| `/packages/assessment-toolkit/src/services/TTSService.ts` | TextNodeMapper integration, multi-node support |
| `/packages/assessment-toolkit/src/services/HighlightCoordinator.ts` | requestAnimationFrame, multi-node support |
| `/packages/assessment-toolkit/src/services/interfaces.ts` | Add position tracking methods |

---

## References

### Pieoneer Implementation

- **Location:** `/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/containers/pieoneer/src/lib/assessment-toolkit/`
- **Key files:**
  - `services/tts/providers/PollyProvider.ts` - Speech marks implementation
  - `services/highlight/HighlightCoordinator.ts` - CSS Custom Highlight API
  - `services/highlight/HighlightManager.ts` - Low-level highlight operations
- **Server:** `/Users/eelco.hillenius/dev/prj/kds/pie-api-aws/packages/polly/src/synthesize.ts`

### AWS Documentation

- [AWS Polly Speech Marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)
- [AWS Polly Neural Voices](https://docs.aws.amazon.com/polly/latest/dg/ntts-main.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

### Browser APIs

- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [HTMLAudioElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement)

### Best Practices Guide

- [TTS Synchronization Best Practices](./tts-synchronization-best-practices.md) - Created by research agent

---

## Conclusion

By adopting AWS Polly speech marks and the polling-based synchronization approach proven in pieoneer, we can achieve reliable, millisecond-accurate TTS highlighting synchronization across all browsers.

The key insight: **Don't fight unreliable browser events. Use precise server-side timing from AWS Polly.**

This implementation plan provides a complete path from the current state to production-ready TTS with excellent highlighting synchronization.
