# Section Player Implementation Plan

**Date**: 2026-02-05
**Status**: Planning
**Decision**: Simple direct implementation (no strategy pattern) with QTI-aligned structure using PIE entities

---

## Executive Summary

Refactor the Assessment Player architecture to introduce a **SectionPlayer** that handles rendering and interaction for a single section/page, while the **AssessmentPlayer** focuses on section-to-section navigation and assessment-level concerns.

### Key Decisions

**1. Keep It Simple**

Based on QTI 3.0 spec analysis, there are only **two patterns**:
1. **`keepTogether: true`** - Multiple items per page (with passages)
2. **`keepTogether: false`** - One item at a time

Given the limited options and lack of spec evolution, we'll use **direct implementation** with conditional logic rather than strategy pattern. This can be refactored later if more patterns emerge.

**2. QTI-Aligned Structure with PIE Entities**

We use QTI's structure (`rubricBlocks`, `assessmentItemRefs`) but store **PIE entities** (`PassageEntity`, `ItemEntity`) instead of HTML strings or references. This gives us:
- QTI's semantic meaning (`view`, `use` attributes)
- PIE's native config structure (markup, elements, models)
- No loading logic in player - client provides resolved entities
- Easy export to QTI XML if needed

**3. No External References**

We simplified by removing `stimulusRef` and always embedding passages directly in `rubricBlocks`. Passages are **resolved entities**, not IDs or URLs.

---

## Architecture Overview

### Current State (Before)

```
┌─────────────────────────────────────────┐
│        AssessmentPlayer                 │
│  (Does everything)                      │
├─────────────────────────────────────────┤
│ • Navigation                            │
│ • Item loading                          │
│ • Tool coordination                     │
│ • TTS/Theme/Highlight                   │
│ • Session management                    │
│ • Rubric rendering                      │
│ • Direct ItemPlayer usage               │
└─────────────────────────────────────────┘
```

### Target State (After)

```
┌─────────────────────────────────────────┐
│        AssessmentPlayer                 │
│  (Thin - navigation only)               │
├─────────────────────────────────────────┤
│ • Section-to-section navigation         │
│ • Assessment-level TestSession          │
│ • Context variables (QTI 3.0)          │
│ • Navigation modes (linear/nonlinear)  │
└─────────────────────────────────────────┘
              │
              │ creates & navigates to
              ▼
┌─────────────────────────────────────────┐
│        SectionPlayer                    │
│  (Heavy - rendering & interaction)      │
├─────────────────────────────────────────┤
│ • Render section (keepTogether logic)  │
│ • Multi-item layout (page mode)        │
│ • Single-item rendering (item mode)    │
│ • Item loading                          │
│ • Tool coordination                     │
│ • TTS/Theme/Highlight services          │
│ • Rubric block rendering                │
│ • Section-level session                 │
│ • PNP tool resolution                   │
└─────────────────────────────────────────┘
              │
              │ renders
              ▼
        ┌──────────────┐
        │  ItemPlayer  │
        │ (pie-esm/iife)│
        └──────────────┘
```

---

## Data Structure

### Section Structure (QTI-Aligned with PIE Entities)

```typescript
export interface QtiAssessmentSection {
  identifier: string;
  title?: string;
  keepTogether?: boolean;  // true = page mode, false = item mode
  visible?: boolean;
  required?: boolean;

  // Content (fully resolved - no loading needed)
  rubricBlocks?: RubricBlock[];         // Instructions, passages, rubrics
  assessmentItemRefs?: AssessmentItemRef[];  // Items

  sections?: QtiAssessmentSection[];    // Nested sections
  settings?: SettingsMetaData;
}

export interface RubricBlock {
  id?: string;
  view: 'candidate' | 'scorer' | 'author' | 'proctor' | 'testConstructor' | 'tutor';
  use?: 'instructions' | 'passage' | 'rubric';
  passage?: PassageEntity;  // PIE entity with config
  settings?: RubricBlockSettings;
}

export interface AssessmentItemRef {
  identifier: string;
  title?: string;
  required?: boolean;
  item?: ItemEntity;  // PIE entity with config (fully resolved)
  settings?: ItemSettings;
}
```

### Passage Handling: Two Sources

