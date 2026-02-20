# Reference Assessment Layout - Implementation Plan

## Overview

This document outlines the plan for implementing a reference assessment layout. The layout features:

1. **Three-column layout**: Left (passage, optional), Middle (questions), Right (notes sidebar)
2. **Top bar**: Assessment-level controls and accommodations
3. **Navigation bar**: Question selector and numbered navigation
4. **Bottom bar**: Item-level tools (Calculator, Graph, Periodic Table, Protractor, Line Reader, Text Magnifier, Ruler)
5. **Item-level tools**: Answer eliminator (inline), Notes (right sidebar)

## Architecture Relationship

This `reference-layout` directory contains the reference layout implementation. The `reference-implementation` directory provides a complete example that uses this layout by:

1. Creating a `AssessmentPlayer` instance
2. Rendering the `ReferenceLayout` component with the player
3. Wiring all events and state management

This separation allows:
- **Reference layout** to be reusable by other implementations
- **Reference implementation** to demonstrate usage patterns
- **Other products** to use this reference layout or implement their own layouts

## Key Principles

- **Light implementation**: Leverage existing players, tools, and services
- **Visual grouping only**: Tools use the same interface but can be visually separated
- **Composable**: Reuse existing PIE players, tool components, and assessment toolkit services
- **Configuration-driven**: Tool placement and visibility controlled via props/config

## Architecture

### Component Structure

```
ReferenceLayout.svelte (New - Main Layout Component)
├── AssessmentHeader.svelte (New - Top bar with title, user, accommodations)
│   ├── AssessmentTitle
│   ├── UserInfo
│   └── AccommodationsBar (Audio, Translation, Contrast, Fullscreen)
│       └── Uses existing tool components (tool-text-to-speech, tool-color-scheme, etc.)
├── AssessmentNavigation.svelte (New - Question selector and navigation)
│   ├── QuestionSelector (dropdown)
│   └── NumberedNavigation (1-2, 3-5, 6, 7, etc.)
├── AssessmentContent.svelte (New - Three-column layout)
│   ├── PassagePanel.svelte (New - Left column, optional)
│   │   └── <pie-iife-player> (for passage content)
│   ├── ItemPanel.svelte (New - Middle column)
│   │   └── <pie-iife-player> (for item/question content)
│   │   └── ItemTools (inline tools like answer eliminator)
│   │       └── <pie-answer-eliminator> (positioned inline)
│   └── NotesPanel.svelte (New - Right sidebar, optional)
│       └── Notes component (item-specific notes)
├── AssessmentToolsBar.svelte (New - Bottom bar)
│   └── Item-level tools (Calculator, Graph, Periodic Table, Protractor, Line Reader, Text Magnifier, Ruler)
│       └── Uses existing tool components via composition
│       └── Delegates to ToolCoordinator for visibility
└── AssessmentFooter.svelte (New - Footer with navigation and actions)
    ├── Navigation buttons (Prev/Next)
    ├── Assessment actions (Overall Instructions, Resources, Review Summary, Finish Later, Flag Question)
    └── Question counter
```

### File Organization

```
assessment-toolkit/
├── reference-layout/          ← This directory (reference layout implementation)
│   ├── index.ts               (export ReferenceLayout and components)
│   ├── ReferenceLayout.svelte (main layout component)
│   ├── components/
│   │   ├── AssessmentHeader.svelte
│   │   ├── AssessmentNavigation.svelte
│   │   ├── AssessmentContent.svelte
│   │   │   ├── PassagePanel.svelte
│   │   │   ├── ItemPanel.svelte
│   │   │   └── NotesPanel.svelte
│   │   ├── AssessmentToolsBar.svelte
│   │   └── AssessmentFooter.svelte
│   └── LAYOUT-PLAN.md        (this file)
│
└── reference-implementation/  ← Uses reference-layout
    ├── index.ts               (export AssessmentPlayer and layout wrapper)
    ├── AssessmentPlayer.ts (existing - keep as-is)
    ├── ReferenceAssessmentLayout.svelte (NEW - wrapper that uses ReferenceLayout)
    └── README.md              (docs on how to use)
```

### Usage Pattern

```svelte
<!-- reference-implementation/ReferenceAssessmentLayout.svelte -->
<script>
  import { AssessmentPlayer } from './AssessmentPlayer';
  import { ReferenceLayout } from '../reference-layout';

  // Create player instance
  const player = new AssessmentPlayer({...});

  // Subscribe to state changes
  // Render reference layout with player
</script>

<ReferenceLayout {player} {assessment} ... />
```

## Implementation Details

### 1. ReferenceLayout.svelte

**Purpose**: Main layout component that orchestrates all sections.

**Responsibilities**:
- Grid layout structure (header, navigation, content, tools, footer)
- Provides AssessmentPlayer instance to child components
- Handles overall layout sizing and responsive behavior

