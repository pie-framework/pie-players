# Tool Registry Implementation Guide

**Date**: 2026-02-13
**Status**: Implementation Plan
**Audience**: Framework developers implementing the tool registry refactoring

---

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 days)

Create the foundational types and services without touching existing code.

#### 1.1: Create ToolContext Types

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

export interface AssessmentContext extends BaseToolContext {
  level: 'assessment';
  assessmentId: string;
}

export interface SectionContext extends BaseToolContext {
  level: 'section';
  assessmentId: string;
  sectionId: string;
  section: QtiAssessmentSection;
}

export interface ItemContext extends BaseToolContext {
  level: 'item';
  assessmentId: string;
  sectionId: string;
  itemId: string;
  item: ItemEntity;
}

export interface PassageContext extends BaseToolContext {
  level: 'passage';
  assessmentId: string;
  sectionId: string;
  passageId: string;
  passage: PassageEntity;
}

export interface ElementContext extends BaseToolContext {
  level: 'element';
  assessmentId: string;
  sectionId: string;
  itemId: string;
  elementId: string;
  item: ItemEntity;
  element: PieModel;
}

export type ToolContext =
  | AssessmentContext
  | SectionContext
  | ItemContext
  | PassageContext
  | ElementContext;
```

#### 1.2: Create ToolRegistry

**New file**: `packages/assessment-toolkit/src/services/ToolRegistry.ts`

```typescript
import type { ToolContext, ToolLevel } from './tool-context';

export interface ToolRegistration {
  toolId: string;
  name: string;
  description: string;
  icon: string | ((context: ToolContext) => string);
  supportedLevels: ToolLevel[];
  pnpSupportIds?: string[];

  // Pass 2: Visibility decision
  isVisibleInContext(context: ToolContext): boolean;

  // Factories
  createButton(context: ToolContext, options: ButtonOptions): ToolButtonDefinition;
  createToolInstance(context: ToolContext, options: ToolOptions): HTMLElement;

  // Optional
  getConfiguration?(context: ToolContext): any;
  onToggle?(context: ToolContext, coordinator: IToolCoordinator): void;
}

export interface ButtonOptions {
  size?: 'sm' | 'md' | 'lg';
}

export interface ToolOptions {
  [key: string]: any;
}

export interface ToolButtonDefinition {
  toolInstanceId: string;
  icon: string;
  label: string;
  ariaLabel: string;
}

export class ToolRegistry {
  private registrations = new Map<string, ToolRegistration>();
  private pnpToToolMap = new Map<string, string>();

  register(registration: ToolRegistration): void {
    this.registrations.set(registration.toolId, registration);

    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        this.pnpToToolMap.set(pnpId, registration.toolId);
      }
    }
  }

  get(toolId: string): ToolRegistration | undefined {
    return this.registrations.get(toolId);
  }

  getToolIdFromPNP(pnpSupportId: string): string | undefined {
    return this.pnpToToolMap.get(pnpSupportId);
  }

  getAll(): ToolRegistration[] {
    return Array.from(this.registrations.values());
  }

  getByLevel(level: ToolLevel): ToolRegistration[] {
    return this.getAll().filter(reg =>
      reg.supportedLevels.includes(level)
    );
  }

  getVisibleTools(
    context: ToolContext,
    allowedToolIds: string[]
  ): ToolRegistration[] {
    return allowedToolIds
      .map(id => this.get(id))
      .filter((reg): reg is ToolRegistration => reg !== undefined)
      .filter(reg => reg.isVisibleInContext(context));
  }
}
```

#### 1.3: Update PNPToolResolver

**File**: `packages/assessment-toolkit/src/services/PNPToolResolver.ts`

**Changes**:
```typescript
export class PNPToolResolver {
  constructor(private registry: ToolRegistry) {}

