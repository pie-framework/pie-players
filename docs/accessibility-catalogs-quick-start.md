# Accessibility Catalogs - Quick Start Guide

**For:** Developers integrating QTI 3.0 accessibility catalogs
**Time to read:** 5 minutes
**Date:** January 2026

---

## What Are Accessibility Catalogs?

QTI 3.0 accessibility catalogs provide alternative representations of content for assistive technologies:

- **Spoken** - Pre-authored TTS scripts (better than generated speech)
- **Sign Language** - Video URLs for signed content
- **Braille** - Braille-ready transcriptions
- **Simplified Language** - Plain language alternatives for cognitive accessibility
- **Tactile/Extended Descriptions** - For complex diagrams/images

---

## 5-Minute Setup

### 1. Import the Service

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';
```

### 2. Create Assessment with Catalogs

```typescript
const assessment = {
  id: 'my-assessment',
  title: 'My Assessment',

  // Define accessibility catalogs
  accessibilityCatalogs: [
    {
      identifier: 'welcome-message',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak><prosody rate="medium">Welcome to the test!</prosody></speak>'
        },
        {
          catalog: 'simplified-language',
          language: 'en',
          content: 'Welcome! This is a test.'
        }
      ]
    }
  ],

  testParts: [/* ... */]
};
```

### 3. Initialize the Resolver

```typescript
// Initialize with assessment catalogs
const resolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US' // default language
);
```

### 4. Resolve Alternatives

```typescript
// Get spoken version
const spoken = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'en-US'
});

if (spoken) {
  console.log(spoken.content); // SSML content
  console.log(spoken.source);  // 'assessment'
}

// Get simplified language version
const simplified = resolver.getAlternative('welcome-message', {
  type: 'simplified-language',
  useFallback: true // Fall back to default language if needed
});
```

---

## Common Patterns

### Pattern 1: Assessment-Level Catalogs (Shared Content)

Use for content shared across multiple items:

```typescript
// Assessment definition
{
  accessibilityCatalogs: [
    {
      identifier: 'shared-passage-1',
      cards: [
        { catalog: 'spoken', content: '...' },
        { catalog: 'braille', content: '...' }
      ]
    }
  ]
}

// Item markup references the catalog
<pie-stimulus>
  <div data-catalog-id="shared-passage-1">
    <p>Photosynthesis is the process...</p>
  </div>
</pie-stimulus>
```

### Pattern 2: Item-Level Catalogs (Item-Specific)

Use for item-specific content like prompts and choices:

```typescript
// Item definition
{
  id: 'item-001',
  accessibilityCatalogs: [
    {
      identifier: 'prompt-001',
      cards: [
        { catalog: 'spoken', content: '<speak>What is 2 + 2?</speak>' },
        { catalog: 'simplified-language', content: 'Add 2 and 2. What do you get?' }
      ]
    },
    {
      identifier: 'choice-A',
      cards: [
        { catalog: 'spoken', content: '<speak>Choice A: Four</speak>' }
      ]
    }
  ],
  markup: `
    <pie-prompt>
      <div data-catalog-id="prompt-001">What is 2 + 2?</div>
    </pie-prompt>
    <pie-choices>
      <pie-choice value="A" data-catalog-id="choice-A">4</pie-choice>
    </pie-choices>
  `
}
```

### Pattern 3: Multi-Language Support

```typescript
{
  identifier: 'greeting',
  cards: [
    { catalog: 'spoken', language: 'en-US', content: '<speak>Hello</speak>' },
    { catalog: 'spoken', language: 'es-ES', content: '<speak>Hola</speak>' },
    { catalog: 'spoken', language: 'fr-FR', content: '<speak>Bonjour</speak>' }
  ]
}

// Get Spanish version
const spanish = resolver.getAlternative('greeting', {
  type: 'spoken',
  language: 'es-ES'
});

