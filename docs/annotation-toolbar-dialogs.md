# Annotation Toolbar Dialog Components

The annotation toolbar now displays results in polished DaisyUI dialogs instead of browser alerts.

## Dictionary Dialog

**Features:**
- Displays word definition(s) with parts of speech
- Shows examples when available
- Multiple definitions displayed as separate cards
- Clean, readable typography
- Primary badge for part of speech (noun, verb, etc.)
- Italic example text with left border accent

**Layout:**
- Modal with max-width of 2xl (max-w-2xl)
- Dictionary icon in header
- Keyword highlighted in primary color
- Each definition in a base-200 card
- Close button in top-right and bottom

**Usage:**
```typescript
dictionaryDialog = {
  open: true,
  keyword: 'photosynthesis',
  language: 'en-us',
  definitions: [
    {
      partOfSpeech: 'noun',
      definition: 'The process by which green plants use sunlight...',
      example: 'Photosynthesis generates oxygen as a byproduct.'
    }
  ]
};
```

---

## Picture Dictionary Dialog

**Features:**
- Grid layout of images (2 columns on mobile, 3 on desktop)
- Responsive image cards
- Automatic fallback for broken images
- Empty state message when no images found
- Rounded images with shadow effects
- Object-fit cover for consistent sizing

**Layout:**
- Modal with max-width of 4xl (max-w-4xl) for larger image display
- Picture icon in header
- Keyword highlighted in primary color
- Grid of image cards (base-200 background)
- Each image 192px height (h-48) with object-cover
- Info alert when no images available

**Usage:**
```typescript
pictureDictionaryDialog = {
  open: true,
  keyword: 'triangle',
  images: [
    { image: 'https://example.com/image1.jpg' },
    { image: 'https://example.com/image2.jpg' }
  ]
};
```

---

## Translation Dialog

**Features:**
- Two-panel layout showing original and translated text
- Language badges (source and target)
- Arrow indicator between panels
- Highlighted translation with primary color accent
- Clear visual hierarchy
- Language codes displayed (EN, ES, FR, etc.)

**Layout:**
- Modal with max-width of 2xl (max-w-2xl)
- Translation icon in header
- Original text in base-200 card with outline badge
- Down arrow indicator (primary color)
- Translated text in primary/10 background with border
- Primary badge for target language

**Usage:**
```typescript
translationDialog = {
  open: true,
  originalText: 'Hello, how are you?',
  translatedText: 'Hola, ¿cómo estás?',
  sourceLanguage: 'en',
  targetLanguage: 'es'
};
```

---

## Visual Design

All dialogs follow these design principles:

### Colors
- **Primary**: Used for keyword highlights, badges, and accent colors
- **Base-200**: Used for card backgrounds
- **Base-content**: Default text color with opacity variations

### Typography
- **Headings**: Bold, text-lg with icons
- **Body**: text-base for main content
- **Secondary**: text-sm with reduced opacity for examples/labels

### Spacing
- **Cards**: p-4 padding for comfortable reading
- **Sections**: space-y-4 for vertical rhythm
- **Modal**: Standard DaisyUI modal spacing

### Interactivity
- **Close buttons**: Both X button (top-right) and action button (bottom)
- **Backdrop**: Click outside to close
- **Keyboard**: ESC key support via DaisyUI modal

### Accessibility
- Proper heading hierarchy
- Alt text on images
- ARIA labels on interactive elements
- Screen reader friendly structure

---

## Code Structure

### State Management
Each dialog has its own state object with Svelte 5 runes:

```typescript
let dictionaryDialog = $state<{
  open: boolean;
  keyword: string;
  language: string;
  definitions: Array<{
    partOfSpeech: string;
    definition: string;
    example?: string;
  }>;
}>({
  open: false,
  keyword: '',
  language: '',
  definitions: []
});
```

### Opening Dialogs
From annotation toolbar event handlers:

```typescript
ondictionarylookup={async (detail) => {
  const result = await annotationAPIClient.lookupDictionary(detail.text);
  dictionaryDialog = {
    open: true,
    keyword: result.keyword,
    language: result.language,
    definitions: result.definitions
  };
}}
```

### Closing Dialogs
Multiple ways to close:

```typescript
// X button
<button onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}>✕</button>

// Action button
<button onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}>Close</button>

// Backdrop click
<form method="dialog" class="modal-backdrop">
  <button onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}>close</button>
</form>
```

---

## Customization

### Adding More Fields
To add more fields to dialogs, extend the state type:

```typescript
let dictionaryDialog = $state<{
  // ... existing fields ...
  pronunciation?: string;  // NEW
  synonyms?: string[];     // NEW
}>({
  // ... existing defaults ...
  pronunciation: '',
  synonyms: []
});
```

Then display in the dialog:

```svelte
{#if definition.pronunciation}
  <div class="badge badge-sm badge-ghost">{definition.pronunciation}</div>
{/if}
```

### Styling Changes
All dialogs use DaisyUI utility classes. To customize:

```svelte
<!-- Change max width -->
<div class="modal-box max-w-5xl">  <!-- Instead of max-w-2xl -->

<!-- Change card colors -->
<div class="card bg-primary/20">  <!-- Instead of bg-base-200 -->

<!-- Change badge colors -->
<div class="badge badge-secondary">  <!-- Instead of badge-primary -->
```

### Animation
DaisyUI modals automatically animate. For custom animations:

```svelte
<dialog class="modal modal-open animate-fade-in">
  <!-- ... -->
</dialog>

<style>
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
```

---

## Testing

To test the dialogs:

1. Start the dev server:
   ```bash
   cd apps/section-demos && bun run dev
   ```

2. Navigate to a demo with content

3. Select text in the content area

4. Click Dictionary, Picture Dictionary, or Translation buttons

5. Verify:
   - Dialog opens with correct data
   - Close button works (X and action button)
   - Click backdrop to close
   - ESC key closes dialog
   - Layout is responsive
   - Images load correctly (picture dictionary)

---

## Browser Compatibility

- **Modern browsers**: Full support (Chrome, Edge, Safari, Firefox)
- **DaisyUI modals**: Based on native `<dialog>` element
- **Fallback**: Not needed for modern browsers (2020+)

---

## Performance

- **Lazy rendering**: Dialogs only render when `open: true`
- **No DOM mutation**: Svelte reactivity handles updates
- **Image loading**: Lazy loaded by browser
- **State updates**: Efficient with Svelte 5 runes

---

## Future Enhancements

Potential improvements:

1. **Copy to clipboard** button for translations
2. **Audio pronunciation** for dictionary entries
3. **Save favorites** for picture dictionary images
4. **Zoom/lightbox** for picture dictionary images
5. **Multiple target languages** for translation
6. **History** of recent lookups
7. **Loading states** during API calls
8. **Error boundaries** for failed requests
