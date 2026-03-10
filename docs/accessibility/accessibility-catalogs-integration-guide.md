# QTI 3.0 Accessibility Catalogs - Integration Guide

**Status:** Implemented (core) with ongoing runtime integration work
**Date:** January 2026
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration with PIE](#integration-with-pie)
4. [TTSService Integration](#ttsservice-integration)
5. [Section Player Integration](#section-player-integration)
6. [PIE Element Authoring](#pie-element-authoring)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

---

## Overview

QTI 3.0 Accessibility Catalogs provide standardized alternative representations of content for assistive technologies. This guide explains how catalogs integrate with the PIE assessment toolkit at both **assessment-level** and **item-level**.

### Supported Catalog Types

| Type | Description | Use Case |
|------|-------------|----------|
| `spoken` | Pre-authored TTS scripts (SSML) | Screen readers, TTS |
| `sign-language` | Video URLs for signed content | Deaf/hard-of-hearing |
| `braille` | Braille-ready transcriptions | Blind users with refreshable displays |
| `tactile` | Descriptions for tactile graphics | Tactile diagram readers |
| `simplified-language` | Plain language alternatives | Cognitive accessibility, ELL |
| `audio-description` | Extended audio descriptions | Visual content for blind users |
| `extended-description` | Detailed text descriptions | Complex diagrams/images |

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PIE Section Player (Primary)               │
│  ┌───────────────────────────────────────────────────┐ │
│  │     AccessibilityCatalogResolver                  │ │
│  │                                                   │ │
│  │  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │ Assessment-     │  │ Item-Level      │       │ │
│  │  │ Level Catalogs  │  │ Catalogs        │       │ │
│  │  │ (Shared)        │  │ (Auto-managed)  │       │ │
│  │  └─────────────────┘  └─────────────────┘       │ │
│  │                                                   │ │
│  │  Priority: Extracted > Item > Assessment         │ │
│  └───────────────────────────────────────────────────┘ │
│                         │                               │
│                         ├──────┬──────┬─────────────┐   │
│                         ▼      ▼      ▼             ▼   │
│                  ┌─────────────────────────────────────┤
│                  │  TTSService (spoken)                │
│                  │  VideoPlayer (sign-language)        │
│                  │  BrailleRenderer (braille)          │
│                  │  ContentTransformer (simplified)    │
│                  └─────────────────────────────────────┘
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Service Initialization**: Create services and pass to section player
2. **Section Load**: Section player receives assessment-level catalogs via resolver
3. **Item/Passage Render**: Section player automatically:
   - Extracts SSML from embedded `<speak>` tags
   - Generates catalog entries with unique IDs
   - Adds item-level catalogs to resolver
4. **Content Request**: Resolve catalog by ID and type (extracted → item → assessment)
5. **Service Integration**: Pass resolved content to appropriate service (TTS, video player, etc.)
6. **Navigation**: Section player automatically clears item-level catalogs
7. **Fallback**: If catalog not found, use default rendering

---

## Integration with PIE

### Automatic SSML Extraction from PIE Content

The PIE Players automatically extract embedded `<speak>` SSML tags from item content and convert them into QTI 3.0 accessibility catalogs at runtime.

#### Why Automatic Extraction?

Authors can embed SSML directly in content for convenience:
- Proper pronunciation of technical terms (e.g., "polynomial")
- Math expressions spoken correctly ("x squared minus five x")
- Emphasis and pacing control
- No need to maintain separate catalog files

The system automatically:
1. Extracts SSML during item/passage load
2. Generates catalog entries with unique IDs
3. Cleans visual markup (removes SSML tags)
4. Registers catalogs with AccessibilityCatalogResolver

#### Complete Transformation Example

**Before (Author Creates This):**

```typescript
{
  identifier: 'q1-quadratic',
  item: {
    id: 'quadratic-q1',
    name: 'Quadratic Question',
    baseId: 'quadratic-q1',
    version: { major: 1, minor: 0, patch: 0 },
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
            <!-- Author embeds SSML for proper math pronunciation -->
            <speak xml:lang="en-US">
              Which method should you use to solve
              <prosody rate="slow">x squared, minus five x, plus six,
              equals zero</prosody>?
            </speak>

            <!-- Visual content for display -->
            <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
          </div>`,
          choiceMode: 'radio',
          choices: [
            {
              value: 'a',
              label: `<speak>The <emphasis>quadratic formula</emphasis></speak>
                      <span>The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<speak><emphasis level="strong">Factoring</emphasis>,
                      because it's easiest</speak>
                      <span>Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<speak>Completing the square</speak>
                      <span>Completing the square</span>`
            },
            {
              value: 'd',
              label: 'Graphing'  // No SSML - will use plain text
            }
          ]
        }
      ]
    }
  }
}
```

**After (Automatic Extraction at Runtime):**

```typescript
{
  identifier: 'q1-quadratic',
  item: {
    id: 'quadratic-q1',
    name: 'Quadratic Question',
    baseId: 'quadratic-q1',
    version: { major: 1, minor: 0, patch: 0 },
    config: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: {
        'multiple-choice': '@pie-element/multiple-choice@latest'
      },

      // ✅ CLEANED: SSML removed, catalog IDs added
      models: [
        {
          id: 'q1',
          element: 'multiple-choice',
          prompt: `<div data-catalog-id="auto-prompt-q1-0">
            <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
          </div>`,
          choiceMode: 'radio',
          choices: [
            {
              value: 'a',
              label: `<span data-catalog-id="auto-choice-q1-a-0">The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<span data-catalog-id="auto-choice-q1-b-0">Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<span data-catalog-id="auto-choice-q1-c-0">Completing the square</span>`
            },
            {
              value: 'd',
              label: 'Graphing'  // No catalog ID - no SSML found
            }
          ]
        }
      ],

      // ✅ NEW: Extracted SSML catalogs
      extractedCatalogs: [
        {
          identifier: 'auto-prompt-q1-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak xml:lang="en-US">
                Which method should you use to solve
                <prosody rate="slow">x squared, minus five x, plus six,
                equals zero</prosody>?
              </speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-a-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak>The <emphasis>quadratic formula</emphasis></speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-b-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak><emphasis level="strong">Factoring</emphasis>,
                because it's easiest</speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-c-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak>Completing the square</speak>`
            }
          ]
        }
      ]
    }
  }
}
```

#### Key Transformations

| Aspect | Before | After |
|--------|--------|-------|
| **Visual Content** | Mixed SSML + HTML | Clean HTML only |
| **Catalog IDs** | None | Auto-generated `data-catalog-id` |
| **SSML Storage** | Embedded in markup | Separate `extractedCatalogs` array |
| **Structure** | Dual content (speak + visual) | Single visual + catalog reference |

#### TTS Behavior After Extraction

1. **Content-Level TTS (tool-tts-inline):**
   - User clicks speaker icon in header
   - Tool calls `ttsService.speak(text, { catalogId: 'auto-prompt-q1-0' })`
   - Resolver finds SSML in `extractedCatalogs`
   - Polly/Browser speaks with proper math pronunciation and pacing

2. **User-Selection TTS (annotation toolbar):**
   - User selects "The quadratic formula" text
   - Tool detects nearest `data-catalog-id="auto-choice-q1-a-0"`
   - Calls `ttsService.speak(selectedText, { catalogId: 'auto-choice-q1-a-0' })`
   - Resolver finds SSML with `<emphasis>`
   - Speaks with proper emphasis

3. **Plain Text Fallback:**
   - User selects "Graphing" (choice d - no SSML)
   - No catalog ID present
   - TTS uses plain text with browser TTS
   - Still works, just without enhanced pronunciation

#### Extraction Service

**Location:** `packages/assessment-toolkit/src/services/SSMLExtractor.ts`

**Usage:**

```typescript
import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