The SectionPlayer must handle passages from **two sources**:

1. **Section-level passages** - `section.rubricBlocks[]` where `use="passage"`
2. **Item-linked passages** - `itemRef.item.passage` (legacy PIE pattern)

Both are `PassageEntity` with PIE configs and rendered identically using ItemPlayer.

---

## Responsibility Split

### AssessmentPlayer (Simplified)

**Keep:**
- `buildNavigationStructure()` - Build QTI navigation tree
- `getAllQuestionRefs()` - Flatten to question list
- `testSession` management (TestSession CRUD)
- `contextStore` - Assessment-level context variables
- `navigateToSection(sectionIndex)` - Navigate between sections
- Navigation state tracking
- Assessment lifecycle events (`assessment:started`, `assessment:completed`)

**Remove (move to SectionPlayer):**
- Item rendering and coordination
- `currentItem`, `currentItemIndex` - Current item state
- `toolCoordinator`, `ttsService`, `themeProvider`, `highlightCoordinator` - Service instances
- `desmosProvider`, `tiProvider` - Calculator providers
- `pnpResolver`, `currentTools` - Tool resolution per section
- `getCurrentSectionRubricBlocks()` - Rubric rendering
- `readQuestion()`, `toggleTTS()`, `stopTTS()` - TTS operations
- `applyTheme()` - Theme management
- Item-level navigation methods

**New API:**
```typescript
class AssessmentPlayer {
  // Section navigation
  async navigateToSection(sectionIndex: number): Promise<void>
  async navigateNextSection(): Promise<void>
  async navigatePreviousSection(): Promise<void>
  getSectionNavigationState(): SectionNavigationState

  // Assessment session
  getTestSession(): TestSession
  getContextVariables(): Record<string, any>
  setContextVariable(identifier: string, value: any): void

  // Section player factory
  createSectionPlayer(section: NavigationNode): SectionPlayer
  getCurrentSectionPlayer(): SectionPlayer | null

  // Events
  onSectionChanged(listener: (section: NavigationNode) => void): () => void
  onAssessmentCompleted(listener: () => void): () => void

  // Existing
  start(): Promise<void>
  destroy(): void
}
```

---

### SectionPlayer (New)

**Core Responsibilities:**

```typescript
export interface SectionPlayerConfig {
  section: QtiAssessmentSection;  // Fully resolved with passages and items

  // Player mode
  mode?: "gather" | "view" | "evaluate" | "author";


  // Restored sessions for items (optional)
  itemSessions?: Record<string, ItemSession>;

  // Injected services (from AssessmentPlayer)
  services?: {
    eventBus?: TypedEventBus<AssessmentToolkitEvents>;
    contextStore?: ContextVariableStore;
  };
}

export class SectionPlayer {
  // === Core Rendering ===

  async initialize(): Promise<void>  // Create item/passage players (no loading)
  render(): HTMLElement  // or return Svelte component
  destroy(): void

  // === keepTogether Logic ===

  private isPageMode(): boolean {
    return this.section.keepTogether === true;
  }

  private createPlayers(): void {
    if (this.isPageMode()) {
      this.createAllItemPlayers();  // Create all item players for page
    } else {
      this.createCurrentItemPlayer();  // Create only current item player
    }
  }

  private renderContent(): HTMLElement {
    if (this.isPageMode()) {
      return this.renderPage();  // Multi-item + passages layout
    } else {
      return this.renderSingleItem();  // Single item view
    }
  }

  // === Passage Extraction (from two sources) ===

  private getAllPassages(): PassageEntity[] {
    // 1. Extract from rubricBlocks (section-level)
    // 2. Extract from item.passage (item-linked)
    // 3. Deduplicate by ID
  }

  // === Item Navigation (within section, only for keepTogether: false) ===

  async navigateToItem(itemIndex: number): Promise<void>
  async navigateNextItem(): Promise<void>
  async navigatePreviousItem(): Promise<void>
  getItemNavigationState(): ItemNavigationState

  // === Session Management ===

  getSectionSession(): SectionSession
  isComplete(): boolean
  handlePieSessionChanged(detail: any): void

  // === Tool Coordination ===

  getToolCoordinator(): ToolCoordinator
  showTool(toolId: string): void
  hideTool(toolId: string): void
  isToolEnabled(toolId: string): boolean

  // === TTS/Accessibility ===

  async readContent(selector?: string): Promise<void>
  toggleTTS(): void
  stopTTS(): void
  getTTSState(): { initialized: boolean; speaking: boolean; paused: boolean }

  // === Theme ===

  applyTheme(theme: ThemeConfig): void
  getThemeProvider(): ThemeProvider | null

  // === Rubric Blocks (Passages) ===

  getRubricBlocks(): RubricBlock[]

  // === Events ===

  onItemChanged(listener: (item: ItemEntity) => void): () => void
  onSectionComplete(listener: () => void): () => void
  onLoadingChange(listener: (isLoading: boolean) => void): () => void
}
```

