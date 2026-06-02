# Accessibility Catalogs - TTS Integration

<!-- markdownlint-disable MD032 MD040 MD060 -->

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

### 1. Initialize ToolkitCoordinator and Section Player

`ToolkitCoordinator` is the primary entry point for application integrations.
It owns `TTSService`, `AccessibilityCatalogResolver`, highlighting, tool
placement, and provider setup.

```javascript
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  accessibility: {
    catalogs: assessment.accessibilityCatalogs ?? [],
    language: 'en-US',
  },
  tools: {
    placement: {
      item: ['textToSpeech'],
      passage: ['textToSpeech'],
      section: [],
    },
    providers: {
      textToSpeech: {
        settings: { backend: 'browser' },
      },
    },
  },
});

const sectionPlayer = document.querySelector('pie-section-player-splitpane');
sectionPlayer.runtime = {
  ...(sectionPlayer.runtime ?? {}),
  coordinator,
  tools: coordinator.config.tools,
};
sectionPlayer.assessmentId = assessment.id;
sectionPlayer.sectionId = section.identifier;
sectionPlayer.attemptId = attempt.id;
sectionPlayer.section = section;
```

### 2. Catalog Management

The section player runtime:

- **Registers provided catalogs** from passages, items, models, and
  `config.extractedCatalogs`
- **Manages scoped registrations** - registers on shell mount and unregisters on navigation/unmount
- **Renders TTS tools** inline in passage/item headers when services present
- **Resolves spoken content** from item/model-scoped catalogs, then shared assessment catalogs, then generated speech or visible text

**You don't need to manually:**
- Call `addItemCatalogs()` or `clearItemCatalogs()`
- Manage TTS tool visibility
- Handle catalog lifecycle

If you author embedded `<speak>` tags, run `SSMLExtractor` or an equivalent
preprocessing step before render so `config.extractedCatalogs` is present for
runtime registration.

### 3. Using Server-Side TTS (Optional)

For production with high-quality voices and precise word highlighting:

```javascript
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  accessibility: {
    catalogs: assessment.accessibilityCatalogs ?? [],
    language: 'en-US',
  },
  tools: {
    placement: { item: ['textToSpeech'], passage: ['textToSpeech'], section: [] },
    providers: {
      textToSpeech: {
        settings: {
          backend: 'server',
          serverProvider: 'polly',
          apiEndpoint: '/api/tts',
          defaultVoice: 'Joanna',
          language: 'en-US',
        },
      },
    },
  },
});
```

---

## SSML Extraction Workflow

`SSMLExtractor` can convert embedded SSML into cleaned visual markup plus
`extractedCatalogs`. The current section-player runtime registers
`extractedCatalogs` when they are already present; it does not invoke extraction
itself during shell registration.

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
    + language       (data-catalog-idref)
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
- Content import/preprocessing can call `SSMLExtractor`
- The cleaned config carries `config.extractedCatalogs`
- Runtime catalog registration registers those catalogs when item or passage
  shells mount

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
1. Catalogs scoped to the active item/model, including `config.extractedCatalogs`
2. Shared assessment catalogs supplied to `ToolkitCoordinator`
3. Generated speech, including supported MathML speech
4. Visible text fallback

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
              content: '<div data-catalog-idref="welcome-message"><h3>Welcome</h3><p>Welcome to your assessment.</p></div>'
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
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="item-prompt">What is 2 + 2?</div>',
        choices: [
          { label: '<span data-catalog-idref="choice-a">3</span>', value: 'a' },
          { label: '<span>4</span>', value: 'b' }
        ]
      }
    ]
  }
};
```

### Usage with Section Player

The **PIE Section Player** is the primary interface for integrating the assessment toolkit services.

```javascript
const sectionPlayer = document.querySelector('pie-section-player-splitpane');
sectionPlayer.runtime = {
  ...(sectionPlayer.runtime ?? {}),
  coordinator,
  tools: coordinator.config.tools,
};
sectionPlayer.section = section;
```

**Key Points:**
- The section player registers catalogs already present on passages, items,
  models, and `config.extractedCatalogs`
- Item-level catalog registrations are scoped to shell lifecycle
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
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

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
  const spoken = resolver.getAlternative('test-message', {
    type: 'spoken',
    language: 'en-US'
  });

  expect(spoken?.content).toBe('<speak>Catalog content</speak>');
});

test('should fallback to plain text when catalog not found', async () => {
  const resolver = new AccessibilityCatalogResolver([]);
  const spoken = resolver.getAlternative('missing-catalog', {
    type: 'spoken',
    language: 'en-US',
    useFallback: true
  });

  expect(spoken).toBeNull();
});
```