// Fallback to default if language not available
const german = resolver.getAlternative('greeting', {
  type: 'spoken',
  language: 'de-DE',     // Not available
  useFallback: true       // Falls back to en-US
});
```

---

## Integration with AssessmentPlayer

### Basic Setup

```typescript
import { AssessmentPlayer, AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

class MyPlayer extends AssessmentPlayer {
  private catalogResolver: AccessibilityCatalogResolver;

  constructor(config) {
    super(config);

    // Initialize resolver with assessment catalogs
    this.catalogResolver = new AccessibilityCatalogResolver(
      config.assessment.accessibilityCatalogs,
      config.locale || 'en'
    );

    // Pass to TTS service
    this.services.ttsService.setCatalogResolver(this.catalogResolver);
  }

  protected async loadItemContent(itemRef) {
    const item = await super.loadItemContent(itemRef);

    // Add item-level catalogs
    if (item.accessibilityCatalogs) {
      this.catalogResolver.addItemCatalogs(item.accessibilityCatalogs);
    }

    return item;
  }

  protected async navigateToItem(index) {
    // Clear previous item's catalogs
    this.catalogResolver.clearItemCatalogs();

    // Navigate (will load new item with its catalogs)
    await super.navigateToItem(index);
  }
}
```

### Expose to PIE Elements

```typescript
async render(container: HTMLElement) {
  const pieContext = {
    ...this.getPieContext(),
    catalogResolver: this.catalogResolver  // Add resolver to context
  };

  await piePlayer.render({ item, session, context: pieContext });
}
```

---

## Integration with TTSService

### Phase 2 Implementation (Coming Soon)

```typescript
import { TTSService } from '@pie-players/pie-assessment-toolkit';

const ttsService = new TTSService();

// Set catalog resolver
ttsService.setCatalogResolver(catalogResolver);

// Speak with catalog support
await ttsService.speak('Hello world', {
  catalogId: 'welcome-message',
  language: 'en-US'
});
// If catalog found: Uses pre-authored SSML
// If catalog not found: Falls back to generated TTS

// Auto-detect from DOM element
const element = document.querySelector('[data-catalog-id]');
await ttsService.speakElement(element);
// Automatically uses catalog if data-catalog-id present
```

---

## Utility Functions

### Check if Catalog Exists

```typescript
if (resolver.hasCatalog('prompt-001')) {
  // Catalog exists
}
```

### Get All Alternatives for a Catalog

```typescript
const alternatives = resolver.getAllAlternatives('welcome-message');
// Returns: [
//   { catalogId, type: 'spoken', language: 'en-US', content: '...', source: 'assessment' },
//   { catalogId, type: 'simplified-language', language: 'en', content: '...', source: 'assessment' }
// ]
```

### Get Catalog Statistics

```typescript
const stats = resolver.getStatistics();
console.log(stats);
// {
//   totalCatalogs: 5,
//   assessmentCatalogs: 2,
//   itemCatalogs: 3,
//   availableTypes: Set(['spoken', 'braille', 'simplified-language']),
//   availableLanguages: Set(['en-US', 'es-ES'])
// }
```

### Find Catalogs by Type

```typescript
// Get all catalog IDs that have spoken alternatives
const spokenCatalogs = resolver.getCatalogsByType('spoken');
// Returns: ['welcome-message', 'prompt-001', 'choice-A']
```

### Extract Catalog IDs from Markup

```typescript
import { extractCatalogIdsFromMarkup } from '@pie-players/pie-assessment-toolkit/examples';

const markup = `
  <pie-prompt>
    <div data-catalog-id="prompt-001">Question text</div>
  </pie-prompt>
  <pie-choices>
    <pie-choice data-catalog-id="choice-A">Choice A</pie-choice>
    <pie-choice data-catalog-id="choice-B">Choice B</pie-choice>
  </pie-choices>
`;

const catalogIds = extractCatalogIdsFromMarkup(markup);
// Returns: ['prompt-001', 'choice-A', 'choice-B']
```

---

## Catalog Priority Rules

**Question:** What happens if both assessment and item define the same catalog ID?

**Answer:** Item-level **always wins** (higher precedence).

```typescript
// Assessment defines 'message-1'
assessment.accessibilityCatalogs = [
  {
    identifier: 'message-1',
    cards: [{ catalog: 'spoken', content: 'Assessment version' }]
  }
];

// Item also defines 'message-1'
item.accessibilityCatalogs = [
  {
    identifier: 'message-1',
    cards: [{ catalog: 'spoken', content: 'Item version' }]
  }
];

// Result: Item version is used
const result = resolver.getAlternative('message-1', { type: 'spoken' });
console.log(result.content); // 'Item version'
console.log(result.source);  // 'item'
```

**Why?** Most specific wins. Item-level is more specific than assessment-level.

---

## SSML Tips

### Basic SSML Structure

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

### Common SSML Tags

```xml
<!-- Pause -->
<break time="500ms"/>
<break time="1s"/>

<!-- Emphasis -->
<emphasis level="strong">Important word</emphasis>
<emphasis level="moderate">Somewhat important</emphasis>

<!-- Speed/Pitch -->
<prosody rate="slow">Speak slowly</prosody>
<prosody rate="fast">Speak quickly</prosody>
<prosody pitch="high">Higher pitch</prosody>
<prosody pitch="low">Lower pitch</prosody>

<!-- Say as (numbers, dates, etc.) -->
<say-as interpret-as="cardinal">123</say-as>  <!-- one hundred twenty-three -->
<say-as interpret-as="ordinal">1</say-as>     <!-- first -->
<say-as interpret-as="date" format="mdy">12/25/2025</say-as>
```

---

## Braille Tips

### Nemeth Braille (Math)

```typescript
{
  catalog: 'braille',
  content: '⠼⠆⠭⠬⠼⠑⠀⠨⠅⠀⠼⠁⠛'  // 2x + 5 = 17
}
```

### Unified English Braille (Text)

```typescript
{
  catalog: 'braille',
  content: '⠠⠓⠑⠇⠇⠕⠀⠺⠕⠗⠇⠙'  // Hello world
}
```

**Resources:**
- [Nemeth Code](http://www.brailleauthority.org/nemeth/nemeth.pdf)
- [UEB Guidelines](http://www.brailleauthority.org/ueb.html)

---

## Testing

### Unit Testing

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

describe('AccessibilityCatalogResolver', () => {
  it('should resolve spoken catalog', () => {
    const resolver = new AccessibilityCatalogResolver([
      {
        identifier: 'test-1',
        cards: [
          { catalog: 'spoken', language: 'en-US', content: 'Hello' }
        ]
      }
    ]);

    const result = resolver.getAlternative('test-1', { type: 'spoken' });

    expect(result).toBeTruthy();
    expect(result?.content).toBe('Hello');
    expect(result?.source).toBe('assessment');
  });

  it('should prioritize item-level over assessment-level', () => {
    const resolver = new AccessibilityCatalogResolver([
      { identifier: 'test', cards: [{ catalog: 'spoken', content: 'Assessment' }] }
    ]);

    resolver.addItemCatalogs([
      { identifier: 'test', cards: [{ catalog: 'spoken', content: 'Item' }] }
    ]);

    const result = resolver.getAlternative('test', { type: 'spoken' });
    expect(result?.content).toBe('Item');
    expect(result?.source).toBe('item');
  });
});
```

---

## Examples

### Complete Working Example

See [accessibility-catalog-examples.ts](../apps/example/src/lib/accessibility-catalog-examples.ts) for:

- ✅ Assessment with shared catalogs
- ✅ Items with item-specific catalogs
- ✅ All catalog types (spoken, braille, simplified, sign-language, tactile)
- ✅ Multi-language examples
- ✅ Math items with Nemeth braille
- ✅ Science items with tactile diagrams

---

## Next Steps

1. **Read the full guide:** [Integration Guide](./accessibility-catalogs-integration-guide.md)
2. **Review examples:** [Examples](../apps/example/src/lib/accessibility-catalog-examples.ts)
3. **Check implementation plan:** [Roadmap](./accessibility-catalogs-implementation-roadmap.md)
4. **Start coding!** The service is ready to use.

---

## Common Questions

### Q: Do I need to provide all catalog types?

**A:** No. Provide what makes sense for your content. The resolver gracefully handles missing catalogs.

### Q: What if a catalog isn't found?

**A:** `getAlternative()` returns `null`. Your code should fall back to default rendering.

### Q: Can I use custom catalog types?

**A:** Yes! The `CatalogType` is `string`, so you can use any type identifier. Just document your custom types.

### Q: How do I handle video URLs for sign language?

**A:** Store the URL in `content` field:
```typescript
{ catalog: 'sign-language', language: 'en-US', content: 'https://cdn.example.com/video.mp4' }
```

### Q: Can I update catalogs at runtime?

**A:** Yes for item-level (use `addItemCatalogs()`). Assessment-level catalogs are set at initialization.

---

## Performance Tips

1. **Lazy Loading:** Only load item catalogs when needed
2. **Caching:** Resolver caches lookups internally
3. **Cleanup:** Always call `clearItemCatalogs()` when navigating away
4. **Statistics:** Use `getStatistics()` to understand catalog usage

---

## Get Help

- **API Docs:** See [AccessibilityCatalogResolver.ts](../packages/assessment-toolkit/src/services/AccessibilityCatalogResolver.ts)
- **Integration Guide:** [accessibility-catalogs-integration-guide.md](./accessibility-catalogs-integration-guide.md)
- **Examples:** [accessibility-catalog-examples.ts](../apps/example/src/lib/accessibility-catalog-examples.ts)

---

**Happy coding! 🎉**
