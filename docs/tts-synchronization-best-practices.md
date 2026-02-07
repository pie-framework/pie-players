# TTS Synchronization Best Practices: Visual Word Highlighting in Web Applications

**Date:** February 6, 2026
**Status:** Research & Implementation Guide

---

## Executive Summary

This document compiles industry best practices, technical approaches, and implementation patterns for synchronizing Text-to-Speech (TTS) audio playback with visual word highlighting in web applications. Based on analysis of leading implementations, browser APIs, and cloud TTS services, this guide provides concrete technical recommendations with code examples.

**Key Finding:** Event-driven synchronization using word boundary events is the gold standard. Timer-based approaches are fundamentally unreliable and should be avoided.

---

## Table of Contents

1. [Industry Standards & Approaches](#1-industry-standards--approaches)
2. [Technical Synchronization Mechanisms](#2-technical-synchronization-mechanisms)
3. [CSS Custom Highlight API](#3-css-custom-highlight-api)
4. [SSML Capabilities](#4-ssml-capabilities)
5. [Common Pitfalls: Timer-Based Approaches](#5-common-pitfalls-timer-based-approaches)
6. [Alternative Synchronization Strategies](#6-alternative-synchronization-strategies)
7. [Implementation Recommendations](#7-implementation-recommendations)
8. [Code Examples](#8-code-examples)

---

## 1. Industry Standards & Approaches

### Leading TTS Implementations

Leading assistive technology solutions employ sophisticated synchronization mechanisms:

#### Google Read&Write, Microsoft Immersive Reader, ReadSpeaker

While specific implementation details are proprietary, these tools share common patterns:

- **Event-driven synchronization** rather than timer-based prediction
- **Multi-layered highlighting** (sentence + word level)
- **Server-side TTS with timing metadata** for precision
- **Fallback to browser TTS** when cloud services unavailable
- **DOM-preserving highlight methods** for accessibility

### Industry Standard Approach: Two-Layer Highlighting

```
┌─────────────────────────────────────────────┐
│  Sentence Layer (Background)                │
│  ┌────────────────────────────────────┐    │
│  │ Word Layer (Active)                │    │
│  │  [current]                          │    │
│  │                                      │    │
│  └────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**Benefits:**
- Provides context (sentence) while showing progress (word)
- Improves tracking for users with reading difficulties
- Reduces cognitive load by showing extent of current utterance

---

## 2. Technical Synchronization Mechanisms

### 2.1 Web Speech API (Browser TTS)

The browser's built-in `SpeechSynthesis` API provides word boundary events.

#### Boundary Event

```javascript
const utterance = new SpeechSynthesisUtterance(text);

utterance.onboundary = (event) => {
  // Event properties:
  // - event.name: "word" or "sentence"
  // - event.charIndex: Position in text (0-based)
  // - event.charLength: Length of current word
  // - event.elapsedTime: Time since speech started (seconds)

  if (event.name === "word") {
    const word = text.substring(
      event.charIndex,
      event.charIndex + event.charLength
    );
    highlightWord(word, event.charIndex);
  }
};

speechSynthesis.speak(utterance);
```

#### Browser Support

| Browser | Support | Known Issues |
|---------|---------|--------------|
| **Chrome** | 33+ | Boundary events unreliable (Bug 40715888) |
| **Edge** | 14+ | ✅ Good support |
| **Firefox** | 49+ | ✅ Good support |
| **Safari** | 7+ | ⚠️ Word boundaries broken (returns same index) |
| **Opera** | 21+ | ✅ Good support |

**Coverage:** ~95% global browser usage, but quality varies significantly.

#### Critical Issue: Safari Word Boundaries

Safari has a **long-standing bug** where `onboundary` events fire but return incorrect `charIndex` values (often repeating the same index).

**Detection Pattern:**

```javascript
let lastBoundaryIndex = -1;
let boundaryCount = 0;

utterance.onboundary = (event) => {
  if (event.name === "word") {
    boundaryCount++;

    // Detect Safari bug: multiple events at same position
    if (event.charIndex === lastBoundaryIndex && boundaryCount > 2) {
      console.warn('Browser word boundaries broken - disabling highlighting');
      utterance.onboundary = null; // Stop listening
      return;
    }

    lastBoundaryIndex = event.charIndex;
    highlightWord(event.charIndex, event.charLength);
  }
};
```

**Fallback Strategy:** When boundary events are broken, fall back to sentence-only highlighting (no word-level highlighting).

---

### 2.2 Cloud TTS Services with Timing Metadata

Cloud TTS providers offer superior synchronization through timing metadata.

#### AWS Polly Speech Marks

Polly provides **speech marks** - JSON-formatted timing metadata returned alongside or instead of audio.

**Speech Mark Types:**
- `sentence` - Sentence boundaries with timestamps
- `word` - Word-level timing (most important for highlighting)
- `ssml` - Custom SSML `<mark>` elements
- `viseme` - Phoneme-level data for lip-sync

**Word Speech Mark Format:**

```json
{
  "time": 125,
  "type": "word",
  "start": 0,
  "end": 5,
  "value": "Hello"
}
```

**Implementation Pattern:**

```javascript
// Request both audio and speech marks
const audioParams = {
  OutputFormat: 'mp3',
  Text: 'Hello world',
  VoiceId: 'Joanna'
};

const marksParams = {
  ...audioParams,
  OutputFormat: 'json',
  SpeechMarkTypes: ['word']
};

// Fetch both
const [audioData, marksData] = await Promise.all([
  polly.synthesizeSpeech(audioParams),
  polly.synthesizeSpeech(marksParams)
]);

// Parse speech marks (newline-delimited JSON)
const marks = marksData.AudioStream
  .toString()
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

// Play audio and sync with marks
const audio = new Audio(URL.createObjectURL(audioData.AudioStream));
audio.ontimeupdate = () => {
  const currentTime = audio.currentTime * 1000; // Convert to ms
  const currentMark = marks.find(
    mark => mark.time <= currentTime &&
            currentTime < (nextMark?.time || Infinity)
  );

  if (currentMark) {
    highlightWord(currentMark.start, currentMark.end);
  }
};

audio.play();
```

**Advantages:**
- Millisecond-precise timing
- Works across all browsers consistently
- Supports pause/resume with accurate synchronization
- Full SSML support including custom marks

**Trade-offs:**
- Requires network connectivity
- Added latency (~200-500ms)
- Cost: ~$16 per 1 million characters
- ~50KB additional SDK bundle size

#### Google Cloud TTS

Google TTS supports **timepoints** in audio response:

```javascript
const request = {
  input: {text: 'Hello world'},
  voice: {languageCode: 'en-US', name: 'en-US-Neural2-A'},
  audioConfig: {audioEncoding: 'MP3'},
  enableTimePointing: ['SSML_MARK'] // Request timing for marks
};

const [response] = await client.synthesizeSpeech(request);

// response.timepoints contains timing data
response.timepoints.forEach(timepoint => {
  console.log(`Mark: ${timepoint.markName} at ${timepoint.timeSeconds}s`);
});
```

Google TTS primarily uses **SSML marks** rather than automatic word boundaries. This requires pre-marking text:

```xml
<speak>
  <mark name="word1"/>Hello
  <mark name="word2"/>world
</speak>
```

#### Azure Speech Service

Azure provides **word boundary events** through its SDK:

```csharp
synthesizer.WordBoundary += (s, e) =>
{
    Console.WriteLine($"Word: {e.Text}");
    Console.WriteLine($"Audio offset: {e.AudioOffset / 10000}ms");
    Console.WriteLine($"Duration: {e.Duration / 10000}ms");

    HighlightWord(e.Text, e.AudioOffset / 10000);
};
```

Azure also provides **viseme events** with even finer granularity for lip-sync applications.

---

### 2.3 Text Node Mapping

To apply highlights to DOM content, maintain a mapping between character positions and text nodes.

**Challenge:** HTML contains mixed content (elements, text nodes, formatting). The character positions from TTS events refer to plain text, but highlighting must target specific DOM text nodes.

**Solution:** Build a text node map during initialization:

```javascript
class TextNodeMapper {
  constructor(containerElement) {
    this.textNodeMap = [];
    this.buildMap(containerElement);
  }

  buildMap(element) {
    let currentPosition = 0;

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim().length > 0) {
          this.textNodeMap.push({
            node: node,
            start: currentPosition,
            end: currentPosition + text.length
          });
          currentPosition += text.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
      }
    };

    walk(element);
  }

  findNodeAtPosition(charIndex, length) {
    for (const mapping of this.textNodeMap) {
      if (charIndex >= mapping.start && charIndex < mapping.end) {
        const localStart = charIndex - mapping.start;
        const localEnd = Math.min(
          localStart + length,
          mapping.node.textContent.length
        );

        return {
          node: mapping.node,
          start: localStart,
          end: localEnd
        };
      }
    }
    return null;
  }
}
```

**Usage:**

```javascript
const mapper = new TextNodeMapper(document.querySelector('.content'));

utterance.onboundary = (event) => {
  if (event.name === "word") {
    const location = mapper.findNodeAtPosition(
      event.charIndex,
      event.charLength
    );

    if (location) {
      highlightTextRange(location.node, location.start, location.end);
    }
  }
};
```

---

## 3. CSS Custom Highlight API

The modern standard for visual highlighting without DOM manipulation.

### Overview

The **CSS Custom Highlight API** (Chrome 105+, Edge 105+, Firefox 140+, Safari 17.2+) allows arbitrary text styling without modifying the DOM structure.

**Key Benefits:**
- Zero DOM mutation (preserves accessibility tree)
- Overlapping highlights supported (multiple layers)
- High performance (browser-optimized)
- Preserves text selection, copy-paste behavior
- Screen readers see original, unmodified text

**Browser Support:** ~93% global coverage (as of 2026)

### Basic API

```javascript
// 1. Create a Range for the text to highlight
const range = document.createRange();
range.setStart(textNode, startOffset);
range.setEnd(textNode, endOffset);

// 2. Create a Highlight object
const highlight = new Highlight(range);

// 3. Register in global highlights registry
CSS.highlights.set('tts-word', highlight);

// 4. Style with CSS
// In stylesheet or <style>:
// ::highlight(tts-word) {
//   background-color: yellow;
//   color: black;
// }
```

### Multi-Layer Architecture

For TTS, use **two separate highlight layers**:

```javascript
class HighlightCoordinator {
  constructor() {
    // Create separate highlights
    this.sentenceHighlight = new Highlight();
    this.wordHighlight = new Highlight();

    // Register both
    CSS.highlights.set('tts-sentence', this.sentenceHighlight);
    CSS.highlights.set('tts-word', this.wordHighlight);

    this.registerStyles();
  }

  registerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      ::highlight(tts-sentence) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      ::highlight(tts-word) {
        background-color: rgba(255, 235, 59, 0.4);
        color: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  highlightSentence(range) {
    this.sentenceHighlight.clear();
    this.sentenceHighlight.add(range);
  }

  highlightWord(textNode, start, end) {
    this.wordHighlight.clear();

    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);

    this.wordHighlight.add(range);
  }

  clearAll() {
    this.sentenceHighlight.clear();
    this.wordHighlight.clear();
  }
}
```

### Styling Best Practices

**Use semi-transparent backgrounds:**

```css
::highlight(tts-word) {
  background-color: rgba(255, 235, 59, 0.4); /* Yellow with 40% opacity */
  color: inherit; /* Don't override text color */
}
```

**Why transparency?**
- Works on dark and light backgrounds
- Doesn't obscure text or images underneath
- Multiple overlapping highlights remain visible
- Better accessibility for users with color blindness

**Supported CSS Properties (limited subset):**
- `background-color`
- `color`
- `text-decoration` and related properties
- `text-shadow`
- `-webkit-text-fill-color`
- `-webkit-text-stroke-color`
- `-webkit-text-stroke-width`

**NOT supported:**
- Layout properties (padding, margin, border)
- Font properties
- Transform properties

### Feature Detection

Always check for API availability:

```javascript
function isHighlightAPISupported() {
  return typeof CSS !== 'undefined' &&
         'highlights' in CSS;
}

if (isHighlightAPISupported()) {
  // Use CSS Custom Highlight API
  coordinator = new HighlightCoordinator();
} else {
  // Fallback: sentence-only with simpler method
  coordinator = new LegacyHighlighter();
}
```

### Fallback Strategy for Unsupported Browsers

For the ~7% without CSS Highlight API support:

**Option 1: No word highlighting** (simplest)
- Only highlight the entire sentence/paragraph being read
- Use a CSS class on the container element

**Option 2: Wrapper elements** (complex but works)
- Dynamically wrap words in `<span>` elements
- Apply classes for highlighting
- **Drawback:** DOM mutation affects accessibility, selection behavior

**Recommendation:** Use Option 1 for unsupported browsers. Word-level highlighting is a progressive enhancement, not a requirement.

---

## 4. SSML Capabilities

Speech Synthesis Markup Language (SSML) provides control over TTS output, but has limited built-in support for timing/synchronization.

### SSML Mark Element

The `<mark>` element is SSML's primary synchronization mechanism:

```xml
<speak>
  <mark name="start"/>
  Hello world
  <mark name="word1"/>
  This is a test
  <mark name="end"/>
</speak>
```

**Purpose:** Named anchor points that trigger events during synthesis.

**Web Speech API Support:**

```javascript
utterance.onmark = (event) => {
  console.log(`Mark reached: ${event.name} at ${event.elapsedTime}s`);
};
```

**Browser Support:** ❌ **Not widely supported** in Web Speech API
- Chrome: No
- Firefox: No
- Safari: No
- Edge: No

**Cloud TTS Support:** ✅ Excellent
- AWS Polly: Full support with speech marks
- Google Cloud TTS: Full support with timepoints
- Azure Speech: Full support with bookmark events

### Token/Word Elements

SSML provides `<token>` (alias `<w>`) to mark word boundaries:

```xml
<speak>
  <w>Hello</w> <w>world</w>
</speak>
```

**Limitation:** Does NOT automatically generate timing data. These elements clarify boundaries for the TTS engine but don't provide synchronization callbacks.

### SSML for Word Timing: Summary

| Feature | Browser TTS | AWS Polly | Google Cloud | Azure |
|---------|-------------|-----------|--------------|-------|
| **Auto word boundaries** | ✅ `onboundary` | ✅ Speech marks | ❌ | ✅ SDK events |
| **SSML marks** | ❌ Not supported | ✅ Speech marks | ✅ Timepoints | ✅ Bookmarks |
| **Manual word markup** | ❌ No timing | ❌ No timing | ❌ No timing | ❌ No timing |

**Key Insight:** SSML alone does NOT solve synchronization. You need:
1. **Browser TTS:** Use `onboundary` events (not SSML)
2. **Cloud TTS:** Use provider-specific timing APIs (speech marks, timepoints, events)

### SSML Benefits for TTS Quality

While SSML doesn't directly help with timing, it dramatically improves TTS quality:

```xml
<speak>
  Which method should you use to solve
  <prosody rate="slow">x squared, minus five x, plus six</prosody>
  equals zero?
</speak>
```

**Benefits:**
- Control speaking rate (`<prosody rate="slow">`)
- Add pauses (`<break time="500ms"/>`)
- Emphasize words (`<emphasis>important</emphasis>`)
- Proper pronunciation (`<phoneme>` or `<sub>`)
- Better math/technical term pronunciation

**Best Practice:** Use SSML for quality, use provider APIs for synchronization.

---

## 5. Common Pitfalls: Timer-Based Approaches

### Why Timer-Based Synchronization Fails

Many developers attempt to predict word timing using calculated delays:

```javascript
// ❌ ANTI-PATTERN - DO NOT USE
const words = text.split(' ');
const wordsPerMinute = 150;
const msPerWord = (60 * 1000) / wordsPerMinute;

words.forEach((word, index) => {
  setTimeout(() => {
    highlightWord(word, index);
  }, index * msPerWord);
});

speechSynthesis.speak(utterance);
```

### Why This Fails

#### 1. **Unpredictable Speaking Rate**

TTS engines do NOT speak at constant rates:
- Pauses at punctuation (periods, commas, colons)
- Variable word lengths (one syllable vs. five syllables)
- Emphasis and prosody changes
- Voice-specific characteristics
- System load affecting synthesis speed

**Result:** Highlighting drifts out of sync within seconds.

#### 2. **No Pause/Resume Synchronization**

When users pause/resume:
- Timer continues running
- Audio stops
- Highlighting gets completely desynchronized
- No way to recover without restarting

#### 3. **Rate Parameter Ignored**

```javascript
utterance.rate = 0.8; // Slow down speech
// Timers don't know about this!
```

Timer calculations don't account for the `rate` parameter users might set.

#### 4. **Browser/Voice Variability**

Different browsers and voices have different speaking rates:
- Chrome on Windows vs. Chrome on Mac
- Microsoft David vs. Google US English
- Neural voices vs. standard voices

A timer calibrated for one voice fails on another.

#### 5. **Network Latency (Cloud TTS)**

For cloud TTS:
- Synthesis happens on server
- Audio streams back with variable latency
- Timer starts immediately but audio is delayed

### Real-World Failure Example

```
Text: "The quick brown fox jumps over the lazy dog"

Expected Timeline (timer-based, 150 WPM = 400ms/word):
Word   | Time | Highlight
-------|------|----------
The    | 0ms  | [The] quick brown fox...
quick  | 400ms| The [quick] brown fox...
brown  | 800ms| The quick [brown] fox...
...

Actual Timeline (real TTS):
Word   | Time | Highlight Status
-------|------|------------------
The    | 0ms  | ✅ [The] (sync)
quick  | 250ms| ❌ (quick) [The] (timer shows "The")
brown  | 600ms| ❌ [brown] (quick) (timer shows "quick")
...    | ...  | ❌ COMPLETELY OUT OF SYNC

At 3 seconds:
Expected: Word 7-8
Actual: Word 5-6
Result: Highlighting wrong word entirely
```

**Drift accumulates exponentially.**

### Attempted "Fixes" That Still Fail

#### Calibration

"Just measure the actual time per word for this voice and adjust!"

**Still fails because:**
- Rate varies by sentence structure
- Punctuation affects timing
- Can't account for emphasis changes
- Requires per-voice calibration data
- Breaks on user-adjusted rate

#### Progress Polling

"Poll the current word from the API!"

**Web Speech API doesn't expose current position during playback.**

#### HTML5 Audio Timeupdate

Works ONLY with cloud TTS that provides separate audio file + timing data (like Polly speech marks). Does NOT work with Web Speech API.

### The Only Reliable Solution

**Event-driven synchronization using word boundary events or timing metadata.**

No timers. No predictions. Only actual events from the TTS engine.

---

## 6. Alternative Synchronization Strategies

### Strategy Matrix

| Strategy | Reliability | Complexity | Browser Support | Best For |
|----------|-------------|------------|-----------------|----------|
| **Web Speech boundary events** | ⭐⭐⭐ | Low | ~95% (with bugs) | Quick implementation |
| **Cloud TTS + Speech marks** | ⭐⭐⭐⭐⭐ | Medium | 100% | Production apps |
| **Cloud TTS + Audio timeupdate** | ⭐⭐⭐⭐⭐ | Medium | 100% | Production apps |
| **Phoneme-based** | ⭐⭐⭐⭐ | High | Varies | Lip-sync, advanced |
| **Timer-based** | ⭐ | Low | 100% | ❌ Never use |

### Event-Driven: Browser TTS (Recommended Baseline)

**Pros:**
- Zero latency (local synthesis)
- Works offline
- No API costs
- Simple implementation

**Cons:**
- Browser bugs (Safari word boundaries broken, Chrome unreliable)
- Limited voice quality
- No SSML support in most browsers

**Implementation:**

```javascript
const utterance = new SpeechSynthesisUtterance(text);
let boundaryBroken = false;

utterance.onboundary = (event) => {
  if (boundaryBroken || event.name !== 'word') return;

  // Detect broken boundaries (Safari)
  if (previousIndex === event.charIndex && boundaryCount > 2) {
    console.warn('Word boundaries broken, falling back to sentence-only');
    boundaryBroken = true;
    return;
  }

  highlightWord(event.charIndex, event.charLength);
};

speechSynthesis.speak(utterance);
```

### Event-Driven: Cloud TTS with Speech Marks (Recommended Production)

**Best for:** Production applications requiring reliable synchronization.

**Pros:**
- Millisecond-precise timing
- Works across all browsers
- Full SSML support
- High-quality neural voices

**Cons:**
- Network latency (~200-500ms)
- Requires API credentials
- Cost (AWS Polly: ~$16 per 1M characters)

**Implementation:**

See section 2.2 for detailed AWS Polly implementation.

### Phoneme/Viseme-Based Synchronization

**Use Case:** Advanced applications requiring lip-sync, pronunciation visualization, or language learning.

**Approach:** Use viseme/phoneme timing from cloud TTS.

**Example: Azure Speech Service**

```javascript
synthesizer.VisemeReceived += (s, e) => {
  const timeMs = e.AudioOffset / 10000;
  const visemeId = e.VisemeId; // 0-21

  // Update avatar mouth position
  updateLipSync(visemeId);

  // Can also highlight at phoneme-level (very granular)
};
```

**Pros:**
- Extremely precise (60+ events per second)
- Enables lip-sync animations
- Shows sub-word pronunciation

**Cons:**
- High complexity
- Requires cloud TTS with viseme support
- Overkill for simple text highlighting

**Recommendation:** Only use for specialized applications (avatars, pronunciation tutors).

### Hybrid Approach: Cloud with Browser Fallback

**Best Practice Pattern:**

```javascript
class TTSService {
  async initialize() {
    try {
      // Try cloud TTS first
      await this.initializeCloudTTS();
      this.provider = 'cloud';
    } catch (error) {
      console.warn('Cloud TTS unavailable, using browser TTS');
      await this.initializeBrowserTTS();
      this.provider = 'browser';
    }
  }

  async speak(text) {
    if (this.provider === 'cloud') {
      return this.speakWithCloudTTS(text);
    } else {
      return this.speakWithBrowserTTS(text);
    }
  }
}
```

**Benefits:**
- Production quality when online
- Fallback when offline or cloud unavailable
- Single API for application code

---

## 7. Implementation Recommendations

### Architecture: Service + Coordinator Pattern

**Recommended structure:**

```
┌─────────────────────────────────────────┐
│ TTSService                              │
│ - Manages playback state                │
│ - Coordinates providers                 │
│ - Handles word boundary events          │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────┐    ┌──────────────┐
│Provider  │    │Highlight     │
│(Browser, │    │Coordinator   │
│ Polly)   │    │(CSS API)     │
└──────────┘    └──────────────┘
```

### Sample Architecture

```typescript
// Provider interface
interface ITTSProvider {
  speak(text: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  onWordBoundary?: (word: string, position: number) => void;
}

// Highlight interface
interface IHighlightCoordinator {
  highlightTTSWord(textNode: Text, start: number, end: number): void;
  highlightTTSSentence(ranges: Range[]): void;
  clearTTS(): void;
  isSupported(): boolean;
}

// Main service
class TTSService {
  private provider: ITTSProvider;
  private highlightCoordinator: IHighlightCoordinator;
  private textNodeMapper: TextNodeMapper;

  async speak(text: string, contentElement: Element) {
    // Build text node map
    this.textNodeMapper = new TextNodeMapper(contentElement);

    // Apply sentence-level highlight
    const range = document.createRange();
    range.selectNodeContents(contentElement);
    this.highlightCoordinator.highlightTTSSentence([range]);

    // Setup word boundary handler
    this.provider.onWordBoundary = (word, charIndex) => {
      const location = this.textNodeMapper.findNodeAtPosition(
        charIndex,
        word.length
      );

      if (location) {
        this.highlightCoordinator.highlightTTSWord(
          location.node,
          location.start,
          location.end
        );
      }
    };

    // Speak
    await this.provider.speak(text);

    // Clear highlights
    this.highlightCoordinator.clearTTS();
  }
}
```

### Key Design Principles

1. **Separation of Concerns**
   - TTS providers handle audio
   - Highlight coordinator handles visuals
   - Text node mapper handles DOM mapping
   - Service orchestrates all three

2. **Interface-Based Design**
   - Providers implement common interface
   - Easy to swap implementations
   - Testable with mocks

3. **Feature Detection**
   - Check CSS Highlight API support
   - Detect broken word boundaries
   - Graceful degradation

4. **Two-Layer Highlighting**
   - Sentence layer (context)
   - Word layer (progress)
   - Clear separation prevents conflicts

### State Management

```typescript
enum PlaybackState {
  IDLE = 'idle',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  ERROR = 'error'
}

class TTSService {
  private state: PlaybackState = PlaybackState.IDLE;
  private listeners = new Set<(state: PlaybackState) => void>();

  private setState(newState: PlaybackState) {
    if (this.state === newState) return;
    this.state = newState;
    this.listeners.forEach(listener => listener(newState));
  }

  onStateChange(listener: (state: PlaybackState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

### Error Handling

```typescript
async speak(text: string) {
  try {
    this.setState(PlaybackState.LOADING);
    await this.provider.speak(text);
    this.setState(PlaybackState.IDLE);
  } catch (error) {
    console.error('TTS error:', error);
    this.setState(PlaybackState.ERROR);
    this.highlightCoordinator.clearTTS();
    throw error;
  }
}
```

---

## 8. Code Examples

### Complete Browser TTS Implementation

```javascript
class BrowserTTSHighlighter {
  constructor(textElement) {
    this.textElement = textElement;
    this.textNodeMapper = new TextNodeMapper(textElement);
    this.highlightCoordinator = new HighlightCoordinator();
    this.utterance = null;
    this.boundaryBroken = false;
  }

  async speak(text) {
    // Check API support
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported');
    }

    if (!this.highlightCoordinator.isSupported()) {
      console.warn('CSS Highlight API not supported, using fallback');
      return this.speakWithoutHighlight(text);
    }

    // Stop any ongoing speech
    this.stop();

    // Create utterance
    this.utterance = new SpeechSynthesisUtterance(text);

    // Apply sentence-level highlight
    const sentenceRange = document.createRange();
    sentenceRange.selectNodeContents(this.textElement);
    this.highlightCoordinator.highlightSentence(sentenceRange);

    // Setup word boundary handler
    let lastIndex = -1;
    let count = 0;

    this.utterance.onboundary = (event) => {
      if (this.boundaryBroken || event.name !== 'word') return;

      count++;

      // Detect Safari bug
      if (event.charIndex === lastIndex && count > 2) {
        console.warn('Word boundaries broken, disabling word highlighting');
        this.boundaryBroken = true;
        // Keep sentence highlight only
        return;
      }

      lastIndex = event.charIndex;

      // Find text node location
      const location = this.textNodeMapper.findNodeAtPosition(
        event.charIndex,
        event.charLength || 0
      );

      if (location) {
        this.highlightCoordinator.highlightWord(
          location.node,
          location.start,
          location.end
        );
      }
    };

    // Setup completion handler
    return new Promise((resolve, reject) => {
      this.utterance.onend = () => {
        this.highlightCoordinator.clearAll();
        resolve();
      };

      this.utterance.onerror = (event) => {
        this.highlightCoordinator.clearAll();

        // Ignore interrupted/canceled (expected)
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(`Speech synthesis error: ${event.error}`));
        }
      };

      // Start speaking
      speechSynthesis.speak(this.utterance);
    });
  }

  pause() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
    }
  }

  resume() {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    }
  }

  stop() {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      this.highlightCoordinator.clearAll();
    }
  }

  speakWithoutHighlight(text) {
    // Fallback for unsupported browsers
    this.utterance = new SpeechSynthesisUtterance(text);
    return new Promise((resolve, reject) => {
      this.utterance.onend = resolve;
      this.utterance.onerror = (e) => reject(new Error(e.error));
      speechSynthesis.speak(this.utterance);
    });
  }
}

// Usage
const highlighter = new BrowserTTSHighlighter(
  document.querySelector('.content')
);

document.querySelector('.play-button').addEventListener('click', async () => {
  try {
    await highlighter.speak('Hello world, this is a test.');
  } catch (error) {
    console.error('Speech failed:', error);
  }
});
```

### AWS Polly with Speech Marks

```javascript
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

class PollyTTSHighlighter {
  constructor(textElement, credentials) {
    this.textElement = textElement;
    this.textNodeMapper = new TextNodeMapper(textElement);
    this.highlightCoordinator = new HighlightCoordinator();

    this.polly = new PollyClient({
      region: 'us-east-1',
      credentials
    });

    this.audio = null;
    this.speechMarks = [];
  }

  async speak(text) {
    // Fetch audio and speech marks in parallel
    const [audioBlob, marks] = await Promise.all([
      this.synthesizeAudio(text),
      this.fetchSpeechMarks(text)
    ]);

    this.speechMarks = marks;

    // Create audio element
    this.audio = new Audio(URL.createObjectURL(audioBlob));

    // Apply sentence-level highlight
    const sentenceRange = document.createRange();
    sentenceRange.selectNodeContents(this.textElement);
    this.highlightCoordinator.highlightSentence(sentenceRange);

    // Setup time update handler
    this.audio.ontimeupdate = () => {
      this.updateHighlight();
    };

    // Setup completion
    return new Promise((resolve, reject) => {
      this.audio.onended = () => {
        this.highlightCoordinator.clearAll();
        resolve();
      };

      this.audio.onerror = () => {
        this.highlightCoordinator.clearAll();
        reject(new Error('Audio playback failed'));
      };

      this.audio.play();
    });
  }

  async synthesizeAudio(text) {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: 'Joanna',
      Engine: 'neural'
    });

    const response = await this.polly.send(command);
    const arrayBuffer = await response.AudioStream.transformToByteArray();
    return new Blob([arrayBuffer], { type: 'audio/mpeg' });
  }

  async fetchSpeechMarks(text) {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'json',
      VoiceId: 'Joanna',
      Engine: 'neural',
      SpeechMarkTypes: ['word']
    });

    const response = await this.polly.send(command);
    const bytes = await response.AudioStream.transformToByteArray();
    const jsonText = new TextDecoder().decode(bytes);

    // Parse newline-delimited JSON
    return jsonText
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  updateHighlight() {
    const currentTimeMs = this.audio.currentTime * 1000;

    // Find current word mark
    let currentMark = null;
    for (let i = 0; i < this.speechMarks.length; i++) {
      const mark = this.speechMarks[i];
      const nextMark = this.speechMarks[i + 1];

      if (mark.time <= currentTimeMs &&
          (!nextMark || currentTimeMs < nextMark.time)) {
        currentMark = mark;
        break;
      }
    }

    if (currentMark) {
      const location = this.textNodeMapper.findNodeAtPosition(
        currentMark.start,
        currentMark.end - currentMark.start
      );

      if (location) {
        this.highlightCoordinator.highlightWord(
          location.node,
          location.start,
          location.end
        );
      }
    }
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  resume() {
    if (this.audio) {
      this.audio.play();
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.highlightCoordinator.clearAll();
    }
  }
}
```

### Text Node Mapper (Reusable Utility)

#### Critical: Whitespace Normalization

The text node mapper MUST handle whitespace normalization correctly. Text extracted from DOM often contains formatting whitespace (line breaks, indentation) that gets normalized when spoken.

```javascript
class TextNodeMapper {
  constructor(rootElement, spokenText) {
    this.normalizedToDOM = new Map(); // normalized position → {node, offset}
    this.buildMap(rootElement, spokenText);
  }

  buildMap(element, spokenText) {
    // Get DOM text and normalize it
    const range = document.createRange();
    range.selectNodeContents(element);
    const domText = range.toString();
    const normalizedDomText = domText.trim().replace(/\s+/g, ' ');

    // Verify texts match
    if (spokenText !== normalizedDomText) {
      console.error('Text mismatch!', {
        spoken: spokenText.substring(0, 100),
        normalized: normalizedDomText.substring(0, 100)
      });
    }

    // Build character-by-character map from normalized position to DOM position
    let normalizedPos = 0;
    let inLeadingWhitespace = true;
    let lastCharWasWhitespace = false;

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const isWhitespace = /\s/.test(char);

          if (inLeadingWhitespace) {
            if (!isWhitespace) {
              inLeadingWhitespace = false;
              this.normalizedToDOM.set(normalizedPos, { node, offset: i });
              normalizedPos++;
              lastCharWasWhitespace = false;
            }
          } else {
            if (isWhitespace) {
              // Collapse multiple whitespace - only map first in sequence
              if (!lastCharWasWhitespace) {
                this.normalizedToDOM.set(normalizedPos, { node, offset: i });
                normalizedPos++;
              }
              lastCharWasWhitespace = true;
            } else {
              this.normalizedToDOM.set(normalizedPos, { node, offset: i });
              normalizedPos++;
              lastCharWasWhitespace = false;
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
          for (const child of Array.from(node.childNodes)) {
            walk(child);
          }
        }
      }
    };

    walk(element);
  }

  findNodeAtPosition(charIndex, length) {
    const startPos = this.normalizedToDOM.get(charIndex);
    if (!startPos) return null;

    const endPos = this.normalizedToDOM.get(charIndex + length - 1);
    if (!endPos) return null;

    // Handle word spanning multiple nodes (rare)
    if (startPos.node !== endPos.node) {
      return {
        node: startPos.node,
        start: startPos.offset,
        end: startPos.node.textContent.length
      };
    }

    return {
      node: startPos.node,
      start: startPos.offset,
      end: endPos.offset + 1
    };
  }
}
```

**Why This Approach Works:**

1. **Extracts text once** from DOM with `range.toString()`
2. **Normalizes identically** to spoken text: `trim().replace(/\s+/g, ' ')`
3. **Maps each character** in normalized text to exact DOM position
4. **Handles whitespace collapsing** during mapping (multiple spaces → one space)
5. **Result:** Speech mark positions align perfectly with map lookups

### CSS Custom Highlight Coordinator

```javascript
class HighlightCoordinator {
  constructor() {
    // Check support
    this.supported = typeof CSS !== 'undefined' && 'highlights' in CSS;

    if (!this.supported) {
      console.warn('CSS Custom Highlight API not supported');
      return;
    }

    // Create highlight objects
    this.ttsWordHighlight = new Highlight();
    this.ttsSentenceHighlight = new Highlight();

    // Register with CSS
    CSS.highlights.set('tts-word', this.ttsWordHighlight);
    CSS.highlights.set('tts-sentence', this.ttsSentenceHighlight);

    // Register styles
    this.registerStyles();
  }

  registerStyles() {
    // Check if styles already exist
    if (document.getElementById('tts-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'tts-highlight-styles';
    style.textContent = `
      ::highlight(tts-sentence) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      ::highlight(tts-word) {
        background-color: rgba(255, 235, 59, 0.4);
        color: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  highlightWord(textNode, startOffset, endOffset) {
    if (!this.supported) return;

    // Clear previous word highlight
    this.ttsWordHighlight.clear();

    // Create range
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);

    // Add to highlight
    this.ttsWordHighlight.add(range);
  }

  highlightSentence(range) {
    if (!this.supported) return;

    // Clear previous sentence highlight
    this.ttsSentenceHighlight.clear();

    // Add to highlight
    this.ttsSentenceHighlight.add(range);
  }

  clearAll() {
    if (!this.supported) return;

    this.ttsWordHighlight.clear();
    this.ttsSentenceHighlight.clear();
  }

  isSupported() {
    return this.supported;
  }

  destroy() {
    if (!this.supported) return;

    this.clearAll();

    // Remove styles
    const styleEl = document.getElementById('tts-highlight-styles');
    if (styleEl) {
      styleEl.remove();
    }
  }
}
```

---

## Summary: Technical Recommendations

### For Quick Implementation (MVP)

1. **Use Web Speech API** with boundary events
2. **Implement CSS Custom Highlight API** with feature detection
3. **Build text node mapper** for position-to-DOM mapping
4. **Detect and work around** Safari boundary bug
5. **Fall back to sentence-only** highlighting on unsupported browsers

**Implementation time:** 1-2 days
**Browser coverage:** ~90% with word highlighting, 100% with sentence fallback
**Cost:** $0

### For Production Applications

1. **Use AWS Polly** (or equivalent) with speech marks
2. **Implement hybrid approach** with browser TTS fallback
3. **Use CSS Custom Highlight API** for visuals
4. **Synchronize via audio timeupdate** with speech mark timing
5. **Cache synthesized audio** to reduce API calls

**Implementation time:** 3-5 days
**Browser coverage:** 100% with word highlighting
**Cost:** ~$16 per 1M characters (~$0.016 per 1000 words)

### For Advanced Applications

1. **Use Azure Speech Service** for viseme/phoneme data
2. **Implement lip-sync** or pronunciation visualization
3. **Multi-modal feedback** (audio + visual + haptic)

**Implementation time:** 1-2 weeks
**Browser coverage:** 100%
**Cost:** Variable (Azure pricing)

---

## References

### Browser APIs

- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SpeechSynthesisUtterance boundary event - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event)
- [CSS Custom Highlight API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [CSS Custom Highlight API Spec - WICG](https://drafts.csswg.org/css-highlight-api-1/)

### Cloud TTS Services

- [AWS Polly Speech Marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech/docs)
- [Azure Speech Service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)
- [Azure Viseme Events](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

### SSML

- [W3C Speech Synthesis Markup Language 1.1](https://www.w3.org/TR/speech-synthesis11/)
- [AWS Polly SSML Reference](https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html)
- [Google Cloud TTS SSML](https://cloud.google.com/text-to-speech/docs/ssml)

### Standards

- [QTI 3.0 Accessibility Catalogs](https://www.imsglobal.org/spec/qti/v3p0)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)

### Browser Compatibility

- [Can I Use: CSS Highlight API](https://caniuse.com/mdn-api_highlight)
- [Can I Use: Speech Synthesis](https://caniuse.com/speech-synthesis)
- [Can I Use: SpeechSynthesis boundary event](https://caniuse.com/mdn-api_speechsynthesisutterance_boundary_event)

---

## Appendix: Current Implementation

The PIE Players TTS system (as of February 2026) implements the recommended architecture:

### Architecture

```
packages/assessment-toolkit/
├── src/services/
│   ├── TTSService.ts              # Main orchestration service
│   ├── HighlightCoordinator.ts    # CSS Custom Highlight API
│   ├── AccessibilityCatalogResolver.ts
│   └── tts/
│       ├── browser-provider.ts    # Web Speech API implementation
│       └── provider-interface.ts  # ITTSProvider interface
```

### Key Features

1. **Event-driven synchronization** via `onboundary` events
2. **CSS Custom Highlight API** for DOM-free highlighting
3. **Two-layer highlighting** (sentence + word)
4. **Safari boundary bug detection** with automatic fallback
5. **Text node mapping** for position-to-DOM translation
6. **Provider-based architecture** supporting multiple TTS engines
7. **QTI 3.0 accessibility catalog** integration with SSML support

### Usage Example

```typescript
import {
  TTSService,
  BrowserTTSProvider,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const highlightCoordinator = new HighlightCoordinator();

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setHighlightCoordinator(highlightCoordinator);

// Speak with highlighting
await ttsService.speak(text, {
  contentElement: document.querySelector('.content')
});
```

See [TTS Architecture Documentation](tts-architecture.md) for complete details.

---

**Document Version:** 1.0
**Last Updated:** February 6, 2026
**Author:** PIE Players Team