For `TTSService` provider tests, follow the mock provider/implementation pattern
in `packages/assessment-toolkit/tests/tts-service-catalog-composition.test.ts`.

---

## Browser Compatibility

Browser TTS is the always-available fallback, but full SSML support requires a
server-backed provider such as AWS Polly. Keep provider-specific tag details in
[AWS SSML Tags Reference](aws-ssml-tags-reference.md) and use this guide only
for the catalog/TTS integration shape.

---

## Embedded SSML Authoring Pattern

Authors can embed SSML directly in PIE content:

```typescript
const item = {
  config: {
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: `<div>
          <speak xml:lang="en-US">
            Solve for <emphasis>x</emphasis> in the equation
            <prosody rate="slow">x squared, plus two x, equals eight</prosody>.
          </speak>
          <p>Solve for <em>x</em> in the equation: x² + 2x = 8</p>
        </div>`
      }
    ]
  }
};
```

**Preprocessing:**
- A preprocessing step runs `SSMLExtractor`
- Catalog generated with ID `auto-prompt-{modelId}-0`
- Visual markup cleaned (SSML removed)
- `data-catalog-idref` attribute added

**At Runtime:**
- Runtime registration registers the extracted catalog with the resolver

**Result:**
- TTS buttons use extracted SSML
- User-selection TTS uses extracted SSML
- Visual display shows clean HTML
- No separate catalog authoring needed

## Troubleshooting

### SSML Not Working

**Symptoms:** TTS uses plain text instead of SSML pronunciation

**Possible Causes:**
1. **SSML was not extracted before render**
   - Check: Does content have `<speak>` tags?
   - Fix: Run `SSMLExtractor` or an equivalent preprocessing step before render

2. **Catalog ID not passed to TTS**
   - Check: Does element have `data-catalog-idref` attribute?
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
1. Run `SSMLExtractor` before rendering the content
2. Verify the cleaned config is passed to the player
3. Verify `item.config.extractedCatalogs` contains the generated catalogs
4. Check browser console for catalog registration errors

### Catalog IDs Colliding

**Symptoms:** Wrong SSML spoken for content

**Cause:** Duplicate auto-generated catalog IDs

**Fix:**
1. SSMLExtractor uses counter to ensure uniqueness
2. Format: `auto-{context}-{identifier}-{counter}`
3. Counter resets per extraction session
4. Shell-scoped catalog registrations are replaced on navigation

## Current Runtime Behavior

- **SSML Extraction**: Import/preprocessing can convert embedded `<speak>` tags into catalog-backed alternatives
- **TTS Tool Integration**: TTS controls render inline in passage and item headers when enabled
- **Section Player Integration**: Section-player is the primary runtime surface for these flows
- **Catalog Management**: Shell-scoped catalogs are registered and unregistered as section content changes
- **HTML Content Detection**: Catalog IDs are discovered from rendered DOM content
- **Server-Side TTS Support**: Server-backed providers such as AWS Polly can supply precise highlighting data

## References

- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Complete integration patterns
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [Section Player Client Guide](../section-player/client-architecture-tutorial.md) - Current runtime integration surface for section delivery
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
