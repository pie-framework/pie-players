# PIE Players i18n System

Comprehensive internationalization system with support for English, Spanish, Chinese, and Arabic (RTL).

## Usage Patterns

### Pattern 1: Standalone Components (Recommended for Individual Components)

Use `useI18nStandalone()` when building standalone components (tools, players) that don't require the full toolkit architecture.

```svelte
<script lang="ts">
  import { useI18nStandalone } from '@pie-framework/pie-players-shared/i18n';

  // Simple setup - no service injection needed
  const i18n = useI18nStandalone({
    locale: 'en',  // Optional: defaults to browser language
    debug: false   // Optional: enable debug logging
  });
</script>

<div dir={i18n.direction}>
  <button>{i18n.t('common.save')}</button>
  <span>{i18n.tn('assessment.questions', 10)}</span>

  <!-- Change locale dynamically -->
  <button onclick={() => i18n.setLocale('es')}>Español</button>
  <button onclick={() => i18n.setLocale('ar')}>العربية</button>
</div>
```

**Benefits:**
- ✅ No service architecture required
- ✅ Self-contained - manages its own I18nService instance
- ✅ Full feature support (hybrid loading, RTL, pluralization)
- ✅ Perfect for reusable components and tools

### Pattern 2: Integrated with Assessment Toolkit

Use `useI18n()` when working within the full assessment toolkit where centralized locale management is needed.

```svelte
<script lang="ts">
  import { useI18n } from '@pie-framework/pie-players-shared/i18n';

  // Receive service from parent/context
  let { player } = $props();
  const i18n = useI18n(() => player.getI18nService());
</script>

<div dir={i18n.direction}>
  <button>{i18n.t('common.save')}</button>
  <span>{i18n.tn('assessment.questions', totalQuestions)}</span>
</div>
```

**Benefits:**
- ✅ Centralized locale management across entire application
- ✅ Locale preferences from student profile/IEP
- ✅ Shared service instance - locale changes sync everywhere
- ✅ Integration with accommodation system

### Pattern 3: Direct Service Usage (Advanced)

For non-Svelte contexts or advanced use cases:

```typescript
import { SimpleI18n, BUNDLED_TRANSLATIONS, loadTranslations } from '@pie-framework/pie-players-shared/i18n';

const i18n = new SimpleI18n({
  locale: 'en',
  bundledTranslations: BUNDLED_TRANSLATIONS,
  loadTranslations,
});

await i18n.initialize({ locale: 'es' });

console.log(i18n.t('common.save')); // "Guardar"
console.log(i18n.getDirection()); // "ltr"

// Subscribe to changes
const unsubscribe = i18n.subscribe(() => {
  console.log('Locale changed to:', i18n.getLocale());
});
```

## Translation Functions

### `t(key, params?)` - Basic Translation

```typescript
i18n.t('common.save')  // "Save"
i18n.t('common.cancel') // "Cancel"

// With interpolation
i18n.t('assessment.question_of', { current: 5, total: 20 })
// "Question 5 of 20"
```

### `tn(key, count, params?)` - Pluralization

```typescript
i18n.tn('assessment.questions', 1)  // "1 Question"
i18n.tn('assessment.questions', 10) // "10 Questions"

// With additional params
i18n.tn('common.item', count, { type: 'folder' })
```

## Available Translations

### Common Namespace (`common.*`)
- Buttons: `save`, `cancel`, `close`, `back`, `next`, `previous`, `submit`
- States: `loading`, `error`, `retry`
- Common words: `question`, `item`, `character` (all with pluralization)

### Assessment Namespace (`assessment.*`)
- `title` - Assessment title
- `questions` - Question count (plural)
- `question_of` - "Question X of Y"
- `student_name` - Student name label
- `fullscreen`, `exit_fullscreen` - Fullscreen controls

### Accommodation Namespace (`accommodation.*`)
- `audio`, `audio_aria` - Audio/TTS controls
- `contrast`, `contrast_aria` - Contrast controls

### Navigation Namespace (`navigation.*`)
- `back`, `next`, `previous`, `submit` - Navigation buttons
- `navigate_to` - "Navigate to question X"
- `section` - Section label

### Tool Namespace (`tool.*`)
- Tool names: `calculator`, `graph`, `periodic_table`, etc.
- TTS controls: `tts.speak`, `tts.pause`, `tts.stop`, `tts.rate`
- Calculator types: `calculator.basic`, `calculator.scientific`, `calculator.graphing`
- Color schemes: `color_scheme.default`, `color_scheme.high_contrast`, `color_scheme.dark`

## Supported Languages

- **English (en)** - Bundled (~15KB)
- **Spanish (es)** - Lazy-loaded (~12KB)
- **Chinese (zh)** - Lazy-loaded (~12KB)
- **Arabic (ar)** - Lazy-loaded (~12KB) with RTL support

## RTL Support

Arabic automatically switches to RTL mode:

```svelte
<script>
  const i18n = useI18nStandalone({ locale: 'ar' });
</script>

<!-- direction automatically set to "rtl" -->
<div dir={i18n.direction}>
  {i18n.t('assessment.title')} <!-- التقييم -->
</div>
```

## API Reference

### Composable Return Value

```typescript
{
  // Reactive getters
  locale: string;           // Current locale (e.g., 'en', 'es')
  direction: 'ltr' | 'rtl'; // Text direction
  isLoading: boolean;       // Locale loading state
  availableLocales: string[]; // List of loaded locales

  // Methods
  t(key: string, params?: Record<string, any>): string;
  tn(key: string, count: number, params?: Record<string, any>): string;
  setLocale(locale: string): Promise<void>;
  isLocaleLoaded(locale: string): boolean;
  hasKey(key: string): boolean;
}
```

## When to Use Each Pattern

| Scenario | Use Pattern |
|----------|-------------|
| Standalone tool component | `useI18nStandalone()` |
| Reusable UI component | `useI18nStandalone()` |
| Individual player | `useI18nStandalone()` |
| Full assessment application | `useI18n()` |
| Student profile integration | `useI18n()` |
| IEP/504 locale requirements | `useI18n()` |
| Non-Svelte code | `SimpleI18n` class |

## Performance

- **Initial load**: ~15KB (English bundled)
- **Lazy loading**: ~12KB per additional language (cached)
- **Hybrid strategy**: Only loads languages when needed
- **Service reuse**: `useI18nStandalone()` creates one service per component

## Adding New Translations

Translation files are located at:
```
packages/players-shared/src/i18n/translations/
├── en/  (common.json, toolkit.json, tools.json)
├── es/  (common.json, toolkit.json, tools.json)
├── zh/  (common.json, toolkit.json, tools.json)
└── ar/  (common.json, toolkit.json, tools.json)
```

Format:
```json
{
  "common": {
    "save": "Save",
    "question": {
      "one": "Question",
      "other": "Questions"
    }
  }
}
```