---

## New Types

### SectionSession

```typescript
export interface SectionSession {
  sectionIdentifier: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;

  // Item sessions within this section (keyed by item identifier)
  itemSessions: Record<string, ItemSession>;

  // Section-level completion tracking
  isComplete: boolean;
  requiredItemsComplete: boolean;

  // Navigation state within section (only for keepTogether: false)
  currentItemIndex?: number;
  visitedItemIndices: number[];
}
```

### ItemNavigationState

```typescript
export interface ItemNavigationState {
  currentIndex: number;
  totalItems: number;
  canNext: boolean;
  canPrevious: boolean;
  isLoading: boolean;
  currentItem?: ItemEntity;
}
```

### SectionNavigationState

```typescript
export interface SectionNavigationState {
  currentIndex: number;
  totalSections: number;
  canNext: boolean;
  canPrevious: boolean;
  isLoading: boolean;
  currentSection?: {
    id: string;
    identifier: string;
    title?: string;
    keepTogether: boolean;
  };
}
```

---

## Implementation Phases

### Phase 1: Extract SectionPlayer Class

**Goal**: Create SectionPlayer with both `keepTogether` modes

**Tasks**:

1. Create `packages/assessment-toolkit/src/player/section/SectionPlayer.ts`
2. Create `packages/assessment-toolkit/src/player/section/types.ts` for interfaces
3. Move tool coordination logic from AssessmentPlayer
4. Move TTS/Theme/Highlight services from AssessmentPlayer
5. Implement `isPageMode()` and conditional rendering logic
6. Implement passage extraction from both rubricBlocks and item.passage
7. Add unit tests for SectionPlayer

**Files to Create**:

- `packages/assessment-toolkit/src/player/section/SectionPlayer.ts`
- `packages/assessment-toolkit/src/player/section/types.ts`
- `packages/assessment-toolkit/src/player/section/index.ts` (exports)

**Files to Modify**:

- `packages/assessment-toolkit/src/index.ts` (export SectionPlayer)

**Success Criteria**:

- ✅ SectionPlayer can render a section with `keepTogether: true`
- ✅ SectionPlayer can render a section with `keepTogether: false`
- ✅ Handles passages from rubricBlocks (section-level)
- ✅ Handles passages from item.passage (item-linked)
- ✅ Deduplicates passages correctly
- ✅ All services (TTS, Theme, Tools) work in SectionPlayer
- ✅ Unit tests pass

---

### Phase 2: Refactor AssessmentPlayer

**Goal**: Simplify AssessmentPlayer to use SectionPlayer

**Tasks**:
1. Remove item-level navigation from AssessmentPlayer
2. Add section-level navigation methods
3. Implement `createSectionPlayer()` factory method
4. Update navigation to work with sections instead of items
5. Refactor session management to track sections
6. Update event emissions
7. Update tests

**Files to Modify**:
- `packages/assessment-toolkit/src/player/AssessmentPlayer.ts`
- `packages/assessment-toolkit/src/attempt/TestSession.ts` (add section tracking)
- Tests for AssessmentPlayer

**Success Criteria**:
- ✅ AssessmentPlayer navigates section-to-section
- ✅ AssessmentPlayer creates SectionPlayer instances
- ✅ TestSession tracks section progress
- ✅ All existing tests pass (with modifications)

---

### Phase 3: Update TestSession for Sections

**Goal**: Add section-level tracking to TestSession

