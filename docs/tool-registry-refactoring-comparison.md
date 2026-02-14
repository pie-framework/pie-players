# Tool Registry Refactoring - Current vs. Proposed Architecture

**Date**: 2026-02-13
**Status**: Design Proposal
**Purpose**: Compare current tool architecture with proposed registry-based system

---

## Executive Summary

The current architecture has strong foundations but has grown organically, resulting in:
- Tool button duplication ("inline" vs. regular tool components)
- Hardcoded tool placement logic in multiple toolbar components
- No central tool metadata for integrators to query
- Limited flexibility for integrators to customize tool visibility
- Tight coupling between PNP vocabulary and PIE tool IDs

The proposed refactoring introduces a **Tool Registry** system that:
- Eliminates duplication through button factories
- Centralizes tool metadata for integrator discovery
- Enables context-aware visibility decisions per tool
- Allows integrators to override/extend tool behavior
- Makes PNP mapping configurable rather than hardcoded

**Impact**: This is an architectural enhancement, not a paradigm shift. Core services (ToolCoordinator, PNP resolution, etc.) remain intact.

---

## Current Architecture

### Core Components (Staying)

#### 1. ToolCoordinator (No Change) ✅

**Purpose**: Manages z-index layering and visibility for floating tool instances

**Current API** (`packages/assessment-toolkit/src/services/ToolCoordinator.ts`):
```typescript
interface IToolCoordinator {
  registerTool(id: string, name: string, element?: HTMLElement, layer?: ZIndexLayer): void;
  unregisterTool(id: string): void;
  showTool(id: string): void;
  hideTool(id: string): void;
  toggleTool(id: string): void;
  isToolVisible(id: string): boolean;
  bringToFront(element: HTMLElement): void;
  subscribe(listener: () => void): () => void;
}
```

**Status**: ✅ This service is well-designed and stays unchanged

**What it does**:
- Manages which tool instances are visible
- Controls z-index layering (BASE/TOOL/MODAL/CONTROL/HIGHLIGHT)
- Notifies subscribers of visibility changes
- Brings tools to front on interaction

**What it does NOT do**:
- ❌ Doesn't know about tool metadata (name, description, icon)
- ❌ Doesn't know about PNP profiles
- ❌ Doesn't decide which tools should be available
- ❌ Doesn't handle button rendering
- ❌ Doesn't know about tool placement (headers vs. toolbars)

---

#### 2. PNPToolResolver (Minor Update) ⚠️

**Purpose**: Resolves which tools are allowed based on PNP hierarchy

**Current API** (`packages/assessment-toolkit/src/services/PNPToolResolver.ts`):
```typescript
class PNPToolResolver {
  resolveTools(assessment: AssessmentEntity, itemRef?: AssessmentItemRef): ResolvedToolConfig[];
  isToolEnabled(toolId: string, assessment: AssessmentEntity, itemRef?: AssessmentItemRef): boolean;
  isToolRequired(toolId: string, assessment: AssessmentEntity, itemRef?: AssessmentItemRef): boolean;
  getEnabledTools(assessment: AssessmentEntity, itemRef?: AssessmentItemRef): string[];
}
```

**Precedence Hierarchy** (stays the same):
1. District block (absolute veto)
2. Test administration override
3. Item restriction
4. Item requirement
5. District requirement
6. PNP supports

**Status**: ⚠️ Needs minor update to use ToolRegistry instead of hardcoded PNPMapper

**What changes**:
- Uses ToolRegistry to resolve PNP support IDs → tool IDs (instead of hardcoded map)
- Otherwise logic stays the same

---

#### 3. PNPMapper (Becomes ToolRegistry Method) 🔄

**Current** (`packages/assessment-toolkit/src/services/PNPMapper.ts`):
```typescript
// Hardcoded mapping
const PNP_TO_PIE_TOOL_MAP: Record<string, string> = {
  'textToSpeech': 'pie-tool-text-to-speech',
  'calculator': 'pie-tool-calculator',
  // ... hardcoded
};

function mapPNPSupportToToolId(supportId: string): string | null;
function registerCustomPNPMapping(supportId: string, toolId: string): void;
```

**Proposed**: Move this into ToolRegistry
```typescript
// ToolRegistry handles PNP mapping as part of registration
class ToolRegistry {
  register(registration: ToolRegistration): void {
    // Tool declares its PNP support IDs
    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        this.pnpToToolMap.set(pnpId, registration.toolId);
      }
    }
  }

  getToolIdFromPNP(pnpSupportId: string): string | undefined;
}
```

