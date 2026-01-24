# Question Layout Engine Architecture

**Version**: 2.0
**Date**: 2026-01-09
**Status**: Architecture Specification

## Executive Summary

The **Question Layout Engine** provides a flexible, composable system for positioning assessment content. The architecture introduces template-based layouts with multi-level configuration, responsive design, and accessibility-first principles while maintaining framework independence.

### Core Architectural Principles

1. **Session Management Layer** - Navigation, state persistence, service orchestration
2. **Presentation Layer** - Visual structure and content positioning
3. **Content Layer** - Question rendering and interaction

This three-layer separation ensures clean boundaries between business logic, presentation, and content.

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Core Components](#core-components)
3. [Data Model](#data-model)
4. [Template System](#template-system)
5. [Tools and Accommodations](#tools-and-accommodations)
6. [Integration Patterns](#integration-patterns)
7. [Examples](#examples)

---

## Architectural Overview

### Layer Separation

```
┌──────────────────────────────────────────────────┐
│  Presentation Layer (LayoutEngine + Templates)   │
│  - Visual structure (what goes where)           │
│  - Template selection logic                     │
│  - Responsive behavior                          │
│  - UI chrome (navigation, headers)              │
└──────────────────────────────────────────────────┘
                         ↕
┌──────────────────────────────────────────────────┐
│  Session Management (AssessmentSessionManager)   │
│  - Navigation coordination                       │
│  - Session state persistence                     │
│  - Service orchestration (TTS, theme, tools)     │
│  - Event coordination                            │
│  - Item/passage loading                          │
└──────────────────────────────────────────────────┘
                         ↕
┌──────────────────────────────────────────────────┐
│  Content Layer (PIE Item Players)                │
│  - Question rendering                            │
│  - Response collection                           │
│  - Scoring logic                                 │
│  - Player-specific interactions                  │
└──────────────────────────────────────────────────┘
```

**Key Principles**:

- Layout templates know nothing about navigation logic or data persistence
- Session manager knows nothing about visual positioning or UI chrome
- Item players remain framework-agnostic web components
- Clear contracts: Session manager exposes reactive state; layouts consume it

### Component Hierarchy

```
Application (Product Code)
    ↓
AssessmentSessionManager (Business Logic)
  - Navigation & state management
  - Service orchestration
  - Event coordination
    ↓
LayoutEngine + Template (Presentation)
  - Template selection
  - Visual structure
  - Responsive behavior
    ↓
Content Slots
  - PassageSlot | ItemSlot | RubricSlot | ToolSlot
    ↓
PIE Item Players (Content)
  - <pie-iife-player> | <pie-passage-player>
```

### Data Flow

#### Navigation Flow

```
User Action (Next button)
    ↓
Layout dispatches → sessionManager.navigateNext()
    ↓
AssessmentSessionManager:
  - Updates currentItemIndex
  - Loads item via loadItem(itemVId)
  - Persists to TestSession storage
  - Updates reactive state
  - Emits 'nav:item-changed' event
    ↓
Layout Engine observes state change
    ↓
Template re-evaluates and re-renders
    ↓
Content Slots render new content
    ↓
User sees new question
```

#### Session State Flow

```
User interacts with item
    ↓
<pie-iife-player> emits 'session-changed'
    ↓
Layout captures and forwards to sessionManager
    ↓
AssessmentSessionManager:
  - Updates sessionState
  - Maps PIE session → TestSession
  - Persists to storage
  - Emits 'player:session-changed'
    ↓
Application listeners react (analytics, autosave)
```

---

## Core Components

### AssessmentSessionManager

**Responsibility**: Headless session management service with no UI concerns.

**API Surface**:

```typescript
interface AssessmentSessionManager {
  // Reactive State (consumed by layouts)
  getCurrentItem(): ItemEntity | null;
  getCurrentPassage(): PassageEntity | null;
  getCurrentRubricBlocks(): RubricBlock[];
  getNavigationState(): NavigationState;
  getSessionState(): SessionState;

  // Navigation
  navigate(index: number): Promise<void>;
  navigateNext(): Promise<void>;
  navigatePrevious(): Promise<void>;
  start(): Promise<void>;

  // Service Access
  getToolCoordinator(): ToolCoordinator;
  getThemeProvider(): ThemeProvider;
  getTTSService(): TTSService;
  getHighlightCoordinator(): HighlightCoordinator;

  // Event Subscriptions
  onNavigationChange(listener: (state: NavigationState) => void): Unsubscribe;
  onItemChange(listener: (item: ItemEntity | null) => void): Unsubscribe;
  onSessionChange(listener: (session: SessionState) => void): Unsubscribe;
}
```

**QTI Feature Support**:

- Assessment structure (testPart → sections → questions)
- Navigation modes (linear, nonlinear)
- Section awareness and rubric blocks
- Session persistence with visited items tracking
- Item session mapping (QTI identifiers → PIE sessions)

### LayoutEngine

**Responsibility**: Template registry, selection logic, and lifecycle management.

**API Surface**:

```typescript
interface LayoutEngine {
  // Template Management
  registerTemplate(template: LayoutTemplate): void;
  getTemplate(templateId: string): LayoutTemplate | undefined;
  getAllTemplates(): LayoutTemplate[];

  // Selection
  selectTemplate(context: LayoutContext): LayoutTemplate;
  setSelectionStrategy(strategy: TemplateSelectionStrategy): void;

  // Configuration
  setLayoutConfig(config: LayoutConfig): void;
  getCurrentTemplate(): LayoutTemplate | null;

  // Events
  on(event: 'template:changed' | 'region:resized', handler: Handler): void;
}
```

### Layout Templates

**Responsibility**: Define visual structure for displaying assessment content.

**Template Definition**:

```typescript
interface LayoutTemplate {
  id: string;
  type: 'single-column' | 'two-column' | 'three-column' | 'custom';
  displayName: string;

  // Visual structure
  regions: Record<RegionId, RegionConfig>;

  // Responsive behavior
  breakpoints?: Record<Breakpoint, LayoutOverride>;

  // Constraints
  constraints?: {
    minViewportWidth?: number;
    requiresPassage?: boolean;
    supportsTools?: string[];
  };
}

interface RegionConfig {
  type: 'passage' | 'item' | 'rubric' | 'tools' | 'notes';
  width?: number | string;
  minWidth?: number;
  flex?: number;
  resizable?: boolean;
  scrollable?: boolean;
  visible?: boolean | ConditionalVisibility;
}
```

### Content Slots

**Responsibility**: Reusable components that fill template regions.

**Available Slots**:

- `PassageSlot` - Renders passages/stimuli
- `ItemSlot` - Renders the main question
- `RubricSlot` - Renders rubrics (student or instructor)
- `ToolSlot` - Positions tool buttons/panels
- `NotesSlot` - Renders student notes sidebar
- `InstructionsSlot` - Assessment or section instructions

**Slot Features**:

- Type-safe content validation
- Lazy loading
- Error boundaries
- Proper ARIA roles and labels

---

## Data Model

### Layout Context

Context provided to templates for rendering decisions:

```typescript
interface LayoutContext {
  // Current content
  currentItem: ItemEntity | null;
  passage: PassageEntity | null;
  rubrics: RubricBlock[];

  // Assessment metadata
  assessment: AssessmentEntity;
  currentSection?: AssessmentSection;

  // Navigation state
  navigation: NavigationState;

  // Student profile
  studentProfile?: StudentProfile;

  // Available tools (resolved)
  availableTools: ToolConfig[];

  // Environment
  env: { mode: string; role: string };
}
```

### Template Selection

Priority order for template selection:

1. **Item-level override** - Specified in item configuration
2. **Student profile preference** - Saved user preference
3. **Assessment default** - Configured on assessment
4. **Content-based selection** - Algorithm based on content type

```typescript
function selectTemplate(context: LayoutContext): LayoutTemplate {
  // 1. Item override
  if (context.currentItem?.configuration?.template) {
    return getTemplate(context.currentItem.configuration.template);
  }

  // 2. Student preference
  if (context.studentProfile?.preferredLayout) {
    return getTemplate(context.studentProfile.preferredLayout);
  }

  // 3. Assessment default
  if (context.assessment.configuration?.defaultTemplate) {
    return getTemplate(context.assessment.configuration.defaultTemplate);
  }

  // 4. Content-based
  return selectByContent(context);
}
```

### Configuration Hierarchy

```
Assessment Configuration
  ↓ (overridden by)
Item Configuration
  ↓ (overridden by)
Student Preferences
```

**Assessment-Level Configuration**:

```typescript
interface AssessmentLayoutConfig {
  defaultTemplate?: string;
  templatesByType?: Record<ItemType, string>;
  responsive?: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  features?: {
    resizablePanels: boolean;
    persistPanelWidths: boolean;
    showNotesSidebar: boolean;
  };
}
```

**Item-Level Configuration**:

```typescript
interface ItemLayoutConfig {
  template?: string;
  hints?: {
    preferredPassageWidth?: number;
    hidePassageOnMobile?: boolean;
    verticalLayout?: boolean;
  };
}
```

---

## Template System

### Built-In Template Patterns

#### Single Column (Mobile-First)

```
┌─────────────────────────┐
│     Header              │
├─────────────────────────┤
│     Navigation          │
├─────────────────────────┤
│     Passage (optional)  │
├─────────────────────────┤
│     Item/Question       │
├─────────────────────────┤
│     Tools               │
├─────────────────────────┤
│     Footer              │
└─────────────────────────┘
```

**Use Cases**: Mobile devices, simple items without passages

#### Two-Column (Passage Left, Item Right)

```
┌─────────────────────────────────────┐
│     Header + Navigation             │
├──────────────┬──────────────────────┤
│              │                      │
│   Passage    │   Item/Question      │
│              │                      │
│  (resizable) │                      │
│              │                      │
├──────────────┴──────────────────────┤
│     Tools + Footer                  │
└─────────────────────────────────────┘
```

**Use Cases**: Items with passages, desktop/tablet, reading comprehension

#### Three-Column (Extended)

```
┌────────────────────────────────────────────┐
│     Header + Navigation                    │
├──────────┬──────────────┬──────────────────┤
│          │              │                  │
│ Passage  │    Item      │   Notes/Rubric   │
│          │              │                  │
│          │              │                  │
├──────────┴──────────────┴──────────────────┤
│     Tools + Footer                         │
└────────────────────────────────────────────┘
```

**Use Cases**: Complex items, note-taking, instructor scoring

#### Vertical Stacked

```
┌─────────────────────────┐
│     Header + Nav        │
├─────────────────────────┤
│     Passage (top)       │
├─────────────────────────┤
│     Item (bottom)       │
├─────────────────────────┤
│     Tools + Footer      │
└─────────────────────────┘
```

**Use Cases**: Short passages, math problems, narrow screens

### Custom Template Definition

Templates can be defined declaratively:

```typescript
const customTemplate = {
  id: 'my-layout',
  type: 'custom',
  regions: {
    left: {
      type: 'passage',
      width: '40%',
      minWidth: 300,
      resizable: true,
      scrollable: true
    },
    center: {
      type: 'item',
      flex: 1,
      scrollable: true
    },
    right: {
      type: 'tools',
      width: '25%',
      collapsible: true,
      visible: { when: 'hasTools', value: true }
    }
  },
  breakpoints: {
    mobile: {
      regions: {
        left: { visible: false },
        right: { visible: false }
      }
    }
  }
};
```

### Template Selection Strategies

**Content-Based Strategy**:

```typescript
function selectByContent(context: LayoutContext): LayoutTemplate {
  const hasPassage = context.passage !== null;
  const hasRubric = context.rubrics.length > 0;
  const itemType = context.currentItem?.type;

  if (hasPassage && hasRubric) {
    return getTemplate('three-column-with-rubric');
  } else if (hasPassage) {
    return getTemplate('passage-left-item-right');
  } else if (itemType === 'essay') {
    return getTemplate('full-width-essay');
  } else {
    return getTemplate('single-column-standard');
  }
}
```

**Device-Based Strategy**:

```typescript
function selectByDevice(context: LayoutContext): LayoutTemplate {
  const width = window.innerWidth;

  if (width < 768) {
    return getTemplate('single-column-standard');
  } else if (width < 1024) {
    return getTemplate('passage-left-item-right');
  } else {
    return getTemplate('three-column-with-notes');
  }
}
```

---

## Tools and Accommodations

### Tool Scope Levels

The system supports three distinct tool scopes:

```
┌─────────────────────────────────────────┐
│ ASSESSMENT-LEVEL TOOLS                  │
│ Apply uniformly to all items            │
│ Examples: Color scheme, font size       │
│ Managed by: ThemeProvider               │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ CROSS-LEVEL TOOLS                       │
│ Persist across items, item-specific use │
│ Examples: TTS, Highlighter              │
│ Managed by: Persistent services         │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ ITEM-LEVEL TOOLS                        │
│ Per-item state and behavior             │
│ Examples: Calculator, Answer eliminator │
│ Managed by: Tool components             │
└─────────────────────────────────────────┘
```

### Assessment-Level Tools

**Characteristics**:

- Apply uniformly to all items
- Persist across navigation
- Cannot be restricted per-item
- Implemented via CSS custom properties

**Examples**: Color scheme, font size, high contrast mode

**Architecture**:

```typescript
interface ThemeProvider {
  applyTheme(config: ThemeConfig): void;
  // Sets CSS variables on document root
  // Affects ALL items, passages, rubrics simultaneously
}
```

### Cross-Level Tools

**Characteristics**:

- Persistent service across navigation
- Item-specific context
- Coordinated cleanup on navigation
- Both global and item state

**Examples**: Text-to-speech, highlighter/annotations, dictionary lookup

**Architecture**:

```typescript
interface TTSService {
  state: PlaybackState;        // Assessment-level
  currentText: string;          // Item-specific

  speak(text: string): Promise<void>;
}

// Navigation coordination
sessionManager.navigate(index) {
  if (this.ttsSpeaking) {
    this.stopTTS();  // Cross-level cleanup
  }
  // Load new item
}
```

### Item-Level Tools

**Characteristics**:

- Per-item state (isolated)
- Item-specific availability rules
- State persistence per item ID
- Self-contained operation

**Examples**: Answer eliminator, calculator modes, ruler, protractor

**Architecture**:

```typescript
interface AnswerEliminatorTool {
  eliminatedOptions: Set<string>;  // Item-specific
  storageKey: string;              // Derived from item ID

  onMount() {
    // Load item-specific state from storage
    const saved = storage.get(`eliminated_${itemId}`);
    this.eliminatedOptions = new Set(saved);
  }

  eliminateOption(optionId: string) {
    this.eliminatedOptions.add(optionId);
    storage.set(`eliminated_${itemId}`, [...this.eliminatedOptions]);
  }
}
```

### Tool Coordination

**Separation of Concerns**:

1. **AccommodationResolver** - Determines WHICH tools are available
2. **ToolCoordinator** - Manages visibility and z-index

**Accommodation Resolution**:

```typescript
interface ResolvedToolConfig {
  toolType: string;
  allowed: boolean;
  required: boolean;
  resolvedFrom: 'roster-block' | 'item-requirement' | 'student-accommodation';
  config?: ToolSpecificConfig;
}

// Precedence: roster block > item restriction > item requirement > student accommodation
```

**Tool Coordination**:

```typescript
enum ZIndexLayer {
  BASE = 0,           // PIE content
  TOOL = 1000,        // Non-modal tools (ruler, protractor)
  MODAL = 2000,       // Modal tools (calculator, dictionary)
  CONTROL = 3000,     // Drag handles, resize controls
  HIGHLIGHT = 4000    // TTS and annotation highlights
}

interface ToolCoordinator {
  registerTool(id: string, layer: ZIndexLayer): void;
  showTool(id: string): void;
  hideTool(id: string): void;
  bringToFront(element: HTMLElement): void;
}
```

### Tool Placement in Templates

Tools are **orthogonal to layout choice** - same tool configuration works across all templates:

```typescript
<LayoutTemplate>
  <PassageSlot region="left" />

  <ItemSlot region="center">
    {#if resolvedTools.includes('answerEliminator')}
      <tool-answer-eliminator coordinator={toolCoordinator} />
    {/if}
  </ItemSlot>

  <ToolSlot region="right">
    {#if resolvedTools.includes('calculator')}
      <tool-calculator coordinator={toolCoordinator} />
    {/if}
    {#if resolvedTools.includes('tts')}
      <tool-text-to-speech ttsService={ttsService} />
    {/if}
  </ToolSlot>
</LayoutTemplate>
```

### Tool Lifecycle

```
Assessment Initialization
  ↓
Create Services:
  - ToolCoordinator
  - ThemeProvider
  - TTSService
  - HighlightCoordinator
  ↓
Navigate to Item
  ↓
Resolve Tools for Item
  (student + roster + item requirements)
  ↓
Layout Renders with Resolved Tools:
  - Assessment-level active (color, font)
  - Cross-level tools mount (TTS, annotations)
  - Item-level tools mount (calculator, eliminator)
  ↓
Each Tool Self-Registers with Coordinator
  ↓
Navigate to Next Item
  ↓
Cross-Level Cleanup:
  - TTSService.stop()
  - Clear TTS highlights
  - Preserve annotations
  ↓
Load New Item with Its Resolved Tools
```

---

## Integration Patterns

### Basic Integration

```typescript
// Create session manager
const sessionManager = new AssessmentSessionManager({
  assessment: myAssessment,
  loadItem: myItemLoader,
  navigationMode: 'nonlinear'
});

// Create layout engine
const layoutEngine = new LayoutEngine();

// Register templates
layoutEngine.registerTemplate(singleColumnTemplate);
layoutEngine.registerTemplate(twoColumnTemplate);

// Configure
layoutEngine.setLayoutConfig({
  defaultTemplate: 'passage-left-item-right',
  selectionStrategy: 'content-based'
});

// Subscribe to state changes
sessionManager.onItemChange((item) => {
  const context = buildLayoutContext(sessionManager);
  const template = layoutEngine.selectTemplate(context);
  renderTemplate(template, context);
});

// Start assessment
await sessionManager.start();
```

### Reactive State Pattern

Layout components subscribe to session manager state:

```typescript
// In layout component
onMount(() => {
  const unsubNav = sessionManager.onNavigationChange((state) => {
    navigationState = state;
  });

  const unsubItem = sessionManager.onItemChange((item) => {
    currentItem = item;
    passage = sessionManager.getCurrentPassage();
    rubrics = sessionManager.getCurrentRubricBlocks();
  });

  onDestroy(() => {
    unsubNav();
    unsubItem();
  });
});
```

### User Action Dispatch

Layout dispatches actions back to session manager:

```typescript
function handleNextClick() {
  sessionManager.navigateNext();
}

function handlePreviousClick() {
  sessionManager.navigatePrevious();
}

function handleJumpToItem(index: number) {
  sessionManager.navigate(index);
}
```

### Service Access Pattern

Layout accesses services through session manager:

```typescript
const toolCoordinator = sessionManager.getToolCoordinator();
const themeProvider = sessionManager.getThemeProvider();
const ttsService = sessionManager.getTTSService();

// Use in layout
function handleThemeChange(theme: ThemeConfig) {
  themeProvider.applyTheme(theme);
}

function handleTTSToggle(rootElement: HTMLElement) {
  ttsService.toggle(rootElement);
}
```

---

## Examples

### Basic Responsive Layout

```typescript
{
  defaultTemplate: 'passage-left-item-right',
  responsive: {
    mobile: 'single-column-standard',
    tablet: 'passage-left-item-right',
    desktop: 'three-column-with-notes'
  }
}
```

### Content-Based Selection

```typescript
// Assessment automatically selects template based on content
{
  selectionStrategy: 'content-based',
  // Passages → two-column
  // Essays → full-width
  // Simple questions → single-column
}
```

### Item-Specific Override

```typescript
// In item configuration
{
  id: 'essay-question-1',
  configuration: {
    template: 'full-width-essay',
    hints: {
      hidePassageOnMobile: true
    }
  }
}
```

### Custom Template Registration

```typescript
const myTemplate = defineLayoutTemplate({
  id: 'custom-side-by-side',
  type: 'two-column',
  regions: {
    left: {
      type: 'passage',
      width: '50%',
      scrollable: true
    },
    right: {
      type: 'item',
      width: '50%',
      scrollable: true
    }
  }
});

layoutEngine.registerTemplate(myTemplate);
```

### Student Preferences

```typescript
{
  defaultTemplate: studentPrefs.preferredTemplate || 'default',
  features: {
    resizablePanels: true,
    persistPanelWidths: true
  },
  onPreferencesChanged: (prefs) => {
    saveStudentPreferences(userId, prefs);
  }
}
```

---

## Appendix: Design Decisions

### Why Three Layers?

**Separation of concerns** enables:

- Session manager testing without UI
- Layout engine testing with mock state
- Different layouts using same session manager
- Multiple concurrent views (e.g., instructor + student)

### Why Template-Based?

**Configuration over code** provides:

- Non-developers can create layouts via JSON
- Visual template builders possible
- Template marketplace potential
- A/B testing of layouts
- Dynamic template selection

### Why Framework-Agnostic Content?

**PIE players as web components** ensures:

- Works in any framework (React, Vue, Angular, Svelte)
- No framework lock-in for products
- Browser-native performance
- Long-term maintainability

### Why Reactive State?

**Observer pattern** provides:

- Automatic UI updates on state change
- No manual polling required
- Clean subscription management
- Easy to add new listeners

---

## References

- **Assessment Toolkit**: `/packages/assessment-toolkit/README.md`
- **Tools Architecture**: `/docs/tools-and-accomodations/architecture.md`
- **QTI Specification**: http://www.imsglobal.org/question/index.html
- **CSS Custom Highlight API**: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
