# Accessibility Catalogs - TTS Integration

**Status:** ✅ Implemented (Phase 2)
**Date:** January 28, 2026

---

## Overview

The TTSService now supports QTI 3.0 accessibility catalogs, allowing assessments to provide pre-authored spoken content (SSML) that takes precedence over generated text-to-speech.

This integration enables:
- **High-quality spoken content** authored by content creators
- **Multi-language support** with catalog-based fallbacks
- **SSML control** over prosody, pauses, and pronunciation
- **Automatic fallback** to generated TTS when catalogs unavailable

---

## Quick Start

### 1. Initialize Services

```typescript
import {
  TTSService,
  BrowserTTSProvider,
  AccessibilityCatalogResolver
} from '@pie-players/pie-assessment-toolkit';

// Initialize TTS service
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());

// Initialize catalog resolver with assessment-level catalogs
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US' // default language
);

// Connect resolver to TTS service
ttsService.setCatalogResolver(catalogResolver);
```

### 2. Speak with Catalog Support

```typescript
// Basic usage - speak plain text
await ttsService.speak("Hello, student!");

// With catalog ID - uses pre-authored content if available
await ttsService.speak(
  "Welcome to the assessment", // fallback text
  {
    catalogId: 'welcome-message',
    language: 'en-US'
  }
);

// Multi-language support
await ttsService.speak(
  "Bienvenido",
  {
    catalogId: 'welcome-message',
    language: 'es-ES'
  }
);
```

### 3. Item-Level Catalogs

When rendering a new item, add its catalogs to the resolver:

```typescript
// Add item-level catalogs (higher precedence than assessment)
catalogResolver.addItemCatalogs(item.accessibilityCatalogs);

// Speak item prompt with catalog support
await ttsService.speak(
  "What is 2 + 2?",
  { catalogId: 'item-prompt' }
);

// Clear item catalogs when leaving item
catalogResolver.clearItemCatalogs();
```

---

## Catalog Resolution Flow

The TTSService follows this resolution flow:

```
┌─────────────────────────────────────────────┐
│ ttsService.speak(text, { catalogId })       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ catalogId      │ NO
         │ provided?      ├──────► Use plain text
         └────────┬───────┘
                  │ YES
                  ▼
         ┌────────────────┐
         │ Check catalog  │
         │ resolver       │
         └────────┬───────┘
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
    ┌─────────┐      ┌─────────┐
    │ Found   │      │ Not     │
    │ catalog │      │ found   │
    └────┬────┘      └────┬────┘
         │                │
         ▼                ▼
    Use catalog      Use plain text
    content (SSML)   (fallback)
```

**Priority Order:**
1. Item-level catalog (if present)
2. Assessment-level catalog (if present)
3. Plain text fallback (generated TTS)

---

## Example: Assessment with Catalogs

### Assessment Configuration

```typescript
const assessment: AssessmentEntity = {
  id: 'qti3-demo',
  qtiVersion: '3.0',

  // Assessment-level catalogs (shared across items)
  accessibilityCatalogs: [
    {
      identifier: 'welcome-message',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak><prosody rate="medium">Welcome to your assessment. <break time="500ms"/> Take your time and read each question carefully.</prosody></speak>'
        },
        {
          catalog: 'spoken',
          language: 'es-ES',
          content: '<speak><prosody rate="medium">Bienvenido a tu evaluación.</prosody></speak>'
        }
      ]
    }
  ],

  testParts: [
    {
      identifier: 'part1',
      sections: [
        {
          identifier: 'section1',
          rubricBlocks: [
            {
              view: 'candidate',
              use: 'instructions',
              // Reference catalog in HTML
              content: '<div data-catalog-id="welcome-message"><h3>Welcome</h3><p>Welcome to your assessment.</p></div>'
            }
          ],
          questionRefs: [...]
        }
      ]
    }
  ]
};
```

### Item-Level Catalogs

```typescript
const item: ItemEntity = {
  id: 'item-1',

  // Item-level catalogs (override assessment-level)
  accessibilityCatalogs: [
    {
      identifier: 'item-prompt',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>Question one. <break time="300ms"/> What is <emphasis>two</emphasis> plus <emphasis>two</emphasis>?</speak>'
        }
      ]
    },
    {
      identifier: 'choice-a',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>Choice A. <break time="200ms"/> Three</speak>'
        }
      ]
    }
  ],

  config: {
    prompt: '<div data-catalog-id="item-prompt">What is 2 + 2?</div>',
    choices: [
      { label: '<span data-catalog-id="choice-a">3</span>', value: 'a' },
      // ...
    ]
  }
};
```