const extractor = new SSMLExtractor();
const result = extractor.extractFromItemConfig(item.config);

// Update config with cleaned content
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;

// Register with resolver
catalogResolver.addItemCatalogs(result.catalogs);
```

**Integration Points:**
- `ItemRenderer.svelte` - Extracts SSML from items automatically
- `PassageRenderer.svelte` - Extracts SSML from passages automatically
- Runs transparently during render (no author action needed)

### Catalog References in PIE Markup

PIE items reference catalogs using the `data-catalog-id` attribute (either manually authored or auto-generated by SSML extraction):

```html
<!-- Prompt with catalog reference -->
<pie-prompt>
  <div data-catalog-id="prompt-001">
    <p>What is the main idea of this passage?</p>
  </div>
</pie-prompt>

<!-- Answer choices with catalog references -->
<pie-choices>
  <pie-choice value="A" data-catalog-id="choice-001-A">
    Plants need sunlight to grow
  </pie-choice>
  <pie-choice value="B" data-catalog-id="choice-001-B">
    Water is essential for life
  </pie-choice>
</pie-choices>

<!-- Passage/stimulus with catalog reference -->
<pie-stimulus>
  <div data-catalog-id="passage-photosynthesis">
    <p>Photosynthesis is the process by which...</p>
  </div>