**Tasks**:
1. Add `sectionSessions: Record<string, SectionSession>` to TestSession
2. Create helper functions for section session management:
   - `createSectionSession()`
   - `upsertSectionSession()`
   - `getSectionSession()`
3. Update `TestSession` to track current section
4. Migrate item sessions to be nested under section sessions

**Files to Modify**:
- `packages/assessment-toolkit/src/attempt/TestSession.ts`

**New Structure**:
```typescript
export interface TestSession {
  version: 1;
  testSessionIdentifier: string;
  assessmentId: string;

  startedAt: string;
  updatedAt: string;
  completedAt?: string;

  navigationState: {
    currentSectionIndex: number;      // NEW: Track section
    currentItemIndex?: number;         // DEPRECATED: Only for backward compat
    visitedItemIdentifiers: string[];
    visitedSectionIdentifiers: string[];  // NEW
    currentSectionIdentifier?: string;
  };

  realization: TestSessionRealization;

  // NEW: Section-level sessions
  sectionSessions: Record<string, SectionSession>;

  // DEPRECATED: Flat item sessions (for backward compat)
  itemSessions: Record<string, ItemSession>;

  contextVariables?: Record<string, any>;
}
```

---

### Phase 4: Layout Engine for Page Mode

**Goal**: Implement multi-column layout for `keepTogether: true`

**Tasks**:
1. Create layout rendering logic
2. Implement two-column layout (passages left, items right)
3. Add responsive breakpoints
4. Support stacked layout for mobile
5. Render rubric blocks (passages)
6. Render all items simultaneously
7. Add CSS for layouts

**Files to Create**:
- `packages/assessment-toolkit/src/player/section/layouts/PageLayout.ts`
- `packages/assessment-toolkit/src/player/section/layouts/page-layout.css`

**Layout Options** (Future):
- Two-column (passages left, items right)
- Stacked (passages top, items bottom)
- Tabbed passages (tabs for multiple passages)
- Side-by-side resizable

**Success Criteria**:
- ✅ Multiple items render on one page
- ✅ Rubric blocks (passages) display correctly
- ✅ Layout is responsive
- ✅ Works with real PIE item players

---

### Phase 5: Session Aggregation

**Goal**: Roll up item sessions into section sessions

**Tasks**:
1. Implement `getSectionSession()` in SectionPlayer
2. Aggregate item completion → section completion
3. Handle required vs optional items
4. Track visited items within section
5. Persist section session on navigation
6. Restore section session on return

**Files to Modify**:
- `packages/assessment-toolkit/src/player/section/SectionPlayer.ts`
- `packages/assessment-toolkit/src/attempt/TestSession.ts`

**Success Criteria**:
- ✅ Section marked complete when all required items complete
- ✅ Section session persisted to localStorage
- ✅ Section session restored on navigation back
- ✅ Partial progress saved correctly

---

### Phase 6: Component Integration (Svelte)

**Goal**: Create Svelte component wrappers

**Tasks**:
1. Create `<SectionPlayer>` Svelte component
2. Create `<AssessmentPlayer>` Svelte component (updated)
3. Wire up event handlers
4. Add navigation UI for sections
5. Add tool panel UI
6. Add TTS controls
7. Update example app

**Files to Create**:
- `packages/assessment-toolkit/src/components/SectionPlayer.svelte`
- `packages/assessment-toolkit/src/components/AssessmentPlayer.svelte` (update)

**Files to Modify**:
- Host demo application entrypoint (use new components)

**Success Criteria**:
- ✅ Components render correctly
- ✅ Navigation works in UI
- ✅ Tools panel displays and functions
- ✅ TTS controls work
- ✅ Demo host app demonstrates features

---

## Migration Strategy

### Backward Compatibility

**Option A: Breaking Change (Recommended)**
- Announce breaking change in v2.0
- Provide migration guide
- Update all examples

**Option B: Compatibility Layer**
- Keep old AssessmentPlayer as `LegacyAssessmentPlayer`
- New `AssessmentPlayer` uses SectionPlayer
- Deprecation warnings for old API
- Remove in v3.0

**Recommendation**: Option A - clean break. The AssessmentPlayer is still evolving and likely has limited external usage.

---

## Testing Strategy

### Unit Tests