### Usage in Player

```typescript
class AssessmentPlayer {
  private ttsService: TTSService;
  private catalogResolver: AccessibilityCatalogResolver;

  async loadAssessment(assessment: AssessmentEntity) {
    // Initialize catalog resolver with assessment-level catalogs
    this.catalogResolver = new AccessibilityCatalogResolver(
      assessment.accessibilityCatalogs,
      'en-US'
    );

    // Connect to TTS service
    this.ttsService.setCatalogResolver(this.catalogResolver);
  }

  async loadItem(item: ItemEntity) {
    // Add item-level catalogs
    this.catalogResolver.addItemCatalogs(item.accessibilityCatalogs || []);
  }

  async unloadItem() {
    // Clear item-level catalogs
    this.catalogResolver.clearItemCatalogs();
  }

  async handleTTSClick(element: HTMLElement) {
    // Extract catalog ID from clicked element or parent
    const catalogId = element.dataset.catalogId ||
                     element.closest('[data-catalog-id]')?.dataset.catalogId;

    const text = element.textContent || '';

    // Speak with catalog support
    await this.ttsService.speak(text, {
      catalogId,
      language: 'en-US'
    });
  }
}
```

---

## SSML Support

The catalog resolver returns raw SSML content, which TTS providers can process:

### Example SSML

```xml
<speak>
  <prosody rate="medium" pitch="medium">
    Welcome to the assessment.
    <break time="500ms"/>
    Read each question carefully.
  </prosody>
</speak>
```

### SSML Features

- **Prosody**: Control rate, pitch, volume
- **Breaks**: Insert pauses between phrases
- **Emphasis**: Highlight important words
- **Say-as**: Control interpretation (numbers, dates, etc.)
- **Voice**: Select specific voices (provider-dependent)

---

## Testing Catalog Integration

```typescript
import { TTSService, AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

// Mock TTS provider for testing
class MockTTSProvider {
  lastSpoken: string = '';

  async speak(text: string): Promise<void> {
    this.lastSpoken = text;
  }
}

// Test catalog resolution
test('should use catalog content when available', async () => {
  const catalogs = [
    {
      identifier: 'test-message',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>Catalog content</speak>'
        }
      ]
    }
  ];

  const resolver = new AccessibilityCatalogResolver(catalogs);
  const ttsService = new TTSService();
  const provider = new MockTTSProvider();

  await ttsService.initialize(provider);
  ttsService.setCatalogResolver(resolver);

  // Should use catalog content
  await ttsService.speak('Fallback text', {
    catalogId: 'test-message',
    language: 'en-US'
  });

  expect(provider.lastSpoken).toBe('<speak>Catalog content</speak>');
});

test('should fallback to plain text when catalog not found', async () => {
  const resolver = new AccessibilityCatalogResolver([]);
  const ttsService = new TTSService();
  const provider = new MockTTSProvider();

  await ttsService.initialize(provider);
  ttsService.setCatalogResolver(resolver);

  // Should use fallback text
  await ttsService.speak('Fallback text', {
    catalogId: 'missing-catalog',
    language: 'en-US'
  });

  expect(provider.lastSpoken).toBe('Fallback text');
});
```

---

## Browser Compatibility

The BrowserTTSProvider (Web Speech API) has limited SSML support:

| Browser | SSML Support | Notes |
|---------|--------------|-------|
| Chrome  | ⚠️ Partial   | Basic tags only |
| Firefox | ❌ None      | Strips SSML tags |
| Safari  | ❌ None      | Strips SSML tags |
| Edge    | ⚠️ Partial   | Basic tags only |

**Recommendation:** For full SSML support, use cloud TTS providers:
- AWS Polly (full SSML support)
- Google Cloud TTS (full SSML support)
- Azure Speech Services (full SSML support)

---

## Next Steps

### Phase 3: Extended Integration

- **TTS Tool Integration**: Update pie-tool-text-to-speech to detect catalog IDs in clicked content
- **AssessmentPlayer Integration**: Automatic catalog resolver initialization
- **HTML Content Detection**: Utility to extract catalog IDs from DOM elements

### Phase 4: Extended Catalog Types

Beyond spoken content:
- Sign language video player
- Braille display output
- Tactile graphics rendering

### Phase 5: Authoring Tools

- Catalog editor UI components
- SSML editor with validation
- Multi-language catalog management

---

## References

- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Complete integration patterns
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [QTI 3.0 Feature Support](qti-3.0-feature-support.md) - Overall QTI 3.0 implementation status
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
