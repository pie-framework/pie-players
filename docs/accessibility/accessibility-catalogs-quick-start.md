# Accessibility Catalogs - Quick Start Guide

---

See also:

- [`../wcag/readme.md`](../wcag/readme.md) for the WCAG reference library
- [`../wcag/wcag-2.2-aa-baseline.md`](../wcag/wcag-2.2-aa-baseline.md) for the criteria most likely to affect alternative content and TTS flows
- [`../wcag/project-surface-map.md`](../wcag/project-surface-map.md) for where these flows fit in the broader accessibility review surface

## What Are Accessibility Catalogs?

QTI 3.0 accessibility catalogs provide alternative representations of content for assistive technologies:

- **Spoken** - Pre-authored TTS scripts (better than generated speech)
- **Sign Language** - Video for signed content
- **Braille** - Braille-ready transcriptions
- **Simplified Language** - Plain language alternatives for cognitive accessibility
- **Tactile/Extended Descriptions** - For complex diagrams/images

**Spoken** and **sign language** have runtime consumers: `TTSService` for spoken,
and section-player's per-item media region for signed alternates (gated on the
`signLanguage` PNP support). The remaining types are declared and resolvable but
nothing renders them yet. See
[Sign Language (ASL) Support](../prds/sign-language-asl-support.md) for the
signing contract.

---

## 5-Minute Setup

This quick start shows the direct `AccessibilityCatalogResolver` API for tests,
content tooling, and custom hosts. Production section-player integrations should
wire catalogs through `ToolkitCoordinator` and the player `runtime` property;
see [Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md).

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

## Beyond the Basics

Four things this quick start does not cover, each documented in the
[Integration Guide](./accessibility-catalogs-integration-guide.md):