  /**
   * Pass 1: Resolve which tools are ALLOWED
   * Returns array of tool IDs based on PNP + policies
   */
  resolveAllowedTools(
    assessment: AssessmentEntity,
    currentItemRef?: AssessmentItemRef
  ): string[] {
    const pnp = assessment.personalNeedsProfile;
    const settings = assessment.settings;
    const itemSettings = currentItemRef?.settings;

    const allowedToolIds = new Set<string>();

    // Collect all PNP supports mentioned
    const allSupports = new Set<string>();
    pnp?.supports?.forEach(s => allSupports.add(s));
    settings?.districtPolicy?.blockedTools?.forEach(s => allSupports.add(s));
    settings?.districtPolicy?.requiredTools?.forEach(s => allSupports.add(s));
    itemSettings?.requiredTools?.forEach(s => allSupports.add(s));
    itemSettings?.restrictedTools?.forEach(s => allSupports.add(s));

    // Resolve each PNP support to tool ID via registry
    for (const supportId of allSupports) {
      const toolId = this.registry.getToolIdFromPNP(supportId);

      if (!toolId) {
        console.warn(`No tool registered for PNP support: ${supportId}`);
        continue;
      }

      // Apply precedence hierarchy
      const isAllowed = this.resolveSupportAccess(supportId, {
        pnp,
        districtPolicy: settings?.districtPolicy,
        testAdmin: settings?.testAdministration,
        itemSettings
      });

      if (isAllowed) {
        allowedToolIds.add(toolId);
      }
    }

    return Array.from(allowedToolIds);
  }

  // Keep existing resolveSupportAccess() logic - unchanged
  private resolveSupportAccess(supportId: string, context): boolean {
    // Same precedence hierarchy as before
    // ...
  }

  // Deprecated: Keep for backward compat, but use resolveAllowedTools instead
  resolveTools(assessment, itemRef) {
    // Legacy method - map to new approach
  }
}
```

**Key changes**:
- ✅ Takes `ToolRegistry` in constructor
- ✅ Uses `registry.getToolIdFromPNP()` instead of hardcoded mapper
- ✅ Returns `string[]` (tool IDs) instead of full configs
- ✅ Precedence logic unchanged

---

### Phase 2: Tool Registrations (4-5 days)

Create registration files for all existing PIE tools.

#### 2.1: Calculator Registration

**New file**: `packages/tool-calculator/registration.ts`

See full example in previous section.

#### 2.2: TTS Registration

**New file**: `packages/tool-tts-inline/registration.ts` (rename package to `tool-text-to-speech`)

```typescript
export const ttsRegistration: ToolRegistration = {
  toolId: 'pie-tool-text-to-speech',
  name: 'Text-to-Speech',
  description: 'Read content aloud with synchronized highlighting',
  icon: '<svg>...</svg>',

  supportedLevels: ['section', 'item', 'passage', 'element'],

  pnpSupportIds: ['textToSpeech', 'tts', 'readAloud'],

  isVisibleInContext(context: ToolContext): boolean {
    const { level } = context;

    switch (level) {
      case 'passage':
        const passage = (context as PassageContext).passage;
        return hasReadableContent(passage.config?.markup);

      case 'item':
        return true; // Items always have content

      case 'element':
        const element = (context as ElementContext).element;
        return hasReadableContent(element.markup);

      case 'section':
        return true; // Section-level TTS

      default:
        return true;
    }
  },

  // ... factories
};

function hasReadableContent(markup?: string): boolean {
  return (markup?.replace(/<[^>]*>/g, '').trim().length ?? 0) > 0;
}
```

#### 2.3: Answer Eliminator Registration

**New file**: `packages/tool-answer-eliminator/registration.ts`

```typescript
export const answerEliminatorRegistration: ToolRegistration = {
  toolId: 'pie-tool-answer-eliminator',
  name: 'Answer Eliminator',
  description: 'Cross out answer choices',
  icon: '<svg>...</svg>',

  supportedLevels: ['item', 'element'],

  pnpSupportIds: ['answerMasking', 'answerEliminator'],

  isVisibleInContext(context: ToolContext): boolean {
    const { level } = context;

    if (level === 'item') {
      const item = (context as ItemContext).item;
      return hasMultipleChoiceElements(item);
    }

    if (level === 'element') {
      const element = (context as ElementContext).element;
      return isMultipleChoiceElement(element);
    }

    return false;
  },

  // ... factories
};

