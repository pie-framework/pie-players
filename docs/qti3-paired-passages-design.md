# QTI 3.0 Paired Passages Design

**Last Updated**: 2026-02-05

## Overview

This document describes how PIE Assessment Toolkit models paired passages and page-level rendering using QTI 3.0-aligned structures with PIE entities.

## Key Principles

1. **QTI-aligned structure**: Use `rubricBlocks` and `assessmentItemRefs` from QTI 3.0
2. **PIE-native entities**: Store `PassageEntity` and `ItemEntity` (not HTML strings or external references)
3. **Page = Section**: `QtiAssessmentSection` with `keepTogether: true` represents a page
4. **No loading logic**: Player receives fully resolved entities
5. **Uniform rendering**: Passages and items both use ItemPlayer infrastructure

## Data Model

### Page-Level Structure

A "page" in the assessment is represented as a `QtiAssessmentSection`:

```typescript
export interface QtiAssessmentSection {
  identifier: string;
  title?: string;
  keepTogether: boolean;  // true = page boundary

  // Passages/instructions for this page
  rubricBlocks?: RubricBlock[];

  // Items on this page
  questionRefs?: AssessmentItemRef[];

  // Optional settings for layout hints (PIE extension)
  settings?: {
    layout?: {
      stimulusDisplay?: 'tabs' | 'side-by-side';
      resizable?: boolean;
    };
  };
}
```

### Rubric Block (PIE Entity Approach)

```typescript
export interface RubricBlock {
  id?: string;
  view: "candidate" | "author" | "proctor" | "scorer" | "testConstructor" | "tutor";
  use?: "instructions" | "passage" | "rubric";

  // PIE entity with config (markup, elements, models)
  passage?: PassageEntity;

  // Optional settings for layout/display
  settings?: RubricBlockSettings;
}
```

**Note**: We store `PassageEntity` directly (not HTML strings or external references). The passage contains a PIE config and is rendered using the same ItemPlayer infrastructure as items.

## Implementation Approach (PIE-Native)

Passages are embedded as `PassageEntity` objects, making sections self-contained. Ideal for all assessment types.

```typescript
const page: QtiAssessmentSection = {
  identifier: 'paired-passages-page-1',
  keepTogether: true,

  rubricBlocks: [
    {
      id: 'passage-mountain-terrains',
      view: 'candidate',
      use: 'passage',
      passage: {
        id: 'passage-001',
        name: 'Mountain Terrains',
        baseId: 'passage-001',
        version: { major: 1, minor: 0, patch: 0 },
        config: {
          markup: '<reading-passage id="p1"></reading-passage>',
          elements: {
            'reading-passage': '@pie-element/reading-passage@latest'
          },
          models: [{
            id: 'p1',
            element: 'reading-passage',
            title: 'Mountain Terrains',
            content: '<div class="passage"><h2>Mountain Terrains</h2><p>Lorem ipsum...</p></div>'
          }]
        }
      },
      settings: {
        pairedPassage: { group: 'pair-1', order: 1, displayMode: 'tabs' }
      }
    },
    {
      id: 'passage-forests',
      view: 'candidate',
      use: 'passage',
      passage: {
        id: 'passage-002',
        name: 'Forests',
        baseId: 'passage-002',
        version: { major: 1, minor: 0, patch: 0 },
        config: {
          markup: '<reading-passage id="p2"></reading-passage>',
          elements: {
            'reading-passage': '@pie-element/reading-passage@latest'
          },
          models: [{
            id: 'p2',
            element: 'reading-passage',
            title: 'Forests',
            content: '<div class="passage"><h2>Forests</h2><p>Content about forests...</p></div>'
          }]
        }
      },
      settings: {
        pairedPassage: { group: 'pair-1', order: 2, displayMode: 'tabs' }
      }
    }
  ],

  assessmentItemRefs: [
    { identifier: 'q1', required: true, item: { /* ItemEntity */ } },
    { identifier: 'q2', required: true, item: { /* ItemEntity */ } },
    { identifier: 'q3', required: true, item: { /* ItemEntity */ } }
  ]
};
```

### Settings for Paired Passages

Use `RubricBlockSettings` for paired passage metadata:

```typescript
settings: {
  pairedPassage: {
    group: 'pair-1',           // Groups related passages
    order: 1,                  // Display order
    displayMode: 'tabs'        // tabs, side-by-side, stacked
  }
}
```

## Rendering

