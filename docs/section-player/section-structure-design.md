# PIE Section Structure Design

**Date**: 2026-02-05
**Status**: Final Design

---

## Summary

We've designed a **QTI-aligned section structure using PIE entities** that balances QTI 3.0 concepts with PIE's native approach.

### Key Principles

1. **QTI-aligned structure** - Use `rubricBlocks` and `assessmentItemRefs`
2. **PIE-native entities** - Store `PassageEntity` and `ItemEntity`, not HTML strings
3. **No loading logic** - Player receives fully resolved entities (client handles loading)
4. **Simplified** - Removed unused fields (`stimulusRef`, `href`, etc.)

---

## Core Types

### AssessmentSection

```typescript
export interface AssessmentSection {
  identifier: string;
  title?: string;
  keepTogether?: boolean;  // true = page mode, false = item mode
  visible?: boolean;
  required?: boolean;

  // Content (QTI structure)
  rubricBlocks?: RubricBlock[];
  assessmentItemRefs?: AssessmentItemRef[];

  // Nested sections (QTI 3.0 supports recursive sections)
  sections?: AssessmentSection[];

  // PIE settings
  settings?: SettingsMetaData;
}
```

### RubricBlock (Simplified)

```typescript
export interface RubricBlock {
  identifier?: string;
  view: 'candidate' | 'scorer' | 'author' | 'proctor' | 'testConstructor' | 'tutor';
  class?: 'stimulus' | 'instructions' | 'rubric';

  /**
   * Embedded passage entity (PIE-native).
   * Contains a PIE config with markup, elements, and models.
   * Rendered using ItemPlayer infrastructure.
   */
  passage?: PassageEntity;
}
```

**Changes from before:**
- ✅ Kept `content?: string` (HTML string)
- ❌ Removed `stimulusRef?: StimulusRef` (external reference)
- ✅ Added `passage?: PassageEntity` (embedded PIE entity)

### AssessmentItemRef (Simplified)

```typescript
export interface AssessmentItemRef {
  id?: string;
  identifier: string;
  itemVId?: string;
  title?: string;
  required?: boolean;

  /**
   * Resolved item entity with PIE config.
   * Populated by client before passing to player.
   */
  item?: ItemEntity;

  /** Item-level settings for tools and customization */
  settings?: ItemSettings;
}
```

**Changes from before:**
- ✅ Kept `itemVId?: string` (backend-specific)
- ❌ Removed `href?: string` (external reference)
- ❌ Removed `fixed?: boolean` (unused)
- ❌ Removed `weight?: number` (scoring logic, not rendering)
- ✅ Kept `item?: ItemEntity` (embedded PIE entity)

---

## Example: Paired Passages Page

```json
{
  "identifier": "paired-passages-page-1",
  "title": "Urban Gardens: Different Perspectives",
  "keepTogether": true,

  "rubricBlocks": [
    {
      "identifier": "rb-instructions",
      "view": "candidate",
      "class": "instructions",
      "passage": {
        "id": "instructions-001",
        "name": "Directions",
        "baseId": "instructions-001",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<reading-passage id='inst'></reading-passage>",
          "elements": {
            "reading-passage": "@pie-element/reading-passage@latest"
          },
          "models": [{
            "id": "inst",
            "element": "reading-passage",
            "content": "<div class='instructions'><h3>Directions</h3><p>Read both passages...</p></div>"
          }]
        }
      }
    },
    {
      "identifier": "rb-passage-benefits",
      "view": "candidate",
      "class": "stimulus",
      "passage": {
        "id": "passage-benefits",
        "name": "The Benefits of Urban Gardening",
        "baseId": "passage-benefits",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<reading-passage id='p1'></reading-passage>",
          "elements": {
            "reading-passage": "@pie-element/reading-passage@latest"
          },
          "models": [{
            "id": "p1",
            "element": "reading-passage",
            "title": "The Benefits of Urban Gardening",
            "content": "<h2>The Benefits of Urban Gardening</h2><p>When empty lots transform...</p>"
          }]
        }
      }
    },
    {
      "identifier": "rb-passage-challenges",
      "view": "candidate",
      "class": "stimulus",
      "passage": {
        "id": "passage-challenges",
        "name": "Urban Gardens: Challenges and Limitations",
        "baseId": "passage-challenges",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<reading-passage id='p2'></reading-passage>",
          "elements": {
            "reading-passage": "@pie-element/reading-passage@latest"
          },
          "models": [{
            "id": "p2",
            "element": "reading-passage",
            "title": "Urban Gardens: Challenges and Limitations",
            "content": "<h2>Urban Gardens: Challenges...</h2><p>While urban gardens have gained...</p>"
          }]
        }
      }
    }
  ],

  "assessmentItemRefs": [
    {
      "identifier": "q1-main-idea",
      "title": "Question 1",
      "required": true,
      "item": {
        "id": "item-001",
        "name": "Question 1: Main Idea",
        "baseId": "item-001",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<multiple-choice id='q1'></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [{
            "id": "q1",
            "element": "multiple-choice",
            "prompt": "<p><strong>Question 1:</strong> What is the main idea of Passage 1?</p>",
            "choiceMode": "radio",
            "choices": [
              {
                "label": "A",
                "value": "choice-a",
                "content": "<p>Urban gardens help reduce flooding in cities.</p>",
                "correct": false
              },
              {
                "label": "B",
                "value": "choice-b",
                "content": "<p>Urban gardens improve neighborhoods in multiple important ways.</p>",
                "correct": true
              }
            ]
          }]
        }
      }
    },
    {
      "identifier": "q2-author-purpose",
      "title": "Question 2",
      "required": true,
      "item": {
        "id": "item-002",
        "name": "Question 2: Author's Purpose",
        "config": { "..." }
      }
    }
  ],

  "settings": {
    "layout": {
      "passagesDisplay": "tabs",
      "resizable": true
    }
  }
}
```