**SectionPlayer Tests**:
- ✅ Load section with `keepTogether: true`
- ✅ Load section with `keepTogether: false`
- ✅ Render page mode (multiple items)
- ✅ Render item mode (single item)
- ✅ Tool coordination
- ✅ TTS functionality
- ✅ Session management
- ✅ Rubric block rendering

**AssessmentPlayer Tests**:
- ✅ Navigate between sections
- ✅ Create section players
- ✅ Track assessment session
- ✅ Context variable management
- ✅ Linear/nonlinear modes

### Integration Tests

- ✅ Full assessment flow (start → sections → complete)
- ✅ Session persistence across navigation
- ✅ Tool state persists within section
- ✅ Context variables flow correctly
- ✅ Mixed `keepTogether` modes in one assessment

### E2E Tests

- ✅ Complete an assessment with paired passages
- ✅ Navigate back/forward through sections
- ✅ Use calculator across multiple items
- ✅ TTS across items in a section
- ✅ Submit assessment with simultaneous mode

---

## File Structure

```
packages/assessment-toolkit/src/
├── player/
│   ├── section/
│   │   ├── SectionPlayer.ts          # Main section player
│   │   ├── types.ts                  # SectionSession, configs, etc.
│   │   ├── layouts/
│   │   │   ├── PageLayout.ts         # keepTogether: true layout
│   │   │   └── page-layout.css       # Layout styles
│   │   └── index.ts                  # Exports
│   ├── AssessmentPlayer.ts           # Refactored (section navigation)
│   ├── qti-navigation.ts             # Unchanged
│   └── index.ts                      # Export both players
├── attempt/
│   └── TestSession.ts                # Updated with section tracking
├── components/                        # Svelte components
│   ├── SectionPlayer.svelte          # NEW
│   └── AssessmentPlayer.svelte       # Updated
└── index.ts                          # Export everything
```

---

## Example Usage (After Refactor)

### Basic Usage

```typescript
import { AssessmentPlayer } from '@pie-assessment-toolkit';

// Assessment with fully resolved sections, items, and passages
const player = new AssessmentPlayer({
  assessment: qti3Assessment,  // All entities already resolved
  userId: 'student-123',
  assignmentId: 'assignment-456',
});

// Start assessment (navigates to first section)
await player.start();

// Get current section player
const sectionPlayer = player.getCurrentSectionPlayer();

// Render section
const container = document.getElementById('assessment-container');
container.appendChild(sectionPlayer.render());

// Navigate to next section
await player.navigateNextSection();
```

### Example Assessment Structure

```typescript
const assessment: AssessmentEntity = {
  id: 'assessment-001',
  identifier: 'paired-passages-demo',
  title: 'Urban Gardens Assessment',
  qtiVersion: '3.0',

  testParts: [{
    identifier: 'part-1',
    navigationMode: 'nonlinear',
    submissionMode: 'simultaneous',
    sections: [{
      identifier: 'page-1',
      title: 'Urban Gardens: Different Perspectives',
      keepTogether: true,  // Page mode: show all items together

      rubricBlocks: [
        {
          id: 'instructions',
          view: 'candidate',
          use: 'instructions',
          passage: {
            id: 'inst-001',
            name: 'Directions',
            config: { /* PIE config */ }
          }
        },
        {
          id: 'passage-1',
          view: 'candidate',
          use: 'passage',
          passage: {
            id: 'passage-benefits',
            name: 'The Benefits of Urban Gardening',
            config: { /* PIE config */ }
          },
          settings: {
            pairedPassage: { group: 'urban-gardens', order: 1 }
          }
        },
        {
          id: 'passage-2',
          view: 'candidate',
          use: 'passage',
          passage: {
            id: 'passage-challenges',
            name: 'Urban Gardens: Challenges',
            config: { /* PIE config */ }
          },
          settings: {
            pairedPassage: { group: 'urban-gardens', order: 2 }
          }
        }
      ],

      assessmentItemRefs: [
        {
          identifier: 'q1',
          required: true,
          item: {
            id: 'item-001',
            name: 'Question 1',
            config: { /* PIE config */ }
          }
        },
        {
          identifier: 'q2',
          required: true,
          item: {
            id: 'item-002',
            name: 'Question 2',
            config: { /* PIE config */ }
          }
        }
      ]
    }]
  }]
};
```