The SectionPlayer renders passages using the ItemPlayer infrastructure:

```typescript
class SectionPlayer {
  private createPassagePlayer(passage: PassageEntity): HTMLElement {
    const player = document.createElement('pie-esm-player');
    player.setAttribute('config', JSON.stringify(passage.config));
    player.setAttribute('env', JSON.stringify({ mode: 'view' }));
    return player;
  }

  private getAllPassages(): PassageEntity[] {
    const passages: PassageEntity[] = [];

    // Extract from rubricBlocks
    for (const rb of this.section.rubricBlocks || []) {
      if (rb.passage && rb.view === this.currentView) {
        passages.push(rb.passage);
      }
    }

    // Extract from item-linked passages
    for (const itemRef of this.section.assessmentItemRefs || []) {
      if (itemRef.item?.passage && typeof itemRef.item.passage === 'object') {
        // Deduplicate
        if (!passages.find(p => p.id === itemRef.item.passage.id)) {
          passages.push(itemRef.item.passage);
        }
      }
    }

    return passages;
  }
}

## Adaptive Assessment Support (Star Assessments)

For adaptive assessments like Renaissance Star:

### Backend Responsibility
- Determines next page based on student performance
- Selects appropriate items and passages
- Sends complete `QtiAssessmentSection` to frontend

### Frontend Responsibility
- Renders the received section as a page
- Displays paired passages with appropriate layout
- Submits responses back to backend

### Navigation Flow

```typescript
// Submit current page responses
POST /api/star/assessment/{id}/navigate/next
Body: {
  sectionId: 'section-1',
  responses: [
    { itemId: 'q1', response: {...} },
    { itemId: 'q2', response: {...} },
    { itemId: 'q3', response: {...} }
  ]
}

// Backend determines next page and responds
Response: {
  success: true,
  section: QtiAssessmentSection,  // Next page to render
  pageNumber?: number,
  totalPages?: number,
  canNavigateNext?: boolean,
  canNavigatePrevious?: boolean
}
```

### Benefits for Adaptive Tests

1. **Stateless Frontend**: Frontend doesn't need to know assessment structure
2. **Dynamic Content**: Backend can change passages and items based on performance
3. **Self-Contained Pages**: Each section has everything needed to render
4. **Simple Integration**: Backend sends one section at a time

## Reference Layout Implementation

The Reference Layout component should:

1. **Detect Paired Passages**: Check for `data-group` attributes
2. **Group by ID**: Group passages with same `data-group` value
3. **Sort by Order**: Use `data-order` attribute for display sequence
4. **Apply Display Mode**: Use `data-display` or section settings for layout
5. **Render Items**: Display all items in `questionRefs` with passages visible

### Layout Options

- **Tabs**: Show one passage at a time with tab navigation
- **Side-by-side**: Display passages horizontally adjacent
- **Stacked**: Display passages vertically stacked
- **Collapsible**: Mobile-friendly accordion view

## Changes Made

1. ✅ Replaced `RubricBlock.content` (HTML string) with `passage: PassageEntity` (PIE entity)
2. ✅ Removed `stimulusRef` - always embed passages directly
3. ✅ Simplified `AssessmentItemRef` - removed backend-specific fields
4. ✅ Added `RubricBlockSettings` for paired passage metadata
5. ✅ Updated documentation to reflect PIE-native approach

## Files Modified

- `packages/players-shared/src/types/index.ts` - Core type definitions
- `docs/SECTION-PLAYER-IMPLEMENTATION-PLAN.md` - Implementation plan
- `docs/SECTION-STRUCTURE-DESIGN.md` - Design rationale
- `docs/qti3-paired-passages-design.md` - This document

## Next Steps

1. Implement SectionPlayer with passage extraction from rubricBlocks
2. Implement layout engine for paired passages (tabs, side-by-side, stacked)
3. Add support for `pairedPassage` settings (grouping, ordering)
4. Update example assessments to use new structure
5. Add tests for passage rendering and deduplication

## Standards Compliance

This design is **QTI 3.0-aligned** where practical:

- ✅ Uses QTI 3.0 structure (`QtiAssessmentSection`, `rubricBlocks`, `assessmentItemRefs`)
- ✅ Uses QTI 3.0 semantics (`keepTogether`, `view`, `use`)
- ✅ Stores PIE entities (not QTI XML) - PIE-native approach
- ✅ No loading logic - player receives resolved entities
- ✅ Can export to QTI XML if needed