**Props**:
```typescript
{
  player: AssessmentPlayer;
  assessment: AssessmentEntity;
  bundleHost?: string;
  organizationId?: string;
  showPassage?: boolean; // Auto-detect from item
  showNotes?: boolean;
  toolConfig?: ToolConfig; // For tool availability
}
```

**Layout Grid**:
```css
display: grid;
grid-template-rows: auto auto 1fr auto auto;
grid-template-columns: 1fr;
height: 100vh;
```

### 2. AssessmentHeader.svelte

**Purpose**: Top bar with assessment-level controls and accommodations.

**Structure**:
- Left: Assessment title and question count
- Center: Assessment-level actions (Overall Instructions, Resources, Review Summary, Finish Later, Flag Question)
- Right: User name and accommodations (Audio, Translation, Contrast, Fullscreen)

**Implementation Notes**:
- Uses existing tool components but renders them as accommodation controls
- TTS button in accommodations (not item-level)
- Color scheme tool in accommodations
- Translation tool in accommodations
- Fullscreen button (uses browser API)
- Assessment actions are simple buttons that emit events

**Props**:
```typescript
{
  assessment: AssessmentEntity;
  player: AssessmentPlayer;
  currentQuestion: number;
  totalQuestions: number;
  userName?: string;
}
```

### 3. AssessmentNavigation.svelte

**Purpose**: Question selector dropdown and numbered navigation buttons.

**Features**:
- Question selector dropdown ("All Questions")
- Numbered navigation buttons showing question ranges or single questions
- Active question highlighting
- Keyboard navigation support

**Implementation**:
- Uses assessment.questions array from AssessmentPlayer
- Groups questions by ranges for display (e.g., "1-2", "3-5")
- Emits navigation events to player

**Props**:
```typescript
{
  player: AssessmentPlayer;
  currentIndex: number;
  totalItems: number;
  questions: AssessmentQuestion[]; // From assessment
}
```

### 4. AssessmentContent.svelte

**Purpose**: Three-column layout container for passage, item, and notes.

**Layout**:
```css
display: grid;
grid-template-columns: 
  minmax(300px, 1fr)  /* Passage (optional) */
  2fr                  /* Item */
  minmax(250px, 0.8fr); /* Notes (optional) */
gap: 1rem;
```

**Responsive Behavior**:
- Hide passage column if no passage for current item
- Hide notes column if showNotes=false
- Adjust grid-template-columns dynamically based on visibility

**Props**:
```typescript
{
  player: AssessmentPlayer;
  currentItem: ItemEntity | null;
  passage: PassageEntity | null; // From item.passage
  showNotes?: boolean;
}
```

### 5. PassagePanel.svelte

**Purpose**: Left column displaying passage content.

**Implementation**:
- Only renders if passage exists for current item
- Uses `<pie-iife-player>` to render passage config
- Handles passage-specific session state
- Provides scrolling container

**Props**:
```typescript
{
  passage: PassageEntity | null;
  bundleHost?: string;
  env: { mode: string; role: string };
}
```

**Notes**:
- Passage is separate from item, loaded via item.passage reference
- May need to load passage separately if not included in item response

### 6. ItemPanel.svelte

**Purpose**: Middle column displaying question/item content.

**Implementation**:
- Uses `<pie-iife-player>` to render item config
- Inline item-level tools (answer eliminator) positioned within item content area
- Handles item session state
- Provides scrolling container

**Props**:
```typescript
{
  item: ItemEntity | null;
  config: ItemConfig | null;
  session: { id: string; data: any[] };
  bundleHost?: string;
  env: { mode: string; role: string };
  toolCoordinator?: ToolCoordinator;
}
```

**Item-level tools**:
- Answer eliminator: Rendered inline with item content, positioned near choice options
- Other item-specific tools can be added here

### 7. NotesPanel.svelte

**Purpose**: Right sidebar for item-specific notes.

**Features**:
- Per-item note storage
- Textarea for note input
- Save note button
- Auto-save on blur
- Notes persist per item

**Implementation**:
- Uses sessionStorage or player state for persistence
- Note storage keyed by itemVId
- Emits events when notes change

**Props**:
```typescript
{
  itemId: string;
  initialNote?: string;
  onNoteChange?: (itemId: string, note: string) => void;
}
```

### 8. AssessmentToolsBar.svelte

**Purpose**: Bottom bar with item-level tools.

**Tools**:
- Calculator
- Graph
- Periodic Table
- Protractor
- Line Reader
- Text Magnifier
- Ruler

**Implementation**:
- Renders tool buttons horizontally
- Uses existing tool components (tool-calculator, tool-graph, etc.)
- Delegates visibility to ToolCoordinator
- Tools appear as floating modals/overlays (not in bar itself)

