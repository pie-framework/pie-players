# TTS Word Highlighting - Trim Offset Fix

## Date
2026-02-06

## Summary
Fixed a critical bug in TTS word highlighting where speech marks from AWS Polly were not aligning with DOM text nodes due to whitespace trimming.

## Root Cause Analysis

### The Problem
Word highlighting was failing or highlighting incorrect words because of a **character position mismatch** between:
1. **Text sent to TTS** (trimmed by calling code)
2. **DOM content** (untrimmed, as it appears in the browser)
3. **Speech marks** (reference trimmed text positions)
4. **Text node map** (built from untrimmed DOM)

### Detailed Explanation

When text is extracted from the DOM and sent to TTS, it's typically trimmed:

```typescript
// In tool-tts-inline.svelte:124
const range = document.createRange();
range.selectNodeContents(targetContainer);
const text = range.toString().trim();  // ⚠️ Trimming here!

await ttsService.speak(text, {
    contentElement: targetContainer  // But this has untrimmed content
});
```

**Example Scenario:**

DOM content:
```
"  The quick brown fox  "  (23 characters)
```

Text sent to Polly (trimmed):
```
"The quick brown fox"  (19 characters)
```

AWS Polly returns speech marks for the **trimmed text**:
```json
[
  { "time": 0, "start": 0, "end": 3, "value": "The" },
  { "time": 200, "start": 4, "end": 9, "value": "quick" },
  { "time": 400, "start": 10, "end": 15, "value": "brown" }
]
```

But the text node map is built from the **untrimmed DOM**:
```
Node: "  The quick brown fox  ", start: 0, end: 23
```

When speech mark says "highlight word at position 4", we look for position 4 in the **untrimmed** text, which is actually inside the leading whitespace, not at the start of "quick"!

**The result:** Words are highlighted at wrong positions or not highlighted at all.

## The Solution

### Implementation

Added a `trimOffset` property to `TTSService` that tracks how many characters were trimmed from the start of the text.

**Changes made to `packages/assessment-toolkit/src/services/TTSService.ts`:**

1. **Added trim offset tracking** (line 63):
```typescript
private trimOffset = 0; // Characters trimmed from start of text
```

2. **Calculate trim offset** when building text node map (lines 240-260):
```typescript
// Calculate trim offset by comparing DOM text with spoken text
const range = document.createRange();
range.selectNodeContents(this.currentContentElement);
const domText = range.toString();
const trimmedDomText = domText.trim();

// Find how many characters were trimmed from the start
this.trimOffset = domText.indexOf(trimmedDomText);
if (this.trimOffset === -1) this.trimOffset = 0;

console.log('[TTSService] Text alignment:', {
    domLength: domText.length,
    trimmedLength: trimmedDomText.length,
    spokenLength: contentToSpeak.length,
    trimOffset: this.trimOffset
});
```

3. **Apply trim offset** when receiving speech marks (line 271):
```typescript
// Adjust character index for trim offset
// Speech marks reference trimmed text, but DOM has untrimmed text
const adjustedCharIndex = charIndex + this.trimOffset;

const location = this.findTextNodeAtPosition(adjustedCharIndex, wordLength);
```

4. **Reset trim offset** on cleanup (lines 306, 319, 368):
```typescript
this.trimOffset = 0;
```

### How It Works

1. When `speak()` is called with a `contentElement`, we extract the full DOM text
2. We compare it to its trimmed version to find how many leading characters were removed
3. When speech marks arrive with character positions (referencing the trimmed text), we add the trim offset to get the correct position in the DOM
4. This adjusted position is then used to find the correct text node and offsets for highlighting

**Example with fix:**

Speech mark position: 4 (for "quick" in trimmed text)
Trim offset: 2 (two leading spaces)
Adjusted position: 4 + 2 = 6
Lookup in DOM: position 6 → correctly finds "quick"

## Testing

### Manual Testing

1. Created test file: `test-tts-highlighting.html`
2. Test with content that has leading/trailing whitespace
3. Verify that word highlighting occurs at correct positions
4. Check console logs for alignment data

### Expected Console Output

```
[TTSService] Text alignment: {
    domLength: 23,
    trimmedLength: 19,
    spokenLength: 19,
    trimOffset: 2
}
[TTSService] Word boundary event: "" at position 4 (adjusted: 6), length 5
[TTSService] Found location: { node: Text, start: 6, end: 11 }
```

## Files Modified

1. `packages/assessment-toolkit/src/services/TTSService.ts`
   - Added `trimOffset` property
   - Added trim offset calculation in `speak()` method
   - Added offset adjustment in `onWordBoundary` callback
   - Added offset reset in cleanup code

## Related Issues

This fix addresses the root cause for **plain text only**. For SSML support, additional work is needed (see "Future Work" below).

## Future Work

### SSML Support

When SSML is used, there's an additional layer of complexity:

1. **SSML tags add characters** that don't appear in spoken content
2. Speech marks reference SSML character positions (including tags)
3. DOM has plain text (no tags)

**Example:**
```
SSML: "<speak>Hello <break time='500ms'/> world</speak>"
      Position 0                30              40
Plain: "Hello world"
       Position 0    10
```

**Solution approach:**
1. Create an SSML-to-plain-text character position map
2. Translate speech mark positions through this map before applying trim offset
3. See detailed analysis in earlier conversation for implementation strategy

### Other Improvements

1. **HTML entity normalization:** `&nbsp;`, `&amp;`, etc. should be normalized
2. **DOM mutation detection:** Detect if content changes during playback
3. **Whitespace normalization:** Handle collapsed vs preserved whitespace
4. **Multi-element highlighting:** Handle words that span multiple text nodes

## Validation

### Build Status
✅ TypeScript compilation successful
✅ No type errors introduced
✅ Backwards compatible (no API changes)

### Testing Checklist
- [ ] Test with plain text (no SSML)
- [ ] Test with leading whitespace
- [ ] Test with trailing whitespace
- [ ] Test with multiple text nodes
- [ ] Test with different playback rates
- [ ] Test with ServerTTSProvider (AWS Polly)
- [ ] Test with BrowserTTSProvider fallback

## Related Documentation

- [TTS-WORD-HIGHLIGHTING-FIXES.md](./TTS-WORD-HIGHLIGHTING-FIXES.md) - Previous fixes
- [tts-architecture.md](./tts-architecture.md) - TTS system architecture
- [tts-synchronization-best-practices.md](./tts-synchronization-best-practices.md) - Best practices
- [SECTION-TTS-INTEGRATION-COMPLETE.md](./SECTION-TTS-INTEGRATION-COMPLETE.md) - Integration guide

## Acknowledgments

This fix was identified through systematic analysis comparing the working reference implementation (pie-api-aws) with the current implementation, revealing the trimming mismatch as the root cause.