function hasMultipleChoiceElements(item: ItemEntity): boolean {
  return item.config?.models?.some(isMultipleChoiceElement) ?? false;
}

function isMultipleChoiceElement(element: PieModel): boolean {
  const mcTypes = ['multiple-choice', 'checkbox', 'radio', 'inline-dropdown', 'ebsr'];
  return mcTypes.includes(element.element); // element.element is pieType
}
```

#### 2.4: Other Tool Registrations

Create registrations for:
- [ ] Ruler
- [ ] Protractor
- [ ] Periodic Table
- [ ] Graph
- [ ] Line Reader
- [ ] Magnifier
- [ ] Highlighter/Annotation Toolbar
- [ ] Dictionary (if exists)

#### 2.5: Create Default Registry Factory

**New file**: `packages/assessment-toolkit/src/tools/default-registry.ts`

```typescript
import { ToolRegistry } from '../services/ToolRegistry';
import { calculatorRegistration } from '@pie-players/tool-calculator/registration';
import { ttsRegistration } from '@pie-players/tool-text-to-speech/registration';
import { answerEliminatorRegistration } from '@pie-players/tool-answer-eliminator/registration';
// ... import all PIE tool registrations

/**
 * Create a ToolRegistry with all built-in PIE tools registered
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register all PIE tools
  registry.register(calculatorRegistration);
  registry.register(ttsRegistration);
  registry.register(answerEliminatorRegistration);
  registry.register(rulerRegistration);
  registry.register(protractorRegistration);
  registry.register(periodicTableRegistration);
  registry.register(graphRegistration);
  registry.register(lineReaderRegistration);
  registry.register(magnifierRegistration);
  registry.register(highlighterRegistration);

  return registry;
}

/**
 * Default tool placement configuration
 */
export const DEFAULT_TOOL_PLACEMENT = {
  questionHeader: ['pie-tool-calculator', 'pie-tool-text-to-speech', 'pie-tool-answer-eliminator'],
  passageHeader: ['pie-tool-text-to-speech', 'pie-tool-annotation-toolbar'],
  sectionToolbar: [
    'pie-tool-calculator',
    'pie-tool-graph',
    'pie-tool-periodic-table',
    'pie-tool-protractor',
    'pie-tool-ruler'
  ]
};
```

---

### Phase 3: Generic Components (2-3 days)

#### 3.1: Create ToolButton Component

**New file**: `packages/assessment-toolkit/src/components/ToolButton.svelte`

```svelte
<svelte:options
  customElement={{
    tag: 'pie-tool-button',
    shadow: 'none',
    props: {
      registration: { type: 'Object', reflect: false },
      context: { type: 'Object', reflect: false },
      size: { type: 'String', attribute: 'size' }
    }
  }}
/>

<script lang="ts">
  import type { ToolRegistration, ToolContext, ButtonOptions } from '../services';

  let {
    registration,
    context,
    size = 'md'
  }: {
    registration: ToolRegistration;
    context: ToolContext;
    size?: 'sm' | 'md' | 'lg';
  } = $props();

  // Pass 2: Tool decides if visible
  let isVisible = $derived(registration.isVisibleInContext(context));

  // Create button definition from factory
  let buttonDef = $derived(
    registration.createButton(context, { size })
  );

  // Track active state from coordinator
  let isActive = $state(false);

  $effect(() => {
    if (!context.coordinator) return;

    const unsubscribe = context.coordinator.subscribe(() => {
      isActive = context.coordinator.isToolVisible(buttonDef.toolInstanceId);
    });

    isActive = context.coordinator.isToolVisible(buttonDef.toolInstanceId);
    return unsubscribe;
  });

  function handleClick() {
    if (registration.onToggle) {
      registration.onToggle(context, context.coordinator);
    } else {
      context.coordinator?.toggleTool(buttonDef.toolInstanceId);
    }
  }