- **A card carries `content` *or* `payload`, never both.** Types a string cannot
  express — signing video, recorded audio — use the structured form.
  ([Card content](./accessibility-catalogs-integration-guide.md#card-content-string-or-payload))
- **One node can carry two `spoken` cards** in the same language: a reading script
  and a recording of it. Select between them with `form`.
  ([Script and recording](./accessibility-catalogs-integration-guide.md#two-cards-of-one-type-script-and-recording))
- **`data-tts-suppress` withholds content from read-aloud** without hiding it,
  for items where reading is the construct. It overrides both an authored card
  and the learner's PNP entitlement.
  ([Suppressing read-aloud](./accessibility-catalogs-integration-guide.md#suppressing-read-aloud))
- **Unknown catalog types are allowed but reported.** A mistyped `catalog` is
  stored and never resolved, so it is logged rather than left silent; use QTI's
  `ext:` prefix for deliberate vendor extensions.
  ([Supported types](./accessibility-catalogs-integration-guide.md#supported-catalog-types))

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

// Passage/rubric HTML references the catalog
const passageHtml = `
  <div data-catalog-idref="shared-passage-1">
    <p>Photosynthesis is the process...</p>
  </div>
`;
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
  config: {
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="prompt-001">What is 2 + 2?</div>',
        choices: [
          { value: 'a', label: '<span data-catalog-idref="choice-A">4</span>' }
        ]
      }
    ]
  }
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

## Integration with TTSService

Use `TTSService` with an `AccessibilityCatalogResolver` to prefer authored spoken content when available.

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
// Note: the actual method signature is ttsService.speak(text, { catalogId, contentElement }),
// not ttsService.speakElement(). Example:
const element = document.querySelector('[data-catalog-idref]');
const catalogId = element.getAttribute('data-catalog-idref');
await ttsService.speak(element.textContent, { catalogId, contentElement: element });
// Automatically uses catalog if catalogId resolves
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

### Extract Catalog IDs from Model HTML

```typescript
const model = {
  prompt: '<div data-catalog-idref="prompt-001">Question text</div>',
  choices: [
    { label: '<span data-catalog-idref="choice-A">Choice A</span>' },
    { label: '<span data-catalog-idref="choice-B">Choice B</span>' }
  ]
};

const html = [model.prompt, ...model.choices.map((choice) => choice.label)].join('');

const doc = new DOMParser().parseFromString(html, 'text/html');
const catalogIds = [...doc.querySelectorAll<HTMLElement>('[data-catalog-idref]')]
  .map((element) => element.getAttribute('data-catalog-idref'))
  .filter((catalogId): catalogId is string => Boolean(catalogId));
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

See the examples in this guide and in [accessibility-catalogs-integration-guide.md](./accessibility-catalogs-integration-guide.md) for:

- ✅ Assessment with shared catalogs
- ✅ Items with item-specific catalogs
- ✅ All catalog types (spoken, braille, simplified, sign-language, tactile)
- ✅ Multi-language examples
- ✅ Math items with Nemeth braille
- ✅ Science items with tactile diagrams

---

## Common Questions

### Q: Do I need to provide all catalog types?

**A:** No. Provide what makes sense for your content. The resolver gracefully handles missing catalogs.

### Q: What if a catalog isn't found?

**A:** `getAlternative()` returns `null`. Your code should fall back to visible text or generated TTS.

### Q: Can I use custom catalog types?

**A:** Yes! The `CatalogType` is `string`, so you can use any type identifier. Just document your custom types.

### Q: How do I handle video URLs for sign language?

**A:** In `payload`, not `content`. A flat string cannot carry multiple sources,
MIME types, poster, or a time range, all of which QTI 3 expresses inside
`qti-card-entry` — so a signing card has no string form at all:

```typescript
{
  catalog: 'sign-language',
  language: 'ase',
  payload: {
    media: {
      version: 1,
      id: 'asl-prompt-1',
      kind: 'video',
      sources: [{ src: 'https://cdn.example.com/asl.mp4', type: 'video/mp4' }],
      poster: 'https://cdn.example.com/asl.jpg',
    },
    // Optional: a time slice, so one recording can serve several nodes.
    fragment: { startSeconds: 3, endSeconds: 11 },
  },
}
```

A card carries **either** `content` **or** `payload`, never both: `content` is
the string form for types a string can express (SSML for `spoken`), and `payload`
is the structured form for types it cannot. Nothing is mirrored between them, so
there is never a second copy to fall out of sync. Which one applies is decided by
`catalog` — QTI's `qti-card@support`, and the only discriminator — so the payload
carries no type tag of its own. A `sign-language` card with a bare URL in
`content` is malformed; it is reported and ignored rather than rendered.

Tag the card `language: 'ase'` (ISO 639-3 for American Sign Language) rather than
with a spoken-language code like `en-US`, matching QTI 3's `xml:lang` on the card
entry. The code is the language of the *adaptation*, so never derive it from the
item's content language — a Spanish item's signed alternate is LSM, not ASL.

The payload's optional `signLang` names the same thing and is worth authoring
only where the two differ: a card tagged with the item's content language
(`language: 'en-US'`, `signLang: 'ase'`) so resolution reaches it by the
default-language rung. Resolution selects on `language` alone; `signLang` is read
afterwards, for the region's accessible label and to refuse a card in a sign
language the learner did not ask for.

Section-player renders these in a per-item `data-region="media"` region when the
item carries a matching card **and** policy grants the `signLanguage` PNP
support. There is no cross-sign-language fallback: if ASL is requested and only
BSL exists, nothing renders rather than a language the learner may not follow.
`signLanguage` is deliberately excluded from the computed default profile, so it
has to be granted. See
[Sign Language (ASL) Support](../prds/sign-language-asl-support.md).

A signing video left in a prompt is *not* an alternative to a card. Nothing lifts
it out at render time, so it renders as ordinary content to every learner,
ungated. Signed alternates only ever arrive as catalog cards.

### Q: Can I update catalogs at runtime?

**A:** In section-player delivery, put item/model catalogs on the item payload
and let shell lifecycle register and unregister them. If you use
`AccessibilityCatalogResolver` directly, `addItemCatalogs()` and
`clearItemCatalogs()` are available for manual hosts and tests.

---

## Performance Tips

1. **Lazy Loading:** Only load item catalogs when needed
2. **Caching:** Resolver caches lookups internally
3. **Cleanup:** Section-player shell lifecycle cleans scoped registrations; direct resolver users should call `clearItemCatalogs()` when changing items
4. **Statistics:** Use `getStatistics()` to understand catalog usage

---

## Get Help

- **API Docs:** See [AccessibilityCatalogResolver.ts](../../packages/assessment-toolkit/src/services/AccessibilityCatalogResolver.ts)
- **Integration Guide:** [accessibility-catalogs-integration-guide.md](./accessibility-catalogs-integration-guide.md)
- **Examples:** [accessibility-catalogs-integration-guide.md](./accessibility-catalogs-integration-guide.md)