**Benefit**: PNP mapping happens automatically during tool registration, no separate hardcoded file

---

### Current Problems

#### Problem 1: Tool Button Duplication

**Current**:
```
packages/tool-calculator/tool-calculator.svelte        (actual tool)
packages/tool-calculator-inline/tool-calculator-inline.svelte  (just a button!)

packages/tool-tts-inline/tool-tts-inline.svelte        (just a button!)
```

**Issues**:
- Separate components for buttons vs. tools
- Button logic duplicated per tool
- Changes require updating multiple files
- More packages to maintain/version

**Current Button** (`tool-calculator-inline.svelte:98-110`):
```svelte
<button
  class="calculator-inline"
  onclick={handleToggle}
  aria-label={calculatorVisible ? 'Close calculator' : 'Open calculator'}>
  <svg>...</svg>
</button>
```

**Proposed**: Single generic button component, tool provides button definition

---

#### Problem 2: Hardcoded Toolbar Logic

**Current** - QuestionToolBar (`packages/assessment-toolkit/src/components/QuestionToolBar.svelte`):
```svelte
{#if showCalculator}
  <pie-tool-calculator-inline
    tool-id="calculator-inline-{itemId}"
    calculator-type="scientific" />
{/if}

{#if showTTS}
  <pie-tool-tts-inline
    tool-id="tts-{itemId}"
    catalog-id={catalogId} />
{/if}

{#if showAnswerEliminator}
  <button onclick={toggleAnswerEliminator}>
    <svg>...</svg>
  </button>
{/if}
```

**Issues**:
- Each toolbar hardcodes which tools it renders
- Adding new tools requires modifying toolbar code
- No way for integrators to inject custom tools
- Visibility logic scattered across toolbar components

**Similar duplication** in:
- `SectionToolsToolbar.svelte` (different hardcoded tools)
- `ItemPanel.svelte` (more hardcoded rendering)

---

#### Problem 3: No Tool Metadata Registry

**Current**: No central place to query tool information

**What integrators need**:
```typescript
// Integrator wants to build PNP profile UI
// "What tools are available? What are their names/descriptions?"

// Currently: No way to do this!
// They have to hardcode tool lists themselves
```

**Also needed for**:
- Generating tool selection UI
- Building documentation
- Auto-generating test cases
- Debugging tool configurations

---

#### Problem 4: No Context-Aware Visibility

**Current**: Visibility logic is hardcoded and basic

**QuestionToolBar** (`QuestionToolBar.svelte:182-188`):
```typescript
let showAnswerEliminator = $derived(
  enabledTools.includes('answerEliminator') &&
  toolCoordinator &&
  hasCompatibleChoices &&  // Basic content check
  toolsLoaded
);
```

