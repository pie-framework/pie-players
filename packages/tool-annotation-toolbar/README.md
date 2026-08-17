# Annotation Toolbar

A text selection toolbar for highlighting and annotating text in the PIEoneer assessment player. Uses modern CSS Custom Highlight API for zero DOM mutation and optimal performance.

## Features

- **4-Color Highlighting**: Yellow, pink, blue, and green highlight swatches
- **Underline Annotation**: Underline selected text
- **Persistent Annotations**: Saved to sessionStorage and restored on page load
- **Clear Annotations**: Remove annotations from selected text or clear all
- **Text-to-Speech (Read Aloud)**: Read selected text aloud with word-level highlighting
- **Selection Actions**: Host-supplied actions on the current selection; see below
- **Viewport-Aware Placement**: Sits above the selection where it fits, flips below when it does not, and clamps so no control leaves the viewport. `data-pie-placement` on the strip reads `above` or `below`.
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
  // Imports and registers <pie-tool-annotation-toolbar>.
  import '@pie-players/pie-tool-annotation-toolbar';
</script>

<!-- Toolbar appears automatically when text is selected -->
<pie-tool-annotation-toolbar />
```

## Props

The strip shows itself when text is selected and hides when the selection is cleared or Escape is pressed. What it needs from its host is the services it annotates and reads with, and the actions it should offer on a selection.

| Name                  | Attribute | Type                    | Notes                                                                     |
| --------------------- | --------- | ----------------------- | ------------------------------------------------------------------------- |
| `enabled`             | `enabled` | boolean                 | Defaults to `true`; `false` stops it reacting to selections.              |
| `highlightCoordinator`| —         | object                  | Where annotations are recorded. Without one the highlight controls no-op. |
| `ttsService`          | —         | object                  | Read-aloud is offered only when present.                                  |
| `selectionActions`    | —         | `ToolSelectionAction[]` | Host-supplied actions on the current selection. See below.               |

Under `<pie-assessment-toolkit>` all four are supplied by the capability's registration, so a host mounting the strip through the toolkit passes nothing.

### Selection actions

An action is `{ id, label, iconSvg?, tooltip?, isAvailable?, run }`. The strip renders each as an ordinary button, so the roving tabindex and arrow-key model cover them with no special case, and hands `run` the selected text and its range. `isAvailable` is asked per selection: an action whose target is not currently available is absent rather than present and inert.

This strip does not know what an action does. Pairing an action to a capability belongs to whoever composes them — `@pie-players/pie-default-tool-loaders` does it for the packaged dictionaries, using the coordinator's `requestTool`. That split is what keeps a highlighter from naming a dictionary, and what lets a host offer an action for a capability PIE does not ship.

Activating an action dismisses the strip and latches it down for that selection: the selection survives on purpose, and opening a panel moves focus, which fires `selectionchange` — the strip would otherwise reappear over the panel the action just opened. Escape, focus leaving and an outside click do not latch, and Shift+F10 clears one.

An action is a shortcut and never a capability's only route. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on, an OS toggle absent on mobile, so a sighted keyboard-only learner cannot originate a selection at all — a capability reachable only from this strip is unreachable for them.

## Events

Text-to-Speech (Read Aloud) button does not emit an event - it directly uses the TTS service to read the selected text.

## Theming

The toolbar takes its surface and text from the canonical `--pie-background` and `--pie-text` tokens. The marks it draws, and its own outline, read dedicated tokens instead:

| Token                                  | Default                        | Purpose                                            |
| -------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `--pie-tool-annotation-toolbar-border` | `light-dark(#5c5c5c, #949494)` | Outline separating the toolbar from content        |
| `--pie-annotation-underline`           | `#4221d5`                      | Underline mark on a light page                     |
| `--pie-annotation-underline-dark`      | `#9c89ec`                      | Underline mark on a dark page                      |

The underline tokens are applied by `HighlightCoordinator` in `@pie-players/pie-assessment-toolkit`, which owns the `::highlight()` rules. They exist as a pair because one value cannot serve both surfaces — `#4221d5` is 2.41:1 on black and `#9c89ec` is 2.85:1 on white — and as two separate tokens so overriding one never silently moves the other. Neither consults `--pie-primary`: a theme accent is chosen against one background and is illegible on the other.

Which of the pair applies is decided by `[data-theme]`, which reports what the **page** declares — not which color scheme is active. A host that declares itself light while running a dark scheme would otherwise pin the light value over a dark background, so the accessibility palettes hand both states their own accent (below).

The outline does **not** read `--pie-border`. Under the DaisyUI bridge that token resolves to `--color-base-300`, a surface tint rather than a boundary colour, which renders the outline at 1.16:1 on the light base and 1.12:1 on the dark one — well short of the 3:1 that WCAG 2.2 SC 1.4.11 requires of a component boundary.

The defaults above are measured instead. A boundary on a light surface has to be dark and one on a dark surface has to be light, so the arms are the dark grey first and the light grey second. Both are measured against the surfaces the toolbar is actually drawn on rather than against pure white and pure black — real theme bases are off-white and off-black, and a grey chosen at the edge of passing against an extreme drops under threshold on everything else. Across DaisyUI's 21 light and 14 dark themes plus the PIE light and dark palettes, every light surface needs a grey no lighter than `#828282` and every dark surface one no darker than `#878787`; the ranges are disjoint, so one value cannot serve both. `#5c5c5c` holds 5.22:1 as its worst case on the light surfaces and `#949494` holds 3.56:1 on the dark ones. `light-dark()` follows the declared `color-scheme`, so every dark DaisyUI theme picks the dark value rather than only the theme literally named `dark`.

Palettes that choose their own colours deliberately set all three tokens in `@pie-players/pie-theme`: the ten `data-color-scheme` accessibility schemes point the outline at their own `--pie-border` and both underline states at their own `--pie-primary`, and the PIE dark theme pins the outline to `#949494`. Several of those palettes use mid-tone backgrounds that no single grey clears 3:1 on, which is why they override rather than inherit.

Those per-scheme values arrive by either delivery route: `<pie-theme scheme="…">` applies them as inline styles with no CSS import needed, and importing `@pie-players/pie-theme/color-schemes.css` plus setting `data-color-scheme` yourself produces the same result. Prefer the element — a host that hand-maintains its own copy of the scheme blocks stops receiving tokens added later.

Hosts may override any of the three, but must keep 3:1 against both the toolbar surface and the content behind it.

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
2. **Annotation toolbar appears** with highlight and read buttons
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

### TTS Browser Support

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
