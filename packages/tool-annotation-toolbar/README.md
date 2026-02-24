# Annotation Toolbar

A text selection toolbar for highlighting and annotating text in the PIEoneer assessment player. Uses modern CSS Custom Highlight API for zero DOM mutation and optimal performance.

## Features

- **4-Color Highlighting**: Yellow, pink, blue, and green highlight swatches
- **Underline Annotation**: Underline selected text
- **Persistent Annotations**: Saved to sessionStorage and restored on page load
- **Clear Annotations**: Remove annotations from selected text or clear all
- **Translation**: Translate selected text
- **Text-to-Speech (Read Aloud)**: Read selected text aloud with word-level highlighting
- **Modern CSS Custom Highlight API**:
  - Zero DOM mutation (no `<span>` wrappers)
  - 10-50x faster than traditional approaches
  - 5-10x less memory usage
  - Framework-compatible (works with React, Vue, Svelte)
- **Accessibility**:
  - Full ARIA labels and screen reader support
  - Keyboard navigation (Escape to close)
  - Focus-visible outlines
  - WCAG 2.2 compliant
- **Dark Mode**: Automatic adaptation to system color scheme
- **High Contrast Mode**: Enhanced visibility in high contrast settings
- **Responsive Design**: Optimized for mobile and desktop viewports

## Usage

```svelte
<script>
  import ToolAnnotationToolbar from '$lib/tags/tool-annotation-toolbar/tool-annotation-toolbar.svelte';
</script>

<!-- Toolbar appears automatically when text is selected -->
<ToolAnnotationToolbar />
```

## Props

This component doesn't take props - it automatically shows when text is selected and hides when selection is cleared or Escape is pressed.

## Events

- `translationrequest`: Dispatched when translation button is clicked
  - `detail: { text: string }` - The selected text

**Note**: Text-to-Speech (Read Aloud) button does not emit an event - it directly uses the TTS service to read the selected text.

## Architecture

The annotation toolbar integrates with PIE's shared highlight infrastructure:

- **HighlightCoordinator**: Singleton managing both TTS and annotation highlights
- **RangeSerializer**: Serializes/deserializes DOM ranges for persistence
- **CSS Custom Highlight API**: Modern browser API for non-invasive highlighting

### Browser Support

Requires CSS Custom Highlight API support:
- Chrome/Edge 105+
- Safari 17.2+
- Firefox 128+

For unsupported browsers, the component gracefully degrades (no highlights shown).

## Annotation Persistence

Annotations are automatically saved to `sessionStorage` and restored on page load. The storage key includes the current URL path to scope annotations to specific content.

Storage format:
```typescript
{
  "annotation-highlight-yellow-1234567890": {
    startContainer: ["body", "div", "p", "#text"],
    startOffset: 10,
    endContainer: ["body", "div", "p", "#text"],
    endOffset: 20,
    text: "highlighted text"
  }
}
```

Annotations are automatically cleared when:
- User explicitly clicks "Clear" button
- User navigates to different content
- sessionStorage is cleared

## Text-to-Speech Integration

The annotation toolbar includes a "Read" button that uses the TTS service to read selected text aloud with word-level highlighting.

### How It Works

1. **User selects text** in the assessment content
2. **Annotation toolbar appears** with highlight, translate, and read buttons
3. **User clicks "Read"** button (speaker icon)
4. **TTS service speaks the selected text** using Web Speech API
5. **Words are highlighted** in sync with speech using CSS Custom Highlight API

### Technical Implementation

The toolbar uses `ttsService.speakRange()` instead of `ttsService.speak()` to ensure accurate word highlighting:

```typescript
// speakRange() calculates text offset for accurate highlighting
await ttsService.speakRange(selectedRange, {
  rate: 1.0,
  highlightWords: true
}, {
  onEnd: () => ttsSpeaking = false,
  onError: (err) => ttsSpeaking = false
});
```

**Why this matters:**
- User selects text in the middle of a paragraph
- `speak(text)` would highlight from the beginning of the container (wrong)
- `speakRange(range)` highlights the exact selected text (correct)

### UX Details

- **Read button is disabled** while TTS is speaking
- **Active state** shown with visual feedback
- **TTS stops automatically** when toolbar is hidden (user clicks away)
- **No conflicts** with annotation highlights (different highlight layers)

### Browser Support

- **TTS (Web Speech API)**: 97%+ browser support
- **Word Highlighting**: 85-90% browser support (CSS Custom Highlight API)
- **Graceful degradation**: TTS works without highlighting in older browsers

## Based On

This implementation is inspired by production annotation toolbar patterns but uses modern 2025 web standards:

- CSS Custom Highlight API instead of DOM mutation
- Svelte 5 patterns and best practices
- Modern accessibility (WCAG 2.2)
- Dark mode and high contrast support
- Responsive design for mobile devices