</script>

{#if isVisible}
  <button
    class="tool-button tool-button--{size}"
    class:tool-button--active={isActive}
    onclick={handleClick}
    aria-label={buttonDef.ariaLabel}
    aria-pressed={isActive}
    title={buttonDef.label}>
    {@html buttonDef.icon}
  </button>
{/if}

<style>
  .tool-button {
    /* Base styles */
  }

  .tool-button--sm { /* ... */ }
  .tool-button--md { /* ... */ }
  .tool-button--lg { /* ... */ }

  .tool-button--active { /* ... */ }
</style>
```

#### 3.2: Create ToolButtonGroup Component

**New file**: `packages/assessment-toolkit/src/components/ToolButtonGroup.svelte`

```svelte
<svelte:options
  customElement={{
    tag: 'pie-tool-button-group',
    shadow: 'none',
    props: {
      toolIds: { type: 'String', attribute: 'tool-ids' },
      context: { type: 'Object', reflect: false },
      registry: { type: 'Object', reflect: false },
      allowedToolIds: { type: 'Object', reflect: false },
      size: { type: 'String', attribute: 'size' }
    }
  }}
/>

<script lang="ts">
  import type { ToolRegistry, ToolContext } from '../services';
  import ToolButton from './ToolButton.svelte';

  let {
    toolIds = '',
    context,
    registry,
    allowedToolIds,
    size = 'md'
  }: {
    toolIds?: string | string[];
    context: ToolContext;
    registry: ToolRegistry;
    allowedToolIds: string[];
    size?: 'sm' | 'md' | 'lg';
  } = $props();

  // Parse tool IDs (accept CSV string or array)
  let toolIdList = $derived(
    typeof toolIds === 'string'
      ? toolIds.split(',').map(t => t.trim()).filter(Boolean)
      : toolIds
  );

  // Filter to tools configured for this toolbar
  let configuredTools = $derived(
    toolIdList
      .map(id => registry.get(id))
      .filter((reg): reg is ToolRegistration => reg !== undefined)
  );

  // Filter to tools allowed by orchestrator (Pass 1)
  let allowedTools = $derived(
    configuredTools.filter(tool =>
      allowedToolIds.includes(tool.toolId)
    )
  );

  // Pass 2: Ask each allowed tool if it should be visible
  let visibleTools = $derived(
    allowedTools.filter(tool =>
      tool.isVisibleInContext(context)
    )
  );
</script>

<div class="tool-button-group">
  {#each visibleTools as tool}
    <ToolButton registration={tool} {context} {size} />
  {/each}
</div>

<style>
  .tool-button-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
```

---

### Phase 4: Update Existing Toolbars (2-3 days)

#### 4.1: Refactor QuestionToolBar

**File**: `packages/assessment-toolkit/src/components/QuestionToolBar.svelte`

**Before** (~400 lines with hardcoded buttons)

**After**:
```svelte
<svelte:options
  customElement={{
    tag: 'pie-question-toolbar',
    shadow: 'none',
    props: {
      itemId: { type: 'String', attribute: 'item-id' },
      toolIds: { type: 'String', attribute: 'tool-ids' },
      size: { type: 'String', attribute: 'size' },

      // JS properties
      item: { type: 'Object', reflect: false },
      assessment: { type: 'Object', reflect: false },
      currentItemRef: { type: 'Object', reflect: false },
      registry: { type: 'Object', reflect: false },
      allowedToolIds: { type: 'Object', reflect: false },
      coordinator: { type: 'Object', reflect: false },
      ttsService: { type: 'Object', reflect: false },
      highlightCoordinator: { type: 'Object', reflect: false }
    }
  }}
/>

<script lang="ts">
  import type { ItemEntity, AssessmentEntity, AssessmentItemRef } from '@pie-players/pie-players-shared/types';
  import type { ToolRegistry, IToolCoordinator, ITTSService, IHighlightCoordinator } from '../services';
  import type { ItemContext } from '../services/tool-context';
  import ToolButtonGroup from './ToolButtonGroup.svelte';

  let {
    itemId,
    toolIds = 'pie-tool-calculator,pie-tool-text-to-speech,pie-tool-answer-eliminator',
    size = 'md',
    item,
    assessment,
    currentItemRef,
    registry,
    allowedToolIds,
    coordinator,
    ttsService,
    highlightCoordinator
  }: {
    itemId: string;
    toolIds?: string | string[];
    size?: 'sm' | 'md' | 'lg';
    item: ItemEntity;
    assessment: AssessmentEntity;
    currentItemRef?: AssessmentItemRef;
    registry: ToolRegistry;
    allowedToolIds: string[];
    coordinator?: IToolCoordinator;
    ttsService?: ITTSService;
    highlightCoordinator?: IHighlightCoordinator;
  } = $props();

  // Build context for this item
  let context: ItemContext = $derived({
    level: 'item',
    assessmentId: assessment.id || '',
    sectionId: currentItemRef?.sectionId || '',
    itemId: itemId,
    item: item,
    assessment: assessment,
    currentItemRef: currentItemRef,
    coordinator: coordinator,
    ttsService: ttsService,
    highlightCoordinator: highlightCoordinator
  });
</script>

<div class="question-toolbar">
  <ToolButtonGroup
    {toolIds}
    {context}
    {registry}
    {allowedToolIds}
    {size} />
</div>

<style>
  .question-toolbar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem;
  }
</style>
```

**Reduction**: ~400 lines → ~80 lines

#### 4.2: Refactor SectionToolsToolbar

**File**: `packages/toolbars/section-toolbar.svelte`

**Similar refactoring**:
```svelte
<script lang="ts">
  import type { SectionContext } from '@pie-players/pie-assessment-toolkit/services/tool-context';
  import { ToolButtonGroup } from '@pie-players/pie-assessment-toolkit';

  let {
    toolIds = 'pie-tool-calculator,pie-tool-graph,pie-tool-periodic-table,pie-tool-protractor,pie-tool-ruler',
    context,
    registry,
    allowedToolIds,
    size = 'lg'
  } = $props();
</script>

<footer class="section-toolbar">
  <ToolButtonGroup
    {toolIds}
    {context}
    {registry}
    {allowedToolIds}
    {size} />
</footer>
```

**Reduction**: ~300 lines → ~50 lines

---

### Phase 5: Section Player Integration (2-3 days)

#### 5.1: Update Section Player Props

**File**: `packages/section-player/src/components/PieSectionPlayerSplitPaneElement.svelte`

**Add props**:
```typescript
let {
  assessment,
  section,

  // NEW: Tool registry (optional, defaults to PIE tools)
  toolRegistry = createDefaultToolRegistry(),

  // NEW: Tool placement config (optional)
  toolPlacementConfig = DEFAULT_TOOL_PLACEMENT,

  // Existing services
  toolCoordinator,
  ttsService,
  highlightCoordinator,

  // ... other props
} = $props();

// Create PNP resolver with registry
const pnpResolver = new PNPToolResolver(toolRegistry);

// Pass 1: Resolve allowed tools
let allowedToolIds = $derived(
  pnpResolver.resolveAllowedTools(assessment, currentItemRef)
);
```

#### 5.2: Pass Context and Registry to Toolbars

```svelte
<!-- When rendering item -->
{#each section.items as item}
  <div class="item-container">
    <pie-question-toolbar
      item-id={item.id}
      tool-ids={toolPlacementConfig.questionHeader}
      {item}
      {assessment}
      currentItemRef={currentItemRef}
      registry={toolRegistry}
      allowedToolIds={allowedToolIds}
      {toolCoordinator}
      {ttsService}
      {highlightCoordinator} />

    <pie-item-player ... />
  </div>
{/each}

<!-- Section toolbar -->
<pie-section-toolbar
  tool-ids={toolPlacementConfig.sectionToolbar}
  context={sectionContext}
  registry={toolRegistry}
  allowedToolIds={allowedToolIds}
  {toolCoordinator} />
```

---

### Phase 6: Cleanup (1-2 days)

#### 6.1: Delete Inline Tool Components

- [ ] Delete `packages/tool-calculator-inline/`
- [ ] Delete duplicate TTS inline logic (merge into registration)
- [ ] Update package imports across codebase

#### 6.2: Remove Hardcoded PNPMapper

- [ ] Delete `packages/assessment-toolkit/src/services/PNPMapper.ts`
- [ ] Update exports in `packages/assessment-toolkit/src/index.ts`
- [ ] Update documentation references

---

## Testing Strategy

### Unit Tests

#### ToolRegistry Tests
```typescript
describe('ToolRegistry', () => {
  test('registers tool with metadata', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorRegistration);

    const tool = registry.get('pie-tool-calculator');
    expect(tool?.name).toBe('Calculator');
    expect(tool?.pnpSupportIds).toContain('calculator');
  });

  test('maps PNP support to tool ID', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorRegistration);

    const toolId = registry.getToolIdFromPNP('calculator');
    expect(toolId).toBe('pie-tool-calculator');
  });
});
```

#### Tool Visibility Tests
```typescript
describe('Calculator visibility', () => {
  test('hidden for passages', () => {
    const context: PassageContext = {
      level: 'passage',
      /* ... */
    };

    const visible = calculatorRegistration.isVisibleInContext(context);
    expect(visible).toBe(false);
  });

  test('shown for elements with math', () => {
    const context: ElementContext = {
      level: 'element',
      element: {
        element: 'math-inline',
        markup: '<math>x + 2</math>'
      },
      /* ... */
    };

    const visible = calculatorRegistration.isVisibleInContext(context);
    expect(visible).toBe(true);
  });

  test('hidden for elements without math', () => {
    const context: ElementContext = {
      level: 'element',
      element: {
        element: 'text-entry',
        markup: '<p>Describe...</p>'
      },
      /* ... */
    };

    const visible = calculatorRegistration.isVisibleInContext(context);
    expect(visible).toBe(false);
  });
});
```

#### PNP Resolution Tests
```typescript
describe('PNPToolResolver with registry', () => {
  test('resolves allowed tools from PNP', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorRegistration);
    registry.register(ttsRegistration);

    const resolver = new PNPToolResolver(registry);

    const assessment = {
      personalNeedsProfile: {
        supports: ['calculator', 'textToSpeech']
      }
    };

    const allowed = resolver.resolveAllowedTools(assessment);
    expect(allowed).toContain('pie-tool-calculator');
    expect(allowed).toContain('pie-tool-text-to-speech');
  });

  test('enforces district blocks', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorRegistration);

    const resolver = new PNPToolResolver(registry);

    const assessment = {
      personalNeedsProfile: {
        supports: ['calculator']
      },
      settings: {
        districtPolicy: {
          blockedTools: ['calculator']
        }
      }
    };

    const allowed = resolver.resolveAllowedTools(assessment);
    expect(allowed).not.toContain('pie-tool-calculator');
  });
});
```

### Integration Tests

```typescript
describe('ToolButton integration', () => {
  test('renders only if both allowed and relevant', () => {
    const registry = createDefaultToolRegistry();
    const resolver = new PNPToolResolver(registry);

    // Pass 1: Calculator allowed
    const allowedToolIds = resolver.resolveAllowedTools(assessment);
    expect(allowedToolIds).toContain('pie-tool-calculator');

    // Pass 2: Calculator not relevant for text element
    const context: ElementContext = {
      level: 'element',
      element: { element: 'text-entry', markup: 'Text' }
      // ...
    };

    const calcReg = registry.get('pie-tool-calculator');
    const visible = calcReg.isVisibleInContext(context);

    // Button should NOT render (allowed but not relevant)
    expect(visible).toBe(false);
  });
});
```

---

## Documentation Updates

### Files to Update

1. **Main Architecture**
   - [ ] `docs/ARCHITECTURE.md` - Add tool registry section
   - [ ] `docs/tools-and-accomodations/architecture.md` - Update with two-pass model

2. **Tool Documentation**
   - [ ] Each tool README - Add registration section
   - [ ] `packages/tool-calculator-inline/README.md` - Keep aligned with registry patterns

3. **Integration Guides**
   - [ ] `packages/assessment-toolkit/src/README.md` - Add registry examples
   - [ ] `docs/pnp-third-party-integration-guide.md` - Update with registry pattern

4. **API Documentation**
   - [ ] Create `docs/tools-and-accomodations/tool-registry-api.md`
   - [ ] Create `docs/tools-and-accomodations/tool-registration-guide.md`

5. **Migration Guide**
   - [ ] Create `docs/tools-and-accomodations/tool-registry-migration-guide.md`

---

## Example Scenarios

### Scenario 1: Standard PIE Tools

```typescript
// Use defaults
const registry = createDefaultToolRegistry();