---

## Example: Single Item with Passage (Legacy)

```json
{
  "identifier": "section-1",
  "keepTogether": false,

  "assessmentItemRefs": [
    {
      "identifier": "q1",
      "title": "Reading Comprehension",
      "required": true,
      "item": {
        "id": "item-001",
        "name": "Reading Comprehension",
        "passage": {
          "id": "passage-001",
          "name": "The Solar System",
          "config": {
            "markup": "<reading-passage id='p'></reading-passage>",
            "elements": {
              "reading-passage": "@pie-element/reading-passage@latest"
            },
            "models": [{ "..." }]
          }
        },
        "config": {
          "markup": "<multiple-choice id='q'></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [{ "..." }]
        }
      }
    }
  ]
}
```

---

## SectionPlayer Usage

```typescript
class SectionPlayer {
  constructor(config: SectionPlayerConfig) {
    // Section already has fully resolved passages and items
    // No loading needed!
  }

  private getPassages(): PassageEntity[] {
    const passages: PassageEntity[] = [];

    // Extract passages from rubricBlocks
    for (const rb of this.section.rubricBlocks || []) {
      if (rb.passage && rb.view === 'candidate') {
        passages.push(rb.passage);
      }
    }

    // Also extract item-linked passages
    for (const itemRef of this.section.assessmentItemRefs || []) {
      if (itemRef.item?.passage && typeof itemRef.item.passage === 'object') {
        // Deduplicate by ID
        if (!passages.find(p => p.id === itemRef.item.passage.id)) {
          passages.push(itemRef.item.passage);
        }
      }
    }

    return passages;
  }

  private getItems(): ItemEntity[] {
    return (this.section.assessmentItemRefs || [])
      .map(ref => ref.item)
      .filter(item => item !== undefined) as ItemEntity[];
  }

  private createPassagePlayer(passage: PassageEntity): HTMLElement {
    const player = document.createElement('pie-esm-player');
    player.setAttribute('config', JSON.stringify(passage.config));
    player.setAttribute('env', JSON.stringify({ mode: 'view' }));
    return player;
  }

  private createItemPlayer(item: ItemEntity): HTMLElement {
    const player = document.createElement('pie-esm-player');
    player.setAttribute('config', JSON.stringify(item.config));
    player.setAttribute('env', JSON.stringify({ mode: this.mode }));
    return player;
  }
}
```

---

## Benefits of This Design

✅ **QTI-aligned** - Uses `rubricBlocks` and `assessmentItemRefs` structure
✅ **PIE-native** - Stores `PassageEntity` and `ItemEntity` with PIE configs
✅ **Semantic** - QTI's `view` and `class` attributes preserved
✅ **Uniform rendering** - Passages and items both use ItemPlayer
✅ **No loading** - Client resolves entities, player just renders
✅ **Simplified** - Removed unused/external reference fields
✅ **Flexible** - Supports section-level passages AND item-linked passages
✅ **Exportable** - Can map back to QTI XML if needed

---

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Passage storage | `content: string` (HTML) | `passage: PassageEntity` (PIE config) |
| External refs | `stimulusRef` supported | Removed - always embed |
| Item refs | `itemVId`, `href`, etc. | Simplified - just `identifier` + `item` |
| Rendering | Parse HTML string | Use ItemPlayer |
| Loading | IDs → fetch → resolve | Client resolves, player renders |
| QTI alignment | Structure only | Structure + semantics |

---

## Migration Path

### From Old Format

If you have old assessments with `content: string`:

```typescript
// Old format (HTML string)
{
  rubricBlocks: [
    {
      view: 'candidate',
      class: 'stimulus',
      content: '<div><h2>Title</h2><p>Content...</p></div>'
    }
  ]
}

// New format (PassageEntity)
{
  rubricBlocks: [
    {
      view: 'candidate',
      class: 'stimulus',
      passage: {
        id: 'passage-001',
        name: 'Title',
        config: {
          markup: '<reading-passage id="p"></reading-passage>',
          elements: { 'reading-passage': '@pie-element/reading-passage@latest' },
          models: [{
            id: 'p',
            element: 'reading-passage',
            content: '<div><h2>Title</h2><p>Content...</p></div>'
          }]
        }
      }
    }
  ]
}
```

---

## Status

- ✅ Types updated in `packages/players-shared/src/types/index.ts`
- ✅ Section-player implementation is active and iterating
- ✅ Example data has moved into `apps/section-demos`
- ✅ Documentation is maintained in canonical docs

---

## Related Documents

- [Demo Route](../../apps/section-demos/src/routes/demo/[[id]]/+page.svelte)
- [QTI 3.0 Feature Support](./qti-3.0-feature-support.md)
- [Paired Passages Design](./qti3-paired-passages-design.md)
- [Architecture](../architecture/architecture.md)
