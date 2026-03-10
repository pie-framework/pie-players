# Accessibility Catalogs - TTS Integration

**Status:** ✅ Implemented
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

### 1. Initialize Services and Section Player

> **Note:** `ToolkitCoordinator` is now the primary entry point for integrating the assessment toolkit.
> It wraps and manages `ToolCoordinator`, `HighlightCoordinator`, `TTSService`, `AccessibilityCatalogResolver`,
> and other services. You can still use the individual services directly (as shown below), but for new
> integrations prefer `ToolkitCoordinator` which sets up and coordinates all services automatically.

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  AccessibilityCatalogResolver,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize TTS service
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());

// Initialize catalog resolver with assessment-level catalogs
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs || [],
  'en-US' // default language
);

// Initialize coordinators
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();

// Connect services
ttsService.setCatalogResolver(catalogResolver);
ttsService.setHighlightCoordinator(highlightCoordinator);

// Pass services to section player (JavaScript properties, NOT HTML attributes)
const sectionPlayer = document.getElementById('section-player');
sectionPlayer.ttsService = ttsService;
sectionPlayer.toolCoordinator = toolCoordinator;
sectionPlayer.highlightCoordinator = highlightCoordinator;
sectionPlayer.catalogResolver = catalogResolver;

// Set section data - the player handles everything else automatically
sectionPlayer.section = section;
```

### 2. Automatic Catalog Management

The section player **automatically**:

- **Extracts SSML** from embedded `<speak>` tags in passages and items
- **Generates catalogs** with unique IDs and registers them
- **Manages item-level catalogs** - adds on item load, clears on navigation
- **Renders TTS tools** inline in passage/item headers when services present
- **Resolves catalogs** with proper priority: extracted → item → assessment

**You don't need to manually:**
- Call `addItemCatalogs()` or `clearItemCatalogs()`
- Extract SSML or generate catalog entries
- Manage TTS tool visibility
- Handle catalog lifecycle

The section player does all of this automatically.

### 3. Using Server-Side TTS (Optional)

For production with high-quality voices and precise word highlighting:

```javascript
import { ServerTTSProvider } from '@pie-players/tts-client-server';

// Use server-side TTS instead of browser TTS
const serverProvider = new ServerTTSProvider();
await ttsService.initialize(serverProvider, {
  apiEndpoint: '/api/tts',
  provider: 'polly',
  voice: 'Joanna',
  language: 'en-US'
});

// Rest of the setup is identical
sectionPlayer.ttsService = ttsService;
// ...
```

---

## SSML Extraction Workflow

The PIE Players automatically extract embedded SSML from content at runtime:

```
┌────────────────────────────────────────────┐
│ Item/Passage loads with embedded SSML      │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ SSMLExtractor  │
         │ parses content │
         └────────┬───────┘
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
    Find <speak>    Clean markup
    elements        (remove SSML)
          │                │
          ▼                ▼
    Extract SSML     Add catalog IDs
    + language       (data-catalog-id)
          │                │
          └───────┬────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Generate       │
         │ catalog        │
         │ entries        │
         └────────┬───────┘
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
    Update config    Register with
    (cleaned +       CatalogResolver
    catalogs)
```

**Extraction Points:**
- `ItemRenderer.svelte` - Processes item config on load
- `PassageRenderer.svelte` - Processes passage config on load
- Runs automatically in `$effect` hook
- No author configuration required

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
1. Extracted catalogs from SSML (auto-generated)
2. Item-level catalog (manually authored)
3. Assessment-level catalog (manually authored)
4. Plain text fallback (generated TTS)

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

### Usage with Section Player

The **PIE Section Player** is the primary interface for integrating the assessment toolkit services.

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  AccessibilityCatalogResolver,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs || [],
  'en-US'
);

// Initialize TTS with a provider
await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);
ttsService.setHighlightCoordinator(highlightCoordinator);

// Pass services to section player (as JavaScript properties, NOT HTML attributes)
const sectionPlayer = document.getElementById('section-player');
sectionPlayer.ttsService = ttsService;
sectionPlayer.toolCoordinator = toolCoordinator;
sectionPlayer.highlightCoordinator = highlightCoordinator;
sectionPlayer.catalogResolver = catalogResolver;  // Enables automatic SSML extraction

// Set section data
sectionPlayer.section = section;
```

**Key Points:**
- The section player automatically extracts SSML from items and passages
- Item-level catalogs are registered/cleared automatically as items load/unload
- TTS tools render inline in passage and item headers when services are provided
- All catalog resolution happens transparently within the player

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

## Embedded SSML Authoring Pattern

Authors can embed SSML directly in PIE content:

```typescript
const item = {
  config: {
    models: [{
      prompt: `<div>
        <speak xml:lang="en-US">
          Solve for <emphasis>x</emphasis> in the equation
          <prosody rate="slow">x squared, plus two x, equals eight</prosody>.
        </speak>
        <p>Solve for <em>x</em> in the equation: x² + 2x = 8</p>
      </div>`
    }]
  }
};
```

**At Runtime:**
- SSML extracted automatically
- Catalog generated with ID `auto-prompt-{modelId}-0`
- Visual markup cleaned (SSML removed)
- `data-catalog-id` attribute added
- Catalog registered with resolver

**Result:**
- TTS buttons use extracted SSML
- User-selection TTS uses extracted SSML
- Visual display shows clean HTML
- No separate catalog authoring needed

## Troubleshooting

### SSML Not Working

**Symptoms:** TTS uses plain text instead of SSML pronunciation

**Possible Causes:**
1. **SSML not detected during extraction**
   - Check: Does content have `<speak>` tags?
   - Fix: Ensure SSML is properly wrapped in `<speak>` element

2. **Catalog ID not passed to TTS**
   - Check: Does element have `data-catalog-id` attribute?
   - Fix: Verify SSMLExtractor ran (check `item.config.extractedCatalogs`)

3. **Invalid SSML markup**
   - Check: Browser console for SSML parsing errors
   - Fix: Validate SSML syntax (matching tags, proper attributes)

4. **Language mismatch**
   - Check: SSML `xml:lang` matches TTS request language
   - Fix: Use consistent language codes (`en-US`, `es-ES`, etc.)

### Visual Content Shows SSML Tags

**Symptoms:** Users see `<speak>` or `<prosody>` tags in display

**Cause:** SSML extraction not running

**Fix:**
1. Verify `catalogResolver` prop is passed to section player
2. Check ItemRenderer/PassageRenderer have extraction code
3. Ensure `$effect` hook is executing
4. Check browser console for extraction errors

### Catalog IDs Colliding

**Symptoms:** Wrong SSML spoken for content

**Cause:** Duplicate auto-generated catalog IDs

**Fix:**
1. SSMLExtractor uses counter to ensure uniqueness
2. Format: `auto-{context}-{identifier}-{counter}`
3. Counter resets per extraction session
4. Item-level catalogs cleared on navigation

## Integration Status

### Completed ✅

- ✅ **SSML Extraction**: Automatic extraction from embedded `<speak>` tags
- ✅ **TTS Tool Integration**: Inline TTS tools in passage/item headers
- ✅ **Section Player Integration**: Primary interface for toolkit services
- ✅ **Catalog Management**: Automatic lifecycle management (add/clear on navigation)
- ✅ **HTML Content Detection**: Catalog ID detection from DOM elements
- ✅ **Server-Side TTS**: AWS Polly with speech marks for precise highlighting

## References

- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Complete integration patterns
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [QTI 3.0 Feature Support](qti-3.0-feature-support.md) - Overall QTI 3.0 implementation status
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