**Issues**:
- Basic content detection (just checks for multiple-choice elements)
- No way for integrators to provide custom detection
- No rich context (can't check element.model for math expressions)
- Hard to extend for new content types

**What's missing**:
- Calculator should know if element contains math
- TTS should know if content has text to read
- Tools should access full item/element context
- Integrators should be able to override detection logic

---

#### Problem 5: Tool Placement is Hardcoded

**Current**: Each toolbar decides what it renders

**QuestionToolBar**: Renders calculator, TTS, answer eliminator
**SectionToolsToolbar**: Renders calculator, graph, periodic table, protractor, ruler
**ItemPanel**: Renders tool instances

**Issues**:
- Want calculator in question header? Hardcoded in QuestionToolBar
- Want to show it elsewhere? Modify/create new toolbar
- Want per-passage tools? Create new PassageToolbar component
- No flexibility without code changes

---

## Proposed Architecture

### What Stays the Same ✅

#### 1. ToolCoordinator (Unchanged)
- Still manages tool instance visibility and z-index
- Still handles show/hide/toggle
- Still notifies subscribers
- **No API changes**

#### 2. PNPToolResolver Logic (Unchanged)
- Still implements same precedence hierarchy
- Still resolves district/test/item/student conflicts
- Still returns which tools are allowed
- **Only change**: Uses ToolRegistry for PNP→tool mapping instead of hardcoded map

#### 3. Tool Web Components (Minimal Changes)
- Calculator, TTS, Ruler, etc. stay as web components
- Still register with ToolCoordinator
- Still manage their own UI and state
- **Only change**: Export a registration object alongside component

#### 4. Core Services (Unchanged)
- HighlightCoordinator ✅
- TTSService ✅
- AccessibilityCatalogResolver ✅
- SSMLExtractor ✅
- ThemeProvider ✅

---

### What Changes 🔄

#### 1. NEW: Tool Registry

**Purpose**: Central registration of tool metadata and factories

**New file**: `packages/assessment-toolkit/src/services/ToolRegistry.ts`

```typescript
export interface ToolRegistration {
  // Metadata (for integrator discovery)
  toolId: string;
  name: string;
  description: string;
  icon: string | ((context: ToolContext) => string);

  // Levels this tool operates at
  supportedLevels: ('assessment' | 'section' | 'item' | 'passage' | 'element')[];

  // PNP mapping (tools declare what PNP IDs they handle)
  pnpSupportIds?: string[];

  // Context-aware visibility (new!)
  isVisibleInContext(context: ToolContext): boolean;

  // Button factory (new!)
  createButton(context: ToolContext, options: ButtonOptions): ToolButtonDefinition;

  // Tool instance factory (new!)
  createToolInstance(context: ToolContext, options: ToolOptions): HTMLElement;

  // Configuration resolver
  getConfiguration?(context: ToolContext): any;
}

export class ToolRegistry {
  private registrations = new Map<string, ToolRegistration>();
  private pnpToToolMap = new Map<string, string>();

  register(registration: ToolRegistration): void {
    this.registrations.set(registration.toolId, registration);

    // Index PNP support IDs
    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        this.pnpToToolMap.set(pnpId, registration.toolId);
      }
    }
  }

  get(toolId: string): ToolRegistration | undefined;
  getToolIdFromPNP(pnpSupportId: string): string | undefined;
  getAll(): ToolRegistration[];
  getByLevel(level: ToolLevel): ToolRegistration[];
  getVisibleTools(context: ToolContext, allowedToolIds: string[]): ToolRegistration[];
}
```

**Benefits**:
- ✅ Single source of truth for tool metadata
- ✅ Integrators can query available tools
- ✅ Integrators can register custom tools
- ✅ Integrators can override tool behavior
- ✅ PNP mapping is automatic (tools declare their PNP IDs)

---

#### 2. NEW: Rich Tool Context

**Purpose**: Provide tools with full context for visibility decisions

**New file**: `packages/assessment-toolkit/src/services/tool-context.ts`

```typescript
export type ToolLevel = 'assessment' | 'section' | 'item' | 'passage' | 'element';

export interface BaseToolContext {
  level: ToolLevel;

  // QTI 3.0 assessment (contains PNP)
  assessment: AssessmentEntity;
  currentItemRef?: AssessmentItemRef;

  // Services
  coordinator?: IToolCoordinator;
  ttsService?: ITTSService;
  highlightCoordinator?: IHighlightCoordinator;
  providerRegistry?: ToolProviderRegistry;
}

export interface ItemContext extends BaseToolContext {
  level: 'item';
  assessmentId: string;
  sectionId: string;
  itemId: string;
  item: ItemEntity;  // Full item with markup, elements, config
}

export interface ElementContext extends BaseToolContext {
  level: 'element';
  assessmentId: string;
  sectionId: string;
  itemId: string;
  elementId: string;
  element: PieModel;  // Full element with model, markup, correctResponse
}

// ... similar for Passage, Section, Assessment
```

**Benefits**:
- ✅ Tools can make smart visibility decisions
- ✅ Tools can access item metadata
- ✅ Tools can inspect element models for math content
- ✅ Tools can check PNP profile
- ✅ Type-safe context per level

---

#### 3. NEW: Generic ToolButton Component

**Purpose**: Single button component that works for all tools

**New file**: `packages/assessment-toolkit/src/components/ToolButton.svelte`

```svelte
<script lang="ts">
  let {
    registration,  // From registry
    context,       // Rich context
    size = 'md'
  } = $props();

  // Tool decides visibility based on context
  let isVisible = $derived(registration.isVisibleInContext(context));

  // Create button from factory
  let buttonDef = $derived(registration.createButton(context, { size }));

  // Track active state
  let isActive = $state(false);
  $effect(() => {
    return context.coordinator?.subscribe(() => {
      isActive = context.coordinator.isToolVisible(buttonDef.toolInstanceId);
    });
  });
</script>

{#if isVisible}
  <button
    class="tool-button tool-button--{size}"
    class:tool-button--active={isActive}
    onclick={() => context.coordinator?.toggleTool(buttonDef.toolInstanceId)}>
    {@html buttonDef.icon}
  </button>
{/if}
```

**Replaces**:
- ❌ `tool-calculator-inline.svelte` (delete)
- ❌ `tool-tts-inline.svelte` (delete)
- ❌ Hardcoded buttons in toolbars

---

#### 4. UPDATED: Toolbar Components

**Current** - QuestionToolBar hardcodes everything:
```svelte
<!-- 98 lines of hardcoded button rendering -->
{#if showCalculator}
  <pie-tool-calculator-inline ... />
{/if}
{#if showTTS}
  <pie-tool-tts-inline ... />
{/if}
{#if showAnswerEliminator}
  <button ...>...</button>
{/if}
```

**Proposed** - QuestionToolBar becomes generic:
```svelte
<script lang="ts">
  let {
    context,        // ItemContext
    registry,       // Tool registry
    allowedToolIds, // From PNP resolution
    size = 'md'
  } = $props();

  // Get tools that are:
  // 1. PNP-allowed (allowedToolIds)
  // 2. Context-relevant (tool.isVisibleInContext)
  let visibleTools = $derived(
    registry.getVisibleTools(context, allowedToolIds)
  );
</script>

<div class="question-toolbar">
  {#each visibleTools as registration}
    <ToolButton {registration} {context} {size} />
  {/each}
</div>
```

**Benefits**:
- ✅ Reduced from ~400 lines to ~30 lines
- ✅ No hardcoded tool list
- ✅ Works with custom tools automatically
- ✅ Integrators can override visibility
- ✅ Tools self-filter based on context

---

#### 5. NEW: Tool Registration Files

**Purpose**: Each tool exports its registration

**New pattern**:
```
packages/tool-calculator/
├── tool-calculator.svelte           (exists - web component)
├── registration.ts                   (NEW - registration)
└── index.ts                          (NEW - exports both)
```

**Example** - `packages/tool-calculator/registration.ts`:
```typescript
import type { ToolRegistration, ToolContext } from '@pie-players/pie-assessment-toolkit';

export const calculatorRegistration: ToolRegistration = {
  toolId: 'pie-tool-calculator',
  name: 'Calculator',
  description: 'Scientific, basic, and graphing calculator',
  icon: '<svg>...</svg>',

  supportedLevels: ['section', 'item', 'element'],

  // Tools declare which PNP IDs they handle
  pnpSupportIds: ['calculator', 'scientificCalculator', 'graphingCalculator', 'basicCalculator'],

  // Context-aware visibility hook
  isVisibleInContext(context: ToolContext): boolean {
    const { level } = context;

    switch (level) {
      case 'passage':
        return false; // Never show for passages

      case 'item':
        const item = (context as ItemContext).item;
        return item.type === 'question'; // Not for stimuli

      case 'element':
        const element = (context as ElementContext).element;
        return hasMathContent(element); // Check element model

      default:
        return true;
    }
  },

  createButton(context: ToolContext, options): ToolButtonDefinition {
    return {
      toolInstanceId: getToolInstanceId(context),
      icon: this.icon,
      label: this.name,
      ariaLabel: 'Toggle calculator'
    };
  },

  createToolInstance(context: ToolContext, options): HTMLElement {
    const element = document.createElement('pie-tool-calculator');
    // Configure and return
    return element;
  }
};

// Integrator can override
export function hasMathContent(element: any): boolean {
  return element?.markup?.includes('math-inline') ||
         element?.markup?.includes('latex') ||
         element?.correctResponse?.type === 'number';
}
```

**Benefits**:
- ✅ Tool metadata in one place
- ✅ Visibility logic with full context
- ✅ Integrators can override `hasMathContent`
- ✅ No duplication

---

## Side-by-Side Comparison

### Feature Matrix

| Feature | Current | Proposed | Benefit |
|---------|---------|----------|---------|
| **ToolCoordinator** | ✅ Manages tool instances | ✅ Unchanged | Stable foundation |
| **PNP Resolution** | ✅ Hierarchy logic | ✅ Unchanged logic | Proven system |
| **Tool Metadata** | ❌ Not centralized | ✅ Tool Registry | Integrator discovery |
| **PNP Mapping** | ⚠️ Hardcoded file | ✅ Registry-based | Flexible, configurable |
| **Tool Buttons** | ❌ Duplicate components | ✅ Single generic | No duplication |
| **Toolbar Rendering** | ❌ Hardcoded per toolbar | ✅ Generic ToolButtonGroup | Reusable |
| **Visibility Logic** | ⚠️ Basic checks | ✅ Context-aware hooks | Smart decisions |
| **Context Richness** | ⚠️ Limited | ✅ Full assessment/item/element | Better decisions |
| **Custom Tools** | ⚠️ Possible but awkward | ✅ First-class via registry | Easy to add |
| **Override Behavior** | ❌ Edit framework code | ✅ Register override | Extensible |

### Code Impact

| Component | Current LoC | Proposed LoC | Change |
|-----------|-------------|--------------|--------|
| `tool-calculator-inline.svelte` | 255 | DELETE | -255 |
| `tool-tts-inline.svelte` | 417 | DELETE | -417 |
| `QuestionToolBar.svelte` | 407 | ~50 | -357 |
| `SectionToolsToolbar.svelte` | ~300 | ~50 | -250 |
| `PNPMapper.ts` | 111 | DELETE | -111 |
| **NEW** `ToolRegistry.ts` | - | 200 | +200 |
| **NEW** `tool-context.ts` | - | 150 | +150 |
| **NEW** `ToolButton.svelte` | - | 80 | +80 |
| **NEW** `ToolButtonGroup.svelte` | - | 50 | +50 |
| **NEW** Tool registrations (×10 tools) | - | 1000 | +1000 |
| **TOTAL** | - | - | **Net: -910 lines** |

---

## Integration Patterns

### Current: Integrator Has Limited Control

```typescript
// Current: Integrator uses section player
<pie-section-player
  {assessment}
  {section}
  ttsService={ttsService}
  toolCoordinator={toolCoordinator}
/>

// Tools are hardcoded in section player internals
// Can't customize which tools appear where
// Can't add custom tools easily
// Can't override visibility logic
```

**Integrator pain points**:
1. "How do I add my custom periodic table tool?"
   → Must modify framework code

2. "How do I show calculator only for math items?"
   → Must modify QuestionToolBar.svelte

3. "What tools are available?"
   → Must read framework code, no API

4. "How do I build a PNP profile UI?"
   → Must hardcode tool lists

---

### Proposed: Integrator Has Full Control

```typescript
// 1. Create/customize registry
import { createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';

const registry = createDefaultToolRegistry();

// Add custom tool
registry.register({
  toolId: 'my-periodic-table',
  name: 'Periodic Table',
  description: 'Custom periodic table',
  icon: '<svg>...</svg>',
  supportedLevels: ['section', 'item'],
  pnpSupportIds: ['x-my-periodic-table'],
  isVisibleInContext: (ctx) => ctx.level === 'section' || isChemistryItem(ctx),
  createButton: (ctx, opts) => ({ ... }),
  createToolInstance: (ctx, opts) => { ... }
});

// Override calculator visibility
const calcReg = registry.get('pie-tool-calculator');
registry.register({
  ...calcReg,
  isVisibleInContext: (ctx) => {
    // Use MY math detection, not PIE's
    return myAdvancedMathDetection(ctx);
  }
});

// 2. Use custom registry
<pie-section-player
  {assessment}
  {section}
  toolRegistry={registry}
  {toolCoordinator}
  {ttsService}
/>

// 3. Tools appear automatically based on:
//    - PNP profile (which are allowed)
//    - Context (which are relevant)
//    - Registration (metadata & factories)
```

**Integrator benefits**:
1. "How do I add my custom tool?"
   → `registry.register(myToolRegistration)`

2. "How do I customize visibility?"
   → Override `isVisibleInContext` in registration

3. "What tools are available?"
   → `registry.getAll()` returns metadata

4. "How do I build PNP UI?"
   → Use `registry.getAll()` for tool names/descriptions

---

## Example: Calculator Visibility

### Current Implementation

**In QuestionToolBar** (`QuestionToolBar.svelte:188`):
```typescript
let showCalculator = $derived(
  enabledTools.includes('calculator') &&
  toolCoordinator &&
  toolsLoaded
);
```

**Issues**:
- ❌ No content inspection (shows for all items)
- ❌ No element-level granularity
- ❌ Can't check if item has math
- ❌ Can't override without editing framework

---

### Proposed Implementation

**In Tool Registration** (`packages/tool-calculator/registration.ts`):
```typescript
export const calculatorRegistration: ToolRegistration = {
  // ... metadata

  isVisibleInContext(context: ToolContext): boolean {
    const { level } = context;

    switch (level) {
      case 'passage':
        // Calculators never relevant for passages
        return false;

      case 'item':
        const item = (context as ItemContext).item;

        // Only for questions, not stimuli
        if (item.type !== 'question') return false;

        // Check if item has math elements (integrator can override this)
        return item.elements?.some(el => hasMathContent(el));

      case 'element':
        // Element-level: check this specific element
        const element = (context as ElementContext).element;
        return hasMathContent(element);

      case 'section':
        // Always available at section level
        return true;

      default:
        return false;
    }
  }
};

// Default implementation (integrator can override)
export function hasMathContent(element: any): boolean {
  return element?.markup?.includes('math-inline') ||
         element?.markup?.includes('latex') ||
         element?.pieType === 'number-line' ||
         element?.correctResponse?.type === 'number';
}
```

**Integrator Override**:
```typescript
// Integrator's more sophisticated math detection
const registry = createDefaultToolRegistry();

const calcReg = registry.get('pie-tool-calculator');
registry.register({
  ...calcReg,
  isVisibleInContext(context: ToolContext): boolean {
    if (context.level === 'element') {
      const element = (context as ElementContext).element;

      // Use MY advanced detection
      return myAdvancedMathDetection(element) ||
             element.metadata?.subject === 'math' ||
             element.model?.requiresCalculation === true;
    }

    // Otherwise use default logic
    return calcReg.isVisibleInContext(context);
  }
});
```

**Benefits**:
- ✅ Smarter visibility (content-aware)
- ✅ Element-level granularity
- ✅ Integrator can override detection
- ✅ No framework code changes needed

---

## What Gets Better

### 1. Eliminates Duplication ✅

**Before**:
- 2 calculator components (inline + regular)
- 2 TTS components (inline + regular)
- ~672 lines of duplicate button code

**After**:
- 1 generic button component
- Tools provide button definition
- ~80 lines total

**Savings**: -592 lines

---

### 2. Enables Custom Tools ✅

**Before**:
```typescript
// Integrator wants custom tool
// Must: fork framework, modify toolbars, rebuild, maintain fork
```

**After**:
```typescript
// Integrator wants custom tool
const registry = createDefaultToolRegistry();

registry.register({
  toolId: 'my-custom-tool',
  name: 'My Tool',
  description: 'Custom functionality',
  icon: '<svg>...</svg>',
  supportedLevels: ['item'],
  pnpSupportIds: ['x-my-tool'],
  isVisibleInContext: (ctx) => myLogic(ctx),
  createButton: (ctx, opts) => ({ ... }),
  createToolInstance: (ctx, opts) => { ... }
});

// Works automatically in all toolbars
```

**Benefit**: Custom tools are first-class citizens

---

### 3. Context-Aware Visibility ✅

**Before**:
```typescript
// QuestionToolBar checks if multiple-choice exists (line 58-72)
function hasCompatibleAnswerChoices(element: HTMLElement): boolean {
  return element.querySelector('.corespring-checkbox, .corespring-radio-button') !== null;
}

// That's it - basic DOM query
```

**After**:
```typescript
// Tool registration with rich context
isVisibleInContext(context: ToolContext): boolean {
  if (context.level === 'element') {
    const element = (context as ElementContext).element;

    // Access full element model
    return element.pieType === 'multiple-choice' ||
           element.pieType === 'inline-dropdown' ||
           element.pieType === 'ebsr' ||
           element.model?.responseType === 'choice';
  }

  if (context.level === 'item') {
    const item = (context as ItemContext).item;

    // Access item elements before rendering
    return item.elements?.some(el =>
      el.pieType === 'multiple-choice' ||
      el.pieType === 'inline-dropdown'
    );
  }

  return false;
}
```

**Benefits**:
- ✅ Access element models (not just rendered DOM)
- ✅ Check before rendering (better UX)
- ✅ Type-safe context
- ✅ Richer decisions

---

### 4. Tool Discovery API ✅

**Before**:
```typescript
// No API - integrator can't query available tools
// Must hardcode tool lists everywhere
```

**After**:
```typescript
// Integrator can query registry
const registry = createDefaultToolRegistry();

// Build PNP profile UI
const availableTools = registry.getAll();
/*
[
  { toolId: 'pie-tool-calculator', name: 'Calculator', description: '...' },
  { toolId: 'pie-tool-text-to-speech', name: 'Text-to-Speech', description: '...' },
  // ... all tools with metadata
]
*/

// Build accommodation selection UI
const toolChoices = availableTools.map(tool => ({
  label: tool.name,
  description: tool.description,
  pnpIds: tool.pnpSupportIds,
  icon: tool.icon
}));

// Generate PNP profile from selections
const pnp: PersonalNeedsProfile = {
  supports: selectedTools.flatMap(t => t.pnpIds)
};
```

**Benefit**: Integrators can build rich UIs without hardcoding

---

### 5. Flexible Placement ✅

**Before**: Tool placement is hardcoded in framework

- Calculator appears in QuestionToolBar (line 276-283)
- Calculator appears in SectionToolsToolbar (hardcoded)
- Want it somewhere else? Create new toolbar component

**After**: Integrators decide placement via composition

```svelte
<!-- Integrator's custom layout -->

<!-- Option 1: Use built-in toolbar -->
<div class="question-header">
  <h2>{item.title}</h2>
  <pie-tool-button-group {context} {registry} {allowedToolIds} />
</div>

<!-- Option 2: Custom placement -->
<div class="my-custom-header">
  <h2>{item.title}</h2>

  <div class="left-tools">
    <ToolButton registration={ttsReg} {context} />
  </div>

  <div class="right-tools">
    <ToolButton registration={calcReg} {context} />
    <ToolButton registration={elimReg} {context} />
  </div>
</div>

<!-- Option 3: Vertical sidebar -->
<aside class="tool-palette">
  {#each visibleTools as reg}
    <ToolButton registration={reg} {context} size="lg" />
  {/each}
</aside>

<!-- Option 4: Floating menu -->
<FloatingMenu>
  <ToolButtonGroup {context} {registry} {allowedToolIds} />
</FloatingMenu>
```

**Benefit**: Framework doesn't dictate UI, integrators compose as needed

---

### 6. Testability ✅

**Before**:
```typescript
// Testing QuestionToolBar requires:
// - Mounting full component
// - Mocking ToolCoordinator
// - Mocking services
// - Setting up props
// - Checking if correct buttons rendered

// ~50+ lines of test setup
```

**After**:
```typescript
// Testing calculator visibility:
test('calculator hidden for passages', () => {
  const context: PassageContext = { level: 'passage', ... };
  const visible = calculatorRegistration.isVisibleInContext(context);
  expect(visible).toBe(false);
});

test('calculator shown for math elements', () => {
  const context: ElementContext = {
    level: 'element',
    element: { pieType: 'math-inline', ... }
  };
  const visible = calculatorRegistration.isVisibleInContext(context);
  expect(visible).toBe(true);
});

// Pure function testing - ~5 lines
```

**Benefit**: Much easier to test visibility logic in isolation

---

## Migration Impact

### Breaking Changes ⚠️

#### For Framework Users (PIE Apps)
- ❌ **`tool-calculator-inline` deleted** - Use `ToolButtonGroup` instead
- ❌ **`tool-tts-inline` deleted** - Use `ToolButtonGroup` instead
- ⚠️ **Section player API change** - Add `toolRegistry` prop
- ✅ **Default registry provided** - Works out of box with PIE tools

#### For Tool Authors
- ✅ **Tool web components unchanged** - Calculator, TTS, etc. stay the same
- ➕ **Must export registration** - New `registration.ts` file per tool
- ✅ **Backward compatible** - Can provide both old and new APIs during transition

#### For Integrators
- ✅ **Opt-in enhancement** - Can continue using defaults
- ✅ **Better customization** - Can now override what was impossible before

---

### Migration Strategy

#### Phase 1: Additive (No Breaking Changes)
1. Add `ToolRegistry` (new)
2. Add tool registrations (new)
3. Add `ToolButton` component (new)
4. Keep old inline tools working

**Status**: Both old and new systems work

#### Phase 2: Deprecation
1. Mark inline tools as deprecated
2. Update docs to show new pattern
3. Provide migration guide

**Status**: Old way works but discouraged

#### Phase 3: Removal
1. Delete inline tool components
2. Delete hardcoded PNPMapper
3. Update all internal usage

**Status**: Breaking change, major version bump

---

## What This Doesn't Change

### Unchanged Architecture ✅

1. **Web Components** - Tools still use web component pattern
2. **Service Layer** - ToolCoordinator, TTSService, etc. unchanged
3. **PNP Hierarchy** - Precedence rules stay the same
4. **Tool Instances** - Floating tool UI unchanged
5. **Accessibility** - WCAG compliance unchanged
6. **QTI 3.0** - Still native QTI support
7. **Zero DOM Mutation** - Still use CSS Custom Highlight API
8. **Three-Tier Tools** - Tier 1/2/3 hierarchy unchanged

### Unchanged for End Users ✅

1. **Tool behavior** - Calculator works the same
2. **Tool appearance** - Same UI/UX
3. **Keyboard navigation** - Same shortcuts
4. **Screen reader** - Same announcements
5. **Tool coordination** - Same z-index behavior

**What changes**: How tools are *registered* and *rendered*, not how they *function*

---

## Comparison Summary

### Current Architecture Strengths

✅ **Solid foundations**:
- ToolCoordinator is excellent
- PNP resolution hierarchy is well-designed
- Tool web components are clean
- Services are composable
- Well-documented

✅ **Production-ready**:
- Calculator, TTS, Ruler, etc. work great
- WCAG 2.2 AA compliant
- QTI 3.0 native support

---

### Current Architecture Weaknesses

❌ **Duplication**:
- Separate inline tool components just for buttons
- Hardcoded tool lists in multiple toolbars
- PNP mapping in separate hardcoded file

❌ **Limited flexibility**:
- No way for integrators to add tools without forking
- No way to override visibility logic
- No tool metadata API for building UIs
- Tool placement is hardcoded in framework

❌ **Context limitations**:
- Basic visibility checks (DOM queries, not model inspection)
- Can't access full item/element context
- Can't make sophisticated content-based decisions

---

### Proposed Architecture Improvements

✅ **Eliminates duplication**:
- Single generic button component
- Tools provide button definitions
- No separate inline components
- Net -910 lines of code

✅ **Enables extensibility**:
- Integrators register custom tools easily
- Override visibility logic per tool
- Query tool metadata for UI building
- Flexible tool placement via composition

✅ **Richer context**:
- Full assessment/section/item/passage/element context
- Tools inspect element models (not just DOM)
- Type-safe context per level
- Better content-based decisions

✅ **Better integrator experience**:
- Clear API for customization
- No need to fork framework
- Tool metadata for PNP UI building
- Examples and documentation

---

## Risk Assessment

### Low Risk ✅
- ToolCoordinator unchanged (stable foundation)
- PNP resolution logic unchanged (proven)
- Tool web components minimally changed (just add registration)
- Services unchanged (isolated change)

### Medium Risk ⚠️
- Toolbar components need rewrite (but simpler code)
- Migration path for apps using inline tools
- Documentation updates needed

### Mitigation Strategy
- Phased rollout (additive → deprecate → remove)
- Keep both systems working during transition
- Comprehensive migration guide
- Update examples and docs

---

## Recommendation

### Should We Do This?

**YES** - If you value:
- ✅ Integrator flexibility (custom tools, override visibility)
- ✅ Reduced duplication (net -910 lines)
- ✅ Better tool metadata (queryable registry)
- ✅ Smarter visibility (context-aware decisions)
- ✅ Future extensibility (framework-agnostic tools)

**MAYBE** - If concerned about:
- ⚠️ Migration effort for existing apps
- ⚠️ Documentation updates
- ⚠️ Testing new patterns

**NO** - If you're satisfied with:
- Current duplication (inline tools)
- Limited integrator customization
- Basic visibility logic
- Hardcoded tool placement

---

## Implementation Approach

### Option A: Full Refactor (Recommended)
- Implement all phases
- Complete registry system
- Delete inline tools
- Clean architecture

**Timeline**: 3-4 weeks
**Benefit**: Clean, modern architecture

### Option B: Minimal Enhancement
- Add registry alongside current system
- Keep inline tools for backward compat
- Offer both patterns

**Timeline**: 2 weeks
**Benefit**: Less disruption, but maintains duplication

### Option C: Incremental
- Phase 1 only (registry + registrations)
- Assess value before continuing
- Delete inline tools in phase 2 if successful

**Timeline**: 1 week initially
**Benefit**: Validate approach before full commitment

---

## Conclusion

The current architecture is **solid but rigid**. The proposed refactoring adds **flexibility without complexity**, enabling integrators to customize tool behavior while maintaining the strong foundations already in place.

**Core thesis**: Keep what works (ToolCoordinator, PNP resolution, tool instances), enhance what's limiting (button duplication, hardcoded visibility, no tool metadata API).

The refactoring is **evolutionary, not revolutionary** - it builds on your good architecture rather than replacing it.