**Props**:
```typescript
{
  player: AssessmentPlayer;
  enabledTools?: string[]; // Tool IDs to show buttons for
}
```

**Note**: Tool buttons toggle tool visibility via ToolCoordinator. Actual tool UI (modals, overlays) renders separately via existing tool components.

### 9. AssessmentFooter.svelte

**Purpose**: Footer with navigation controls and assessment actions.

**Left Section**:
- Question counter ("Question 1 of 59")
- Navigation buttons (Prev/Next)

**Right Section**:
- Assessment actions: Overall Instructions, Resources, Review Summary, Finish Later, Flag Question
- End Test button

**Implementation**:
- Simple button components that emit events
- Event handlers delegate to AssessmentPlayer or emit custom events
- Assessment actions may open modals (handled by parent)

**Props**:
```typescript
{
  player: AssessmentPlayer;
  currentQuestion: number;
  totalQuestions: number;
  canNext: boolean;
  canPrevious: boolean;
  onAction?: (action: string) => void; // For assessment actions
}
```

## Tool Placement and Grouping

### Tool Categories

1. **Accommodations (Top Right)**:
   - Audio (TTS) - Uses tool-text-to-speech
   - Translation - Uses tool-translation (if exists) or custom
   - Contrast - Uses tool-color-scheme
   - Fullscreen - Native browser API

2. **Assessment-Level Actions (Top Center)**:
   - Overall Instructions - Button opens modal
   - Resources - Button opens modal/panel
   - Review Summary - Button navigates to summary view
   - Finish Later - Button saves state and exits
   - Flag Question - Toggle button per item

3. **Item-Level Tools (Bottom Bar)**:
   - Calculator
   - Graph
   - Periodic Table
   - Protractor
   - Line Reader
   - Text Magnifier
   - Ruler

4. **Item-Specific Tools (Inline)**:
   - Answer Eliminator - Inline with choices
   - Notes - Right sidebar

### Tool Integration Pattern

All tools use the same interface:
- Register with ToolCoordinator
- Receive visibility state via props
- Render as Web Components or Svelte components
- Visual placement determined by parent layout component

**Example**: Calculator tool
- Button in AssessmentToolsBar renders button
- Button click calls `toolCoordinator.toggleTool('calculator')`
- Calculator component (already exists) responds to visibility prop
- ToolCoordinator manages z-index and visibility

## Passage Handling

### Passage Detection

Passages are optional and associated with items via `item.passage` reference.

**Flow**:
1. Item loaded via AssessmentPlayer
2. Check if `item.passage` exists (ID or full passage entity)
3. If passage ID, load passage separately via API
4. Render passage in PassagePanel using `<pie-iife-player>`

### Passage API

May need to extend AssessmentPlayer to load passages:
```typescript
// In AssessmentPlayer
async loadPassage(passageId: string): Promise<PassageEntity | null> {
  // Load passage from API
  const url = organizationId
    ? `/api/passage/${passageId}?organizationId=${encodeURIComponent(organizationId)}`
    : `/api/passage/${passageId}`;
  const response = await fetch(url);
  return response.ok ? await response.json() : null;
}
```

## State Management

### Using AssessmentPlayer

The layout components should use AssessmentPlayer for:
- Navigation state (via `onNavigationChange`)
- Item state (via `onItemChange`)
- Session state (via `onSessionChange`)
- Loading state (via `onLoadingChange`)

### Additional State

**Notes**: Stored per item, keyed by itemVId
- Could use sessionStorage
- Could extend AssessmentPlayer to manage notes

**Tool States**: Managed by ToolCoordinator (already part of AssessmentPlayer)

**Passage State**: Separate from item state, loaded on demand

## Responsive Design

### Breakpoints

- **Desktop**: Full three-column layout
- **Tablet**: Hide notes column, two-column layout
- **Mobile**: Single column, tools accessible via menu

### Implementation

- Use CSS Grid with responsive grid-template-columns
- Conditional rendering based on screen size
- Tools adapt to available space

## Accessibility

### Keyboard Navigation

- All buttons keyboard accessible
- Toolbar navigation with arrow keys
- Tab order follows visual layout
- Escape closes modals/tools

### Screen Readers

- Proper ARIA labels on all controls
- Live regions for dynamic content (question changes)
- Tool state announced when toggled

### Focus Management

- Focus moves to new question when navigating
- Focus trapped in modals
- Focus returns to trigger after closing tool

## Integration with Existing Components

### Reusing Existing Tools

All existing tools in `/lib/tags/tool-*` can be used as-is:
- tool-calculator
- tool-graph
- tool-periodic-table
- tool-protractor
- tool-ruler
- tool-line-reader
- tool-magnifier
- tool-answer-eliminator
- tool-color-scheme
- tool-text-to-speech

### Reusing PIE Players

- `<pie-iife-player>` for both passages and items
- Same props interface
- Event handling via existing session-changed events