</pie-stimulus>
```

### Multi-Level Catalog Support

```typescript
// Assessment-level catalog (shared across items)
const assessment = {
  accessibilityCatalogs: [
    {
      identifier: 'shared-passage-001',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>...' },
        { catalog: 'braille', language: 'en', content: '⠠⠏⠓⠕⠞⠕...' }
      ]
    }
  ]
};

// Item-level catalog (item-specific)
const item = {
  accessibilityCatalogs: [
    {
      identifier: 'prompt-photo-001',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>...' },
        { catalog: 'simplified-language', language: 'en', content: 'What do plants need?' }
      ]
    }
  ],
  markup: `
    <pie-stimulus>
      <!-- References assessment-level catalog -->
      <div data-catalog-id="shared-passage-001">...</div>
    </pie-stimulus>
    <pie-prompt>
      <!-- References item-level catalog -->
      <div data-catalog-id="prompt-photo-001">...</div>
    </pie-prompt>
  `
};
```

**Resolution Priority:** Item-level catalogs override assessment-level for same identifier.

---

## TTSService Integration

### Catalog-Aware TTS

Extend `TTSService` to use accessibility catalogs for spoken content:

```typescript
// packages/assessment-toolkit/src/services/TTSService.ts

export class TTSService implements ITTSService {
  private catalogResolver?: AccessibilityCatalogResolver;

  /**
   * Set the accessibility catalog resolver
   */
  setCatalogResolver(resolver: AccessibilityCatalogResolver): void {
    this.catalogResolver = resolver;
  }

  /**
   * Enhanced speak method with catalog support
   */
  async speak(text: string, options?: { catalogId?: string; language?: string }): Promise<void> {
    let contentToSpeak = text;

    // Try to resolve from catalog first
    if (options?.catalogId && this.catalogResolver) {
      const alternative = this.catalogResolver.getAlternative(options.catalogId, {
        type: 'spoken',
        language: options.language,
        useFallback: true
      });

      if (alternative) {
        contentToSpeak = alternative.content;
        console.debug(`[TTS] Using spoken catalog: ${options.catalogId}`);
      }
    }

    // Speak the content (either from catalog or fallback to original text)
    return this.speakText(contentToSpeak);
  }

  /**
   * Enhanced speakRange method with catalog support
   */
  async speakRange(range: Range, options?: { language?: string }): Promise<void> {
    // Check if the range contains an element with data-catalog-id
    const element = range.commonAncestorContainer as Element;
    const catalogElement = element.closest?.('[data-catalog-id]') as HTMLElement;

    if (catalogElement) {
      const catalogId = catalogElement.getAttribute('data-catalog-id');
      if (catalogId) {
        // Use catalog version
        return this.speak(range.toString(), { catalogId, language: options?.language });
      }
    }

    // Fallback to regular TTS
    const text = range.toString();
    return this.speakText(text);
  }
}
```

### Integration with PNP

> **Note:** `AssessmentPlayer` does not exist as a class. Integration is through the section player custom elements (`pie-section-player-splitpane`) and `ToolkitCoordinator`. The example below is conceptual pseudocode illustrating the pattern.

```typescript
// Conceptual example — actual integration uses ToolkitCoordinator + section player custom elements
class AssessmentPlayer {
  private initializeTTS() {
    this.services.ttsService.setCatalogResolver(this.catalogResolver);
  }

