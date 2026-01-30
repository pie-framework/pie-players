# QTI 3.0 Paired Passages Design

## Overview

This document describes how PIE Assessment Toolkit models paired passages and page-level rendering using pure QTI 3.0 constructs, without custom extensions.

## Key Principles

1. **QTI 3.0 Native**: Use only standard QTI 3.0 constructs
2. **No XML in JSON**: Avoid XML tags embedded in strings; use typed objects
3. **Page = Section**: `QtiAssessmentSection` with `keepTogether: true` represents a page
4. **HTML5 Metadata**: Use standard HTML5 `class` and `data-*` attributes for metadata

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

### Rubric Block (Passages)

Rubric blocks support two approaches for passages:

```typescript
export interface RubricBlock {
  id?: string;
  view: "candidate" | "author" | "proctor" | "scorer" | "testConstructor" | "tutor";
  use?: "instructions" | "passage" | "rubric";

  // Approach 1: Embedded content
  content?: string;

  // Approach 2: Stimulus reference
  stimulusRef?: StimulusRef;
}
```

### Stimulus Reference (QTI 3.0 Native)

```typescript
export interface StimulusRef {
  identifier: string;  // Unique ID
  href: string;        // URL/path to content
}
```

**Note**: The previous `type: 'qti-stimulus'` field was removed as it's not part of the QTI 3.0 specification.

## Approach 1: Embedded Content (Recommended for Adaptive)

This approach embeds passage content directly in the section, making it self-contained and ideal for adaptive assessments where the backend determines content dynamically.

```typescript
const page: QtiAssessmentSection = {
  identifier: 'paired-passages-page-1',
  keepTogether: true,

  rubricBlocks: [
    {
      id: 'passage-mountain-terrains',
      view: 'candidate',
      use: 'passage',
      content: `
        <div class="paired-passage"
             data-group="pair-1"
             data-order="1"
             data-display="tabs">
          <h2>Mountain Terrains</h2>
          <h3>Subtitle</h3>
          <p>Lorem ipsum dolor sit amet...</p>
        </div>
      `
    },
    {
      id: 'passage-forests',
      view: 'candidate',
      use: 'passage',
      content: `
        <div class="paired-passage"
             data-group="pair-1"
             data-order="2"
             data-display="tabs">
          <h2>Forests</h2>
          <p>Content about forests...</p>
        </div>
      `
    }
  ],

  questionRefs: [
    { identifier: 'q1', itemVId: 'item-001', item: {...} },
    { identifier: 'q2', itemVId: 'item-002', item: {...} },
    { identifier: 'q3', itemVId: 'item-003', item: {...} }
  ]
};
```

### HTML5 Data Attributes for Metadata

All passage metadata is expressed using standard HTML5 attributes:

- `class="paired-passage"` - Identifies this as a paired passage
- `data-group="pair-1"` - Groups related passages together
- `data-order="1"` - Display order within group
- `data-display="tabs"` - Display mode hint (tabs, side-by-side, stacked)

## Approach 2: Stimulus References (Reusable Content)

This approach defines stimuli at the assessment level and references them from sections, useful when the same passage is used across multiple sections.

```typescript
const assessment: AssessmentEntity = {
  qtiVersion: '3.0',

  // Define stimuli once at assessment level
  stimulusRefs: [
    {
      identifier: 'mountain-terrains',
      href: '/stimuli/mountain-terrains.html'
    },
    {
      identifier: 'forests',
      href: '/stimuli/forests.html'
    }
  ],

  testParts: [{
    identifier: 'part-1',
    navigationMode: 'nonlinear',
    submissionMode: 'individual',
    sections: [{
      identifier: 'section-1',
      keepTogether: true,

      // Reference stimuli by identifier
      rubricBlocks: [
        {
          id: 'passage-1',
          view: 'candidate',
          use: 'passage',
          stimulusRef: {
            identifier: 'mountain-terrains',
            href: '/stimuli/mountain-terrains.html'
          }
        },
        {
          id: 'passage-2',
          view: 'candidate',
          use: 'passage',
          stimulusRef: {
            identifier: 'forests',
            href: '/stimuli/forests.html'
          }
        }
      ],

      questionRefs: [...]
    }]
  }]
};
```

### Rendering Logic

When a `RubricBlock` has a `stimulusRef`:

1. Resolve the reference by fetching content from `stimulusRef.href`
2. Cache the content for reuse
3. The fetched HTML should include the same metadata attributes as Approach 1

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

1. ✅ Removed non-standard `type: 'qti-stimulus'` from `StimulusRef`
2. ✅ Made `RubricBlock.content` optional (was required)
3. ✅ Added `RubricBlock.stimulusRef` for reference approach
4. ✅ Updated documentation to reflect QTI 3.0 compliance
5. ✅ Added comprehensive JSDoc comments

## Files Modified

- `packages/players-shared/src/types/index.ts` - Core type definitions
- `docs/qti-3.0-feature-support.md` - Updated StimulusRef example
- `docs/qti3-paired-passages-design.md` - This document

## Next Steps

1. Implement Reference Layout support for paired passages
2. Add rendering logic for `RubricBlock.stimulusRef`
3. Create Star Assessment integration adapter
4. Add examples and tests for both approaches
5. Document CSS classes and data attributes for passage styling

## Standards Compliance

This design is **100% QTI 3.0 compliant**:

- ✅ Uses standard QTI 3.0 constructs (`QtiAssessmentSection`, `RubricBlock`, `StimulusRef`)
- ✅ No custom TypeScript extensions (only optional `settings` field for PIE-specific hints)
- ✅ HTML5 data attributes for metadata (standard HTML5)
- ✅ No XML embedded in JSON strings
- ✅ Based on official IMS Global QTI 3.0 specification