### Using Assessment Toolkit Services

- AssessmentPlayer (navigation, session management)
- ToolCoordinator (tool visibility, z-index)
- HighlightCoordinator (TTS highlighting, annotations)
- TTSService (text-to-speech)
- ThemeProvider (contrast, font size)

## Implementation Steps

### Phase 1: Layout Structure
1. Create ReferenceLayout.svelte with basic grid structure
2. Create AssessmentHeader.svelte (basic structure)
3. Create AssessmentNavigation.svelte
4. Create AssessmentContent.svelte with three-column grid
5. Create AssessmentToolsBar.svelte
6. Create AssessmentFooter.svelte

### Phase 2: Content Panels
1. Create PassagePanel.svelte (basic rendering)
2. Create ItemPanel.svelte (basic rendering)
3. Create NotesPanel.svelte
4. Integrate with AssessmentPlayer

### Phase 3: Tool Integration
1. Add tool buttons to AssessmentToolsBar
2. Add accommodation controls to AssessmentHeader
3. Add inline answer eliminator to ItemPanel
4. Wire tool visibility via ToolCoordinator

### Phase 4: Passage Support
1. Extend AssessmentPlayer to load passages
2. Add passage detection logic
3. Implement PassagePanel with pie-iife-player

### Phase 5: Assessment Actions
1. Implement Overall Instructions modal
2. Implement Resources panel
3. Implement Review Summary navigation
4. Implement Finish Later save state
5. Implement Flag Question toggle

### Phase 6: Polish
1. Responsive design adjustments
2. Accessibility improvements
3. Keyboard navigation
4. Focus management
5. Loading states
6. Error handling

## Testing Considerations

### Unit Tests
- Component rendering with/without passages
- Tool visibility toggles
- Navigation state changes
- Note persistence

### Integration Tests
- Full assessment flow with navigation
- Tool interactions across items
- Passage loading and display
- Session state persistence

### Accessibility Tests
- Keyboard navigation
- Screen reader compatibility
- Focus management
- ARIA labels

## Configuration Options

The layout should be configurable via props:

```typescript
interface ReferenceLayoutConfig {
  // Layout options
  showPassage: boolean; // Auto-detect from item, or force show/hide
  showNotes: boolean;
  
  // Tool configuration
  enabledTools: string[]; // Tool IDs to enable
  toolPositions: {
    accommodations: string[]; // Tools in top-right accommodations
    bottomBar: string[]; // Tools in bottom bar
    inline: string[]; // Tools inline with content
  };
  
  // Feature flags
  showAssessmentActions: boolean;
  showNavigation: boolean;
  showQuestionSelector: boolean;
  
  // Customization
  headerCustomization?: ReactElement; // Custom header content
  footerCustomization?: ReactElement; // Custom footer content
}
```

## Export Strategy

### reference-layout/index.ts

```typescript
// Export main layout component
export { default as ReferenceLayout } from './ReferenceLayout.svelte';

// Export sub-components (optional, for advanced use cases)
export { default as AssessmentHeader } from './components/AssessmentHeader.svelte';
export { default as AssessmentNavigation } from './components/AssessmentNavigation.svelte';
// ... etc

// Export types
export type { ReferenceLayoutConfig } from './types';
```

### reference-implementation/index.ts

```typescript
// Export reference player (existing)
export { AssessmentPlayer } from './AssessmentPlayer';
export type { ReferencePlayerConfig, NavigationState } from './AssessmentPlayer';

// Export layout wrapper that uses ReferenceLayout
export { default as ReferenceAssessmentLayout } from './ReferenceAssessmentLayout.svelte';

// Re-export ReferenceLayout for direct use
export { ReferenceLayout } from '../reference-layout';
```

## Usage Examples

### Using ReferenceLayout Directly

```svelte
<script>
  import { AssessmentPlayer } from '$lib/assessment-toolkit/reference-implementation';
  import { ReferenceLayout } from '$lib/assessment-toolkit/reference-layout';

  const player = new AssessmentPlayer({
    assessment,
    organizationId,
    // ...
  });
</script>

<ReferenceLayout {player} {assessment} />
```

### Using ReferenceAssessmentLayout (Recommended)

```svelte
<script>
  import { ReferenceAssessmentLayout } from '$lib/assessment-toolkit/reference-implementation';
</script>

<ReferenceAssessmentLayout {assessment} {organizationId} />
```

## Notes

- **Light implementation**: Most logic stays in AssessmentPlayer and existing services
- **Composition over configuration**: Reuse existing components, don't duplicate logic
- **Visual grouping**: Tools use same interface, just visually placed differently
- **Progressive enhancement**: Layout works even if some tools unavailable
- **Backward compatible**: Existing tool components work without changes
- **Separation of concerns**: Layout is presentation-only, business logic in AssessmentPlayer