<pie-section-player-splitpane
  {assessment}
  {section}
  toolRegistry={registry}
  {toolCoordinator}
  {ttsService} />
```

**Result**: All PIE tools work with default placement

---

### Scenario 2: Custom Tool Placement

```typescript
const registry = createDefaultToolRegistry();

const customPlacement = {
  questionHeader: ['pie-tool-text-to-speech'],  // Only TTS, no calculator
  sectionToolbar: ['pie-tool-calculator', 'pie-tool-graph']
};

<pie-section-player-splitpane
  {assessment}
  {section}
  toolRegistry={registry}
  toolPlacementConfig={customPlacement}
  {toolCoordinator}
  {ttsService} />
```

**Result**: TTS on question headers, calculator on section toolbar

---

### Scenario 3: Custom Tool

```typescript
const registry = createDefaultToolRegistry();

// Add custom periodic table
registry.register({
  toolId: 'my-periodic-table',
  name: 'Periodic Table',
  description: 'Custom periodic table',
  icon: '<svg>...</svg>',
  supportedLevels: ['section', 'item'],
  pnpSupportIds: ['x-my-periodic-table'],
  isVisibleInContext: (ctx) => {
    if (ctx.level === 'item') {
      return ctx.item.metadata?.subject === 'chemistry';
    }
    return true;
  },
  createButton: (ctx, opts) => ({ /* ... */ }),
  createToolInstance: (ctx, opts) => { /* ... */ }
});