  private applyPersonalNeedsProfile(profile: PersonalNeedsProfile) {
    if (profile.supports.includes('textToSpeech')) {
      // TTS is now catalog-aware automatically
      this.services.ttsService.initialize(new BrowserTTSProvider());
    }
  }
}
```

---

## Section Player Integration

The **PIE Section Player** is the primary interface for integrating accessibility catalogs with the assessment toolkit.

### Complete Integration Example

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

// Initialize catalog resolver with assessment-level catalogs
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs || [],
  'en-US'
);

// Initialize TTS with a provider
await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);
ttsService.setHighlightCoordinator(highlightCoordinator);

// Pass services to section player (JavaScript properties, NOT HTML attributes)
const sectionPlayer = document.getElementById('section-player');
sectionPlayer.ttsService = ttsService;
sectionPlayer.toolCoordinator = toolCoordinator;
sectionPlayer.highlightCoordinator = highlightCoordinator;
sectionPlayer.catalogResolver = catalogResolver;

// Set section data
sectionPlayer.section = section;

// The section player now automatically:
// - Extracts SSML from embedded <speak> tags
// - Generates catalog entries with unique IDs
// - Manages item-level catalog lifecycle (add on load, clear on navigation)
// - Renders TTS tools inline in passage/item headers
// - Resolves catalogs with priority: extracted > item > assessment
```

### What Happens Automatically

When you pass the `catalogResolver` to the section player:

1. **SSML Extraction**: The section player scans passages and items for embedded `<speak>` tags
2. **Catalog Generation**: Auto-generates QTI 3.0 catalog entries with IDs like `auto-prompt-q1-0`
3. **Lifecycle Management**: Adds item catalogs on load, clears them on navigation
4. **TTS Tool Rendering**: Shows inline TTS buttons when `ttsService` is provided
5. **Catalog Resolution**: Uses extracted catalogs first, then item catalogs, then assessment catalogs

**You don't need to manually manage catalog lifecycle** - the section player handles it.

---

## PIE Element Authoring

### Consuming Catalogs in PIE Elements

PIE element developers can access catalogs through the player context:

```typescript
// Example PIE element controller
import type { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

export class MultipleChoiceController {
  model(question: Question, session: Session, env: Environment) {
    const catalogResolver = env.catalogResolver as AccessibilityCatalogResolver;

    // Enhance prompt with catalog metadata
    if (question.prompt && catalogResolver) {
      const promptElement = question.prompt as any;
      const catalogId = promptElement.catalogId || this.extractCatalogId(promptElement.text);

      if (catalogId && catalogResolver.hasCatalog(catalogId)) {
        // Get available alternatives
        const alternatives = catalogResolver.getAllAlternatives(catalogId);

        promptElement.accessibilityAlternatives = alternatives.map(alt => ({
          type: alt.type,
          language: alt.language,
          available: true
        }));
      }
    }

    return question;
  }

  private extractCatalogId(html: string): string | null {
    const match = html.match(/data-catalog-id=["']([^"']+)["']/);
    return match ? match[1] : null;
  }
}
```

### React Component Example

```typescript
// Example PIE element React component
import React, { useState, useEffect } from 'react';

export const AccessiblePrompt: React.FC<{ content: string; catalogId?: string }> = ({
  content,
  catalogId
}) => {
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const catalogResolver = useCatalogResolver(); // Custom hook to access resolver

  useEffect(() => {
    if (catalogId && catalogResolver) {
      const alts = catalogResolver.getAllAlternatives(catalogId);
      setAlternatives(alts.map(a => a.type));
    }
  }, [catalogId, catalogResolver]);

  return (
    <div data-catalog-id={catalogId} className="accessible-prompt">
      <div dangerouslySetInnerHTML={{ __html: content }} />

      {alternatives.length > 0 && (
        <div className="a11y-indicators" aria-hidden="true">
          <span title={`Available in: ${alternatives.join(', ')}`}>
            <AccessibilityIcon />
          </span>
        </div>
      )}
    </div>
  );
};
```

---

