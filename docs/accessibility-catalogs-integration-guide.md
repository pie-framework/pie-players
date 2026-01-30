# QTI 3.0 Accessibility Catalogs - Integration Guide

**Status:** Phase 2 Implementation
**Date:** January 2026
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration with PIE](#integration-with-pie)
4. [TTSService Integration](#ttsservice-integration)
5. [AssessmentPlayer Integration](#assessmentplayer-integration)
6. [PIE Element Authoring](#pie-element-authoring)
7. [Usage Examples](#usage-examples)
8. [Implementation Phases](#implementation-phases)
9. [Best Practices](#best-practices)

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
│                  AssessmentPlayer                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │     AccessibilityCatalogResolver                  │ │
│  │                                                   │ │
│  │  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │ Assessment-     │  │ Item-Level      │       │ │
│  │  │ Level Catalogs  │  │ Catalogs        │       │ │
│  │  │ (Shared)        │  │ (Per-Item)      │       │ │
│  │  └─────────────────┘  └─────────────────┘       │ │
│  │                                                   │ │
│  │  Priority: Item-level > Assessment-level         │ │
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

1. **Assessment Load**: Index assessment-level catalogs
2. **Item Render**: Add item-level catalogs (temporary, cleared on navigation)
3. **Content Request**: Resolve catalog by ID and type
4. **Service Integration**: Pass resolved content to appropriate service (TTS, video player, etc.)
5. **Fallback**: If catalog not found, use default rendering

---

## Integration with PIE

### Catalog References in PIE Markup

PIE items reference catalogs using the `data-catalog-id` attribute:

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

### Phase 1: Catalog-Aware TTS

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

```typescript
// When PNP activates TTS, automatically use catalogs
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

## AssessmentPlayer Integration

### Complete Integration Example

```typescript
// packages/assessment-toolkit/src/player/AssessmentPlayer.ts

import { AccessibilityCatalogResolver } from '../services/AccessibilityCatalogResolver';

export class AssessmentPlayer {
  private catalogResolver: AccessibilityCatalogResolver;

  constructor(config: AssessmentPlayerConfig) {
    // Initialize catalog resolver with assessment-level catalogs
    this.catalogResolver = new AccessibilityCatalogResolver(
      config.assessment.accessibilityCatalogs,
      config.locale || 'en'
    );

    // Pass resolver to services
    this.services.ttsService.setCatalogResolver(this.catalogResolver);
  }

  /**
   * Load item and add item-level catalogs
   */
  private async loadItemContent(itemRef: AssessmentItemRef): Promise<ItemEntity> {
    const item = await this.config.loadItem(itemRef.itemVId);

    // Add item-level catalogs to resolver
    if (item.accessibilityCatalogs) {
      this.catalogResolver.addItemCatalogs(item.accessibilityCatalogs);
      console.debug(`[Player] Added ${item.accessibilityCatalogs.length} item catalogs`);
    }

    return item;
  }

  /**
   * Clear item-level catalogs when navigating away
   */
  private async navigateToItem(index: number): Promise<void> {
    // Clear previous item's catalogs
    this.catalogResolver.clearItemCatalogs();

    // Load new item (which adds its catalogs)
    const itemRef = this.getCurrentItemRef();
    const item = await this.loadItemContent(itemRef);

    // Render item...
  }

  /**
   * Expose catalog resolver to PIE elements
   */
  async render(container: HTMLElement): Promise<void> {
    // Make catalog resolver available to PIE elements via context
    const pieContext = {
      ...this.getPieContext(),
      catalogResolver: this.catalogResolver
    };

    // Render with enhanced context
    await piePlayer.render({
      item: this.currentItem,
      session: this.currentSession,
      context: pieContext
    });
  }

  /**
   * Get statistics about available catalogs
   */
  getCatalogStatistics(): CatalogStatistics {
    return this.catalogResolver.getStatistics();
  }
}
```

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

### Example 3: Sign Language Video Integration

```typescript
// Custom sign language video player service
class SignLanguagePlayer {
  private catalogResolver: AccessibilityCatalogResolver;
  private videoElement: HTMLVideoElement;

  async showSignLanguage(catalogId: string, language: string = 'en-US'): Promise<void> {
    const alternative = this.catalogResolver.getAlternative(catalogId, {
      type: 'sign-language',
      language
    });

    if (alternative) {
      this.videoElement.src = alternative.content; // URL to video
      this.videoElement.play();
    }
  }
}

// Integration with player
class AssessmentPlayer {
  private signLanguagePlayer: SignLanguagePlayer;

  private initializeAccessibilityServices() {
    this.signLanguagePlayer.setCatalogResolver(this.catalogResolver);

    // Add UI toggle for sign language
    if (this.hasSignLanguageCatalogs()) {
      this.addSignLanguageToggle();
    }
  }

  private hasSignLanguageCatalogs(): boolean {
    const stats = this.catalogResolver.getStatistics();
    return stats.availableTypes.has('sign-language');
  }
}
```

### Example 4: Braille Integration

```typescript
// Braille renderer service
class BrailleRenderer {
  private catalogResolver: AccessibilityCatalogResolver;
  private brailleDisplay: BrailleDisplayDevice; // Hardware interface

  async renderBraille(catalogId: string): Promise<void> {
    const alternative = this.catalogResolver.getAlternative(catalogId, {
      type: 'braille',
      language: 'en' // Braille typically doesn't need regional variants
    });

    if (alternative) {
      // Send to refreshable braille display
      await this.brailleDisplay.write(alternative.content);
    }
  }

  async exportBraille(catalogId: string): Promise<string> {
    const alternative = this.catalogResolver.getAlternative(catalogId, {
      type: 'braille'
    });

    return alternative?.content || '';
  }
}
```

### Example 5: Simplified Language for Cognitive Accessibility

```typescript
// Content transformer service
class ContentTransformer {
  private catalogResolver: AccessibilityCatalogResolver;

  /**
   * Transform content to simplified language based on user preference
   */
  transformForUser(element: HTMLElement, userProfile: PersonalNeedsProfile): void {
    // Check if user needs simplified language
    const needsSimplified = userProfile.supports.includes('simplifiedLanguage');

    if (!needsSimplified) return;

    // Find all elements with catalog IDs
    const catalogElements = element.querySelectorAll('[data-catalog-id]');

    catalogElements.forEach(el => {
      const catalogId = el.getAttribute('data-catalog-id');
      if (!catalogId) return;

      // Try to get simplified version
      const simplified = this.catalogResolver.getAlternative(catalogId, {
        type: 'simplified-language',
        useFallback: false
      });

      if (simplified) {
        // Replace content with simplified version
        el.innerHTML = simplified.content;
        el.setAttribute('data-transformed', 'simplified');
      }
    });
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)

**Goals:**
- ✅ Create `AccessibilityCatalogResolver` service
- ✅ Define catalog types and interfaces
- ✅ Implement catalog indexing and lookup
- ✅ Add assessment-level and item-level support

**Deliverables:**
- `AccessibilityCatalogResolver.ts`
- Comprehensive examples file
- Unit tests for resolver

### Phase 2: TTS Integration (Weeks 2-3)

**Goals:**
- Extend `TTSService` with catalog support
- Auto-detect `data-catalog-id` in content
- Integrate with `speakRange()` for element-level TTS
- Add fallback to generated TTS if no catalog

**Deliverables:**
- Enhanced `TTSService.ts`
- Integration tests with catalog examples
- Documentation for TTS + catalogs

### Phase 3: AssessmentPlayer Integration (Week 3)

**Goals:**
- Initialize resolver in `AssessmentPlayer`
- Load item-level catalogs on navigation
- Clear catalogs when leaving items
- Expose resolver to PIE elements via context

**Deliverables:**
- Updated `AssessmentPlayer.ts`
- PIE context enhancement
- End-to-end demo

### Phase 4: Extended Catalog Types (Weeks 4-5)

**Goals:**
- Sign language video player integration
- Braille renderer (basic output)
- Simplified language content transformer
- UI indicators for available alternatives

**Deliverables:**
- `SignLanguagePlayer` service
- `BrailleRenderer` utility
- `ContentTransformer` service
- Accessibility indicators in UI

### Phase 5: Authoring Support (Week 6)

**Goals:**
- PIE element guidelines for catalogs
- Authoring tools/helpers
- Validation utilities
- Documentation for content authors

**Deliverables:**
- PIE element integration guide
- Catalog validation tool
- Authoring examples
- Best practices guide

---

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

## Next Steps

1. **Implement Phase 1** (Core Infrastructure) - See [AccessibilityCatalogResolver.ts](../packages/assessment-toolkit/src/services/AccessibilityCatalogResolver.ts)
2. **Review Examples** - See [accessibility-catalog-examples.ts](../apps/example/src/lib/accessibility-catalog-examples.ts)
3. **Integrate with TTSService** - Phase 2 task
4. **Update AssessmentPlayer** - Phase 3 task
5. **Build Extended Services** - Phase 4-5 tasks

---

## References

- [QTI 3.0 Feature Support](./qti-3.0-feature-support.md)
- [APIP Specification](https://www.imsglobal.org/apip) - IMS Global APIP standard
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Nemeth Braille Code](http://www.brailleauthority.org/nemeth/nemeth.pdf)

---

**Last Updated:** January 28, 2026