const customPlacement = {
  questionHeader: ['pie-tool-text-to-speech'],
  sectionToolbar: ['my-periodic-table', 'pie-tool-calculator']
};

<pie-section-player-splitpane
  {assessment}
  {section}
  toolRegistry={registry}
  toolPlacementConfig={customPlacement}
  {toolCoordinator} />
```

**Result**: Custom periodic table available via PNP, shows only for chemistry items

---

### Scenario 4: Override Visibility Logic

```typescript
const registry = createDefaultToolRegistry();

// Override calculator's math detection
const calcReg = registry.get('pie-tool-calculator');
registry.register({
  ...calcReg,
  isVisibleInContext: (ctx) => {
    if (ctx.level === 'element') {
      // Use MY advanced detection
      return myAdvancedMathDetection(ctx.element);
    }
    // Otherwise use default
    return calcReg.isVisibleInContext(ctx);
  }
});

<pie-section-player-splitpane
  {assessment}
  {section}
  toolRegistry={registry}
  {toolCoordinator} />
```

**Result**: Calculator uses custom math detection logic

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `tool-context.ts` with all context types
- [ ] Create `ToolRegistry.ts` with registration interface
- [ ] Update `PNPToolResolver.ts` to use registry
- [ ] Add unit tests for registry
- [ ] Add unit tests for PNP resolution with registry

### Phase 2: Tool Registrations
- [ ] Create `tool-calculator/registration.ts`
- [ ] Create `tool-text-to-speech/registration.ts`
- [ ] Create `tool-answer-eliminator/registration.ts`
- [ ] Create registrations for all other PIE tools
- [ ] Create `default-registry.ts` factory
- [ ] Add unit tests for each registration

### Phase 3: Generic Components
- [ ] Create `ToolButton.svelte`
- [ ] Create `ToolButtonGroup.svelte`
- [ ] Add component tests
- [ ] Verify styling and accessibility

### Phase 4: Update Toolbars
- [ ] Refactor `QuestionToolBar.svelte`
- [ ] Refactor `SectionToolsToolbar.svelte`
- [ ] Update section player integration
- [ ] Add integration tests

### Phase 5: Cleanup
- [ ] Delete `tool-calculator-inline/`
- [ ] Delete `tool-tts-inline/` (merge into main tool)
- [ ] Delete `PNPMapper.ts`
- [ ] Update exports and imports
- [ ] Remove deprecated code

### Phase 6: Documentation
- [ ] Update architecture docs
- [ ] Create API documentation
- [ ] Create integration guide
- [ ] Create migration guide
- [ ] Update tool READMEs

### Phase 7: Examples
- [ ] Update example app to use registry
- [ ] Add custom tool example
- [ ] Add override visibility example
- [ ] Add custom placement example

---

## Success Criteria

### Functionality
- ✅ All existing PIE tools work with registry
- ✅ PNP resolution works with registry
- ✅ Tool buttons appear in correct locations
- ✅ Visibility respects both allowance and relevance
- ✅ Custom tools can be registered
- ✅ Visibility logic can be overridden

### Code Quality
- ✅ Net reduction in lines of code (-910 lines)
- ✅ No duplicate components
- ✅ Type-safe context
- ✅ Comprehensive test coverage

### Integration
- ✅ Backward compatible during transition
- ✅ Migration path documented
- ✅ Examples updated
- ✅ API documented

### User Experience
- ✅ No change to end-user tool behavior
- ✅ Same accessibility compliance
- ✅ Same keyboard navigation
- ✅ Better (fewer irrelevant buttons shown)

---

## Timeline

- **Phase 1**: 3-4 days (core infrastructure)
- **Phase 2**: 4-5 days (tool registrations)
- **Phase 3**: 2-3 days (generic components)
- **Phase 4**: 2-3 days (toolbar updates)
- **Phase 5**: 1-2 days (cleanup)
- **Phase 6**: 2-3 days (documentation)
- **Phase 7**: 1-2 days (examples)

**Total**: 15-22 days (3-4 weeks)

---

## Open Questions

1. Should we support async `isVisibleInContext()`? (e.g., for tools that need to fetch data)
2. Should tools be able to provide multiple button variants? (e.g., calculator with type selector)
3. Should we add tool dependencies? (e.g., answer eliminator requires highlighter service)
4. Should we support tool button ordering/grouping hints?

---

## Conclusion

This implementation guide provides a clear path from current architecture to the improved registry-based system while maintaining stability and backward compatibility during transition.

The two-pass model ensures security (orchestrator controls allowance) while enabling intelligence (tools control relevance based on content).