### With Svelte

```svelte
<script>
  import { AssessmentPlayer } from '@pie-assessment-toolkit/components';

  let assessment = qti3Assessment;
  let player;

  async function loadItem(itemVId) {
    return fetch(`/api/items/${itemVId}`).then(r => r.json());
  }
</script>

<AssessmentPlayer
  bind:this={player}
  {assessment}
  {loadItem}
  userId="student-123"
  assignmentId="assignment-456"
/>
```

---

## Key Implementation Details

### Passage Handling

The SectionPlayer must extract passages from **two sources**:

1. **Section-level passages** (primary):
   ```typescript
   section.rubricBlocks
     .filter(rb => rb.use === 'passage' && rb.passage)
     .map(rb => rb.passage)
   ```

2. **Item-linked passages** (legacy PIE pattern):
   ```typescript
   section.assessmentItemRefs
     .filter(ref => ref.item?.passage)
     .map(ref => ref.item.passage)
   ```

3. **Deduplication**: If same passage appears in both, show once (by `passage.id`)

### Rendering by View

Filter rubricBlocks by `view` attribute based on current user role:

- **Student**: Show `view="candidate"` only
- **Teacher/Scorer**: Show `view="scorer"` + `view="candidate"`
- **Author**: Show `view="author"` + `view="candidate"`

### Rubric Elements

PIE has three rubric elements for scoring:

- `@pie-element/rubric` - Basic rubric
- `@pie-element/complex-rubric` - Complex rubric
- `@pie-element/multi-trait-rubric` - Multi-trait rubric

These are rendered as passages in rubricBlocks with:
```typescript
{
  view: 'scorer',
  use: 'rubric',
  passage: { /* PassageEntity with rubric config */ }
}
```

---

## Open Questions

1. **Tool Scope**: Should tools (calculator) persist across sections or reset per section?
   - **Recommendation**: Reset per section (cleaner state management)

2. **Session Persistence**: Save section sessions independently or only when navigating away?
   - **Recommendation**: Auto-save on navigation + periodic auto-save (every 30s)

3. **Mixed Modes**: Can one assessment have both `keepTogether: true` and `false` sections?
   - **Answer**: Yes, QTI 3.0 allows this. SectionPlayer handles both.

4. **Backward Compat**: Support old AssessmentPlayer API or breaking change?
   - **Recommendation**: Breaking change with migration guide

5. **Layout Preferences**: Should layout (two-column vs stacked) be configurable?
   - **Recommendation**: Start with two-column, add responsive breakpoints. Make configurable in Phase 4 if needed.

---

## Timeline Estimate

- **Phase 1**: Extract SectionPlayer - 3-5 days
- **Phase 2**: Refactor AssessmentPlayer - 2-3 days
- **Phase 3**: Update TestSession - 1-2 days
- **Phase 4**: Layout Engine - 3-4 days
- **Phase 5**: Session Aggregation - 2-3 days
- **Phase 6**: Svelte Components - 2-3 days

**Total**: ~2-3 weeks for full implementation + testing

---

## Success Metrics

- ✅ SectionPlayer handles both `keepTogether` modes
- ✅ AssessmentPlayer is <300 lines (down from ~1200)
- ✅ SectionPlayer is self-contained and reusable
- ✅ All existing functionality preserved
- ✅ Example app demonstrates paired passages
- ✅ Unit test coverage >80%
- ✅ No performance regression

---

## References

- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0/impl)
- [QTI 3 Item Player (amp-up.io)](https://github.com/amp-up-io/qti3-item-player)
- [Paired Passages Design](./qti3-paired-passages-design.md)
- [Architecture Doc](./ARCHITECTURE.md)
- [QTI 3.0 Feature Support](./qti-3.0-feature-support.md)

---

## Next Steps

1. Review and approve this plan
2. Create GitHub issue/epic for tracking
3. Start Phase 1: Extract SectionPlayer
4. Weekly check-ins on progress
5. Demo after each phase

---

**Document Status**: Ready for Review
**Last Updated**: 2026-02-05
**Author**: Claude (with Eelco)