## Usage Examples

### Example 1: Basic TTS with Catalogs

> **Note:** `AssessmentPlayer` does not exist as a class. Integration is through the section player custom elements and `ToolkitCoordinator`. This example is conceptual pseudocode.

```typescript
import { AssessmentPlayer } from '@pie-players/pie-assessment-toolkit';

const player = new AssessmentPlayer({
  assessment: {
    // Assessment has spoken catalogs
    accessibilityCatalogs: [
      {
        identifier: 'intro-passage',
        cards: [
          {
            catalog: 'spoken',
            language: 'en-US',
            content: '<speak><prosody rate="medium">Welcome to the test...</prosody></speak>'
          }
        ]
      }
    ],
    personalNeedsProfile: {
      supports: ['textToSpeech'],
      activateAtInit: ['textToSpeech']
    }
  },
  loadItem: async (id) => fetchItem(id)
});

// TTS automatically uses catalog when speaking elements with data-catalog-id
await player.render(container);
```

### Example 2: Multi-Language Support

```typescript
const resolver = new AccessibilityCatalogResolver(
  [
    {
      identifier: 'welcome-message',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>Welcome...</speak>' },
        { catalog: 'spoken', language: 'es-ES', content: '<speak>Bienvenido...</speak>' },
        { catalog: 'spoken', language: 'fr-FR', content: '<speak>Bienvenue...</speak>' }
      ]
    }
  ],
  'en-US' // Default language
);

// Get English version
const english = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'en-US'
});

// Get Spanish version
const spanish = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'es-ES'
});

// Fallback to default if language not available
const german = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'de-DE', // Not available
  useFallback: true  // Falls back to 'en-US'
});
```

## Best Practices

### Content Authoring

1. **Catalog Identifiers:**
   - Use descriptive, hierarchical IDs: `prompt-item-001`, `choice-item-001-A`
   - Keep consistent naming across items
   - Prefix shared catalogs: `shared-passage-photosynthesis`

2. **SSML for Spoken Content:**
   ```xml
   <speak>
     <prosody rate="medium" pitch="medium">
       This is the main content.
       <break time="500ms"/>
       Use breaks for pacing.
       <emphasis level="strong">Emphasize</emphasis> important words.
     </prosody>
   </speak>
   ```

3. **Multi-Language Support:**
   - Provide language codes: `en-US`, `es-ES`, `fr-FR`
   - Always include a default language version
   - Use regional variants when pronunciation differs

4. **Braille Guidelines:**
   - Use appropriate braille codes (Nemeth for math, UEB for text)
   - Test with actual braille displays if possible
   - Provide both contracted and uncontracted versions if needed

5. **Simplified Language:**
   - Use short sentences (5-10 words)
   - Avoid complex vocabulary
   - Use bullet points and lists
   - Include visual supports (icons, images)

### Performance

1. **Lazy Loading:**
   - Don't load all catalogs at once
   - Load item-level catalogs on demand
   - Clear item catalogs when navigating away

2. **Caching:**
   - Cache resolved catalogs to avoid repeated lookups
   - Use browser cache for external resources (videos, audio)

3. **Fallback Strategy:**
   - Always have a fallback to default content
   - Use `useFallback: true` for critical content
   - Log when catalogs are missing (for content QA)

### Accessibility

1. **Indicate Alternative Availability:**
   ```html
   <div data-catalog-id="prompt-001" class="has-alternatives">
     <span class="a11y-badge" aria-label="Available in multiple formats">
       <AccessibilityIcon />
     </span>
     Regular content here...
   </div>
   ```

2. **User Control:**
   - Let users choose their preferred format
   - Remember preferences across sessions
   - Provide easy toggles between formats

3. **Testing:**
   - Test with actual assistive technologies
   - Validate SSML markup
   - Check braille output with users
   - Test video captions and transcripts

---

## References

- [QTI 3.0 Feature Support](./qti-3.0-feature-support.md)
- [APIP Specification](https://www.imsglobal.org/apip) - IMS Global APIP standard
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Nemeth Braille Code](http://www.brailleauthority.org/nemeth/nemeth.pdf)

---

**Last Updated:** January 28, 2026
