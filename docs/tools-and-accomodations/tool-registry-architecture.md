# Tool Registry Architecture

**Date**: 2026-02-13
**Status**: Approved Design
**Purpose**: Define the two-pass tool visibility model with registry-based configuration

---

## Executive Summary

This document defines the confirmed architecture for tool registration, configuration, and visibility in the PIE Assessment Toolkit. The system uses a **two-pass model**:

1. **Pass 1 (Orchestrator)**: Determines which tools are ALLOWED based on PNP + policies
2. **Pass 2 (Tool)**: Each allowed tool decides if it's RELEVANT in the current context

Key principle: **One-way veto power** - Tools can hide themselves but cannot override orchestrator's NO.

> **Implementation Update (pre-1.0):**
> - Canonical toolkit identifiers are semantic `toolId` values (for example `calculator`, `textToSpeech`).
> - Web component tags (for example `pie-tool-calculator`) are resolved through configurable tag mapping.
> - Integrators can override tag mapping and component factories via `createDefaultToolRegistry(...)`.

---

## Core Principles

### 1. Integrator Controls Placement

Integrators configure which tools appear on which toolbars:
- Question/element headers
- Passage headers
- Section toolbars
- Custom placements (sidebars, floating menus, etc.)

The framework provides sensible defaults but does NOT hardcode or limit placement options.

### 2. Orchestrator Controls Allowance (Pass 1)

The `PNPToolResolver` (orchestrator) determines which tools a student is ALLOWED to use based on:
- Student PNP (IEP/504 accommodations)
- District policies
- Test administration settings
- Item-level requirements/restrictions

### 3. Tools Control Relevance (Pass 2)

Each tool inspects the current context and decides if it's RELEVANT:
- Is there math content? (calculator)
- Is there text to read? (TTS)
- Are there multiple choice options? (answer eliminator)

### 4. One-Way Veto Power

```
Tool Visibility = (Orchestrator says "ALLOWED") AND (Tool says "RELEVANT")
```

**Key Rule**: Tools can say NO (hide) but CANNOT say YES if orchestrator says NO

---

## Two-Pass Decision Model

### Pass 1: Orchestrator Determines Allowance

**Question**: "Which tools is this student ALLOWED to use for this item?"

**Owner**: `PNPToolResolver` (orchestrator)

**Inputs**:
- `PersonalNeedsProfile` - Student accommodations (IEP/504)
- `AssessmentSettings.districtPolicy` - District-wide tool rules
- `AssessmentSettings.testAdministration` - Test instance settings
- `ItemSettings.requiredTools` - Item requires specific tools
- `ItemSettings.restrictedTools` - Item blocks specific tools

**Process**:
```typescript
// Orchestrator applies precedence hierarchy
const resolver = new PNPToolResolver(registry);
const allowedToolIds = resolver.resolveAllowedTools(assessment, currentItemRef);

// Example result: ['calculator', 'textToSpeech']
```

**Precedence Hierarchy** (highest to lowest priority):
1. **District block** - Absolute veto (e.g., no calculator on math tests)
2. **Test override** - Test admin blocks tool for this instance
3. **Item restriction** - Item blocks tool (e.g., no calculator on mental math)
4. **Item requirement** - Item REQUIRES tool (e.g., calculator needed for complex math)
5. **District requirement** - District requires tool for all students
6. **PNP supports** - Student's IEP/504 accommodations

**Outputs**: `string[]` - Array of allowed tool IDs

**Critical**: Tools NOT in this list are NEVER consulted (gate enforced)

**What Pass 1 Does**:
- ✅ Applies PNP (student accommodations)
- ✅ Enforces district policies
- ✅ Respects test administration settings
- ✅ Honors item requirements/restrictions
- ✅ Returns allowed tool IDs

**What Pass 1 Does NOT Do**:
- ❌ Inspect content (math? multiple choice?)
- ❌ Check element models
- ❌ Ask tools for their opinion
- ❌ Make content-based decisions

---

### Pass 2: Tools Determine Relevance

**Question**: "Should this tool's button appear in the CURRENT context?"

**Owner**: Each tool's `isVisibleInContext(context)` method

**Input**: Rich `ToolContext` object
```typescript
interface ToolContext {
  level: 'assessment' | 'section' | 'item' | 'passage' | 'element';

  // Full assessment with PNP
  assessment: AssessmentEntity;
  currentItemRef?: AssessmentItemRef;

  // Context-specific data
  item?: ItemEntity;           // Full item with elements, markup
  passage?: PassageEntity;     // Full passage with content
  element?: PieModel;          // Full element with model, correctResponse
  section?: SectionEntity;     // Full section

  // Services
  coordinator?: IToolCoordinator;
  ttsService?: ITTSService;
  highlightCoordinator?: IHighlightCoordinator;
}
```

**Process**:
```typescript
// For each tool in allowedToolIds
const calcReg = registry.get('calculator');

// Build rich context
const context: ElementContext = {
  level: 'element',
  element: {
    pieType: 'text-entry',
    markup: '<p>Describe the water cycle</p>',
    model: { /* ... */ }
  },
  item: currentItem,
  assessment,
  currentItemRef,
  coordinator: toolCoordinator
};

// Ask tool: "You're allowed, but are you RELEVANT here?"
const isRelevant = calcReg.isVisibleInContext(context);
// Returns: false (no math content in text-entry element)
```

**What Pass 2 Does**:
- ✅ Tool inspects content (element.pieType, markup, model)
- ✅ Tool checks relevance (math? text? choices?)
- ✅ Tool makes context-aware decision
- ✅ Tool can HIDE itself even if allowed

**What Pass 2 Does NOT Do**:
- ❌ Tool cannot SHOW itself if not allowed
- ❌ Tool cannot override Pass 1 decision
- ❌ Tool is never called if not in allowedToolIds

---

## Enforcing One-Way Veto Power

The architecture enforces this through the filter chain:

```typescript
// In QuestionToolBar or any toolbar component
const visibleTools = allowedToolIds  // ← Pass 1 (gate)
  .map(toolId => registry.get(toolId))
  .filter(tool => tool !== undefined)
  .filter(tool => tool.isVisibleInContext(context)); // ← Pass 2 (filter)

// Render buttons
{#each visibleTools as tool}
  <ToolButton registration={tool} {context} />
{/each}
```

**Outcome Matrix**:

| Orchestrator (Pass 1) | Tool (Pass 2) | Result | Explanation |
|----------------------|---------------|--------|-------------|
| ALLOWED | RELEVANT | ✅ Button shown | Both agree |
| ALLOWED | NOT RELEVANT | ❌ Button hidden | Tool hides itself |
| NOT ALLOWED | (never asked) | ❌ Button hidden | Gate enforced |
| NOT ALLOWED | RELEVANT | ❌ IMPOSSIBLE | Tool never consulted |

**Key**: If `allowedToolIds` doesn't contain a tool, that tool's `isVisibleInContext()` is NEVER called.

---

## Complete Flow Example

### Scenario: Math Question with Student Accommodations

**Given**:
```typescript
// Student has IEP requiring TTS and calculator
const pnp: PersonalNeedsProfile = {
  supports: ['calculator', 'textToSpeech']
};

// District allows both
const districtPolicy = {
  blockedTools: [],
  requiredTools: []
};

// Item is a math question
const item: ItemEntity = {
  id: 'item-1',
  type: 'question',
  elements: [
    {
      id: 'elem-1',
      pieType: 'math-inline',
      markup: '<p>Solve: <math>2x + 3 = 7</math></p>'
    }
  ]
};

// Integrator configured these tools for question headers
const toolPlacementConfig = {
  questionHeader: ['calculator', 'textToSpeech', 'answerEliminator']
};
```

---

### Step 1: Orchestrator Determines Allowance (Pass 1)

```typescript
const resolver = new PNPToolResolver(registry);
const allowedToolIds = resolver.resolveAllowedTools(assessment, itemRef);

// Result: ['calculator', 'textToSpeech']
// Note: answerEliminator NOT in PNP, so not included
```

**Orchestrator decision**: "Student can use calculator and TTS (from PNP)"

---

### Step 2: Build Context for Current Element

```typescript
const context: ElementContext = {
  level: 'element',
  elementId: 'elem-1',
  element: {
    pieType: 'math-inline',
    markup: '<p>Solve: <math>2x + 3 = 7</math></p>',
    model: { /* ... */ }
  },
  item: item,
  assessment: assessment,
  currentItemRef: itemRef,
  coordinator: toolCoordinator,
  ttsService: ttsService
};
```

---

### Step 3: Render Question Toolbar

```typescript
// QuestionToolBar.svelte
<script>
  let {
    toolIds = toolPlacementConfig.questionHeader,  // ['calculator', 'textToSpeech', 'answerEliminator']
    context,
    registry,
    allowedToolIds  // From Pass 1: ['calculator', 'textToSpeech']
  } = $props();

  // Filter to tools configured for this toolbar
  let configuredTools = $derived(
    toolIds.map(id => registry.get(id)).filter(Boolean)
  );

  // Filter to tools allowed by orchestrator (Pass 1)
  let allowedTools = $derived(
    configuredTools.filter(tool =>
      allowedToolIds.includes(tool.toolId)
    )
  );
  // Result: calculator ✅, TTS ✅, answerEliminator ❌ (not allowed)

  // Ask each allowed tool if it should be visible (Pass 2)
  let visibleTools = $derived(
    allowedTools.filter(tool =>
      tool.isVisibleInContext(context)
    )
  );
</script>

{#each visibleTools as tool}
  <ToolButton registration={tool} {context} />
{/each}
```

---

### Step 4: Tools Make Decisions (Pass 2)

**Calculator** (allowed by orchestrator, asked by toolbar):
```typescript
calculatorReg.isVisibleInContext(context)
  → Checks: element.pieType === 'math-inline'
  → Returns: true
  → Button SHOWN ✅
```

**TTS** (allowed by orchestrator, asked by toolbar):
```typescript
ttsReg.isVisibleInContext(context)
  → Checks: element.markup.trim().length > 0
  → Returns: true
  → Button SHOWN ✅
```

**Answer Eliminator** (NOT allowed by orchestrator, never asked):
```typescript
// NOT in allowedToolIds
// isVisibleInContext() NEVER CALLED
// Button NOT SHOWN ❌
```

---

### Step 5: Final Result

**Buttons rendered**: Calculator ✅, TTS ✅
**Buttons hidden**: Answer Eliminator ❌ (not in PNP)

**Why each decision**:
- Calculator: Allowed (PNP) ✅ AND Relevant (math content) ✅ → SHOWN
- TTS: Allowed (PNP) ✅ AND Relevant (text content) ✅ → SHOWN
- Answer Eliminator: Not Allowed (not in PNP) ❌ → HIDDEN (never asked)

---

## Example: Different Content, Same Allowance

### Scenario: Text-Only Question (Same Student)

**Same student, same PNP, but different element**:
```typescript
const element = {
  pieType: 'text-entry',
  markup: '<p>Describe the water cycle</p>'
  // No math content
};
```

### Pass 1: Orchestrator (Same Result)
```typescript
allowedToolIds = ['calculator', 'textToSpeech']
// Same as before - based on PNP, not content
```

### Pass 2: Tools Make Different Decisions

**Calculator** (allowed, but not relevant):
```typescript
calculatorReg.isVisibleInContext(context)
  → Checks: hasMathContent(element)
  → Returns: false (text-entry, no math)
  → Button NOT SHOWN ❌
```

**TTS** (allowed and relevant):
```typescript
ttsReg.isVisibleInContext(context)
  → Checks: hasReadableContent(element)
  → Returns: true
  → Button SHOWN ✅
```

### Final Result

**Buttons rendered**: TTS ✅
**Buttons hidden**: Calculator ❌ (not relevant), Answer Eliminator ❌ (not allowed)

**Key Insight**: Calculator was ALLOWED by orchestrator but chose to HIDE itself because element has no math content. This is the one-way veto power in action.

---

## Tool Registry API

### ToolRegistration Interface

```typescript
export interface ToolRegistration {
  // Metadata (for integrator discovery)
  toolId: string;
  name: string;
  description: string;
  icon: string | ((context: ToolContext) => string);

  // What levels can this tool operate at?
  supportedLevels: ('assessment' | 'section' | 'item' | 'passage' | 'element')[];

  // PNP mapping (tools declare what PNP IDs they handle)
  pnpSupportIds?: string[];

  // Pass 2: Context-aware visibility decision
  isVisibleInContext(context: ToolContext): boolean;

  // Button factory
  createButton(context: ToolContext, options: ButtonOptions): ToolButtonDefinition;

  // Tool instance factory
  createToolInstance(context: ToolContext, options: ToolOptions): HTMLElement;

  // Configuration resolver
  getConfiguration?(context: ToolContext): any;
}
```

### ToolRegistry Class

```typescript
export class ToolRegistry {
  private registrations = new Map<string, ToolRegistration>();
  private pnpToToolMap = new Map<string, string>();

  /**
   * Register a tool
   */
  register(registration: ToolRegistration): void {
    this.registrations.set(registration.toolId, registration);

    // Index PNP support IDs for Pass 1 resolution
    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        this.pnpToToolMap.set(pnpId, registration.toolId);
      }
    }
  }

  /**
   * Get tool registration by ID
   */
  get(toolId: string): ToolRegistration | undefined {
    return this.registrations.get(toolId);
  }

  /**
   * Map PNP support ID to tool ID (used by Pass 1)
   */
  getToolIdFromPNP(pnpSupportId: string): string | undefined {
    return this.pnpToToolMap.get(pnpSupportId);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get tools that support a specific level
   */
  getByLevel(level: ToolLevel): ToolRegistration[] {
    return this.getAll().filter(reg =>
      reg.supportedLevels.includes(level)
    );
  }

  /**
   * Get tools that are visible in context
   * (Both allowed AND relevant)
   */
  getVisibleTools(
    context: ToolContext,
    allowedToolIds: string[]
  ): ToolRegistration[] {
    return allowedToolIds
      .map(id => this.get(id))
      .filter(reg => reg && reg.isVisibleInContext(context));
  }
}
```

---

## Client Configuration and Customization

This section describes how clients of the framework configure and override tool placement, registration, and visibility behavior.

### Overview: Three Levels of Customization

Clients can customize the tool system at three levels:

1. **Tool Placement** - Configure which tools appear on which toolbars
2. **Tool Registration** - Add custom tools or override existing tool behavior
3. **Visibility Logic** - Override content detection (e.g., custom math detection)

All customization is done through configuration and registration APIs - no need to fork or modify framework code.

---

### 1. Tool Placement Configuration (Where Buttons Appear)

Clients configure which tools appear on different toolbars throughout the UI.

**Default Configuration** (provided by framework):

```typescript
import { DEFAULT_TOOL_PLACEMENT } from '@pie-players/pie-assessment-toolkit';

// Framework default placement
const DEFAULT_TOOL_PLACEMENT = {
  questionHeader: ['calculator', 'textToSpeech', 'answerEliminator'],
  passageHeader: ['textToSpeech', 'annotationToolbar'],
  sectionToolbar: ['calculator', 'graph', 'periodicTable', 'protractor', 'ruler']
};
```

**Custom Configuration**:

```typescript
// Client defines where tool buttons appear
const customPlacement = {
  questionHeader: ['textToSpeech'],  // Only TTS on questions
  passageHeader: ['textToSpeech', 'annotationToolbar'],
  sectionToolbar: ['calculator', 'graph'],  // Minimal section toolbar
  customSidebar: ['lineReader', 'my-custom-tool']  // Custom placement
};

<pie-section-player
  {assessment}
  {section}
  toolPlacementConfig={customPlacement}
  {toolRegistry}
  {toolCoordinator} />
```

**Key Points**:

- ✅ Framework provides sensible defaults
- ✅ Client can override any placement
- ✅ Client can define custom placement locations
- ✅ No hardcoded limits on where tools can appear

---

### 2. Tool Registry Customization (What Tools Are Available)

Clients can use default PIE tools, add custom tools, or override tool behavior.

**Bootstrap recommendation (lazy loading + cycle safety):**

```typescript
import { createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';
import { DEFAULT_TOOL_MODULE_LOADERS } from '@pie-players/pie-default-tool-loaders';

const registry = createDefaultToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
});
```

Why the default registrations exist:

- They are the canonical contracts for built-in tools (semantic `toolId`, PNP mappings, visibility logic, and instance creation).
- They keep orchestration and rendering decoupled: policies resolve `toolId`s, registrations decide UI behavior.
- They provide safe defaults while still allowing integrators to replace behavior via `registry.override(...)`,
  `toolTagMap`, and `toolComponentFactories`.

```typescript
// Start with PIE defaults
const registry = createDefaultToolRegistry();

// Optional: override default web-component mapping/factories
const registryWithCustomComponents = createDefaultToolRegistry({
  toolTagMap: {
    calculator: 'my-calculator-tool',
    textToSpeech: 'my-tts-tool'
  },
  toolComponentFactories: {
    calculator: ({ tagName }) => document.createElement(tagName)
  }
});

// Add custom tool
registry.register({
  toolId: 'my-periodic-table',
  name: 'Periodic Table',
  description: 'Custom periodic table implementation',
  icon: '<svg>...</svg>',
  supportedLevels: ['section', 'item'],
  pnpSupportIds: ['x-my-periodic-table'],
  isVisibleInContext: (ctx) => {
    // Only for chemistry items
    return ctx.level === 'section' || isChemistryItem(ctx);
  },
  createButton: (ctx, opts) => ({ /* ... */ }),
  createToolInstance: (ctx, opts) => { /* ... */ }
});

// Override calculator visibility logic
const calcReg = registry.get('calculator');
registry.override({
  ...calcReg,
  isVisibleInContext: (ctx) => {
    // Use MY advanced math detection
    return myCustomMathDetection(ctx);
  }
});
```

### 3. Visibility Logic Override (Custom Content Detection)

Clients can override how tools detect relevant content:

```typescript
const registry = createDefaultToolRegistry();

// Override calculator's math detection
const calcReg = registry.get('calculator');
registry.override({
  ...calcReg,
  isVisibleInContext: (ctx) => {
    if (ctx.level === 'element') {
      // Use MY advanced math detection instead of PIE's
      return myAdvancedMathDetection(ctx.element) ||
             ctx.element.metadata?.requiresCalculator ||
             ctx.element.model?.hasNumericalOperations;
    }
    // Fall back to default for other levels
    return calcReg.isVisibleInContext(ctx);
  }
});
```

**Key Points**:

- ✅ Client can override any tool's visibility logic
- ✅ Access to full element/item models
- ✅ Can mix custom logic with default logic
- ✅ No need to modify framework code

---

### 4. Complete Example: Custom Configuration

```typescript
import { createDefaultToolRegistry, DEFAULT_TOOL_PLACEMENT } from '@pie-players/pie-assessment-toolkit';

// 1. Start with PIE defaults
const registry = createDefaultToolRegistry();

// 2. Add custom tool
registry.register({
  toolId: 'my-periodic-table',
  name: 'Periodic Table',
  description: 'Custom chemistry reference',
  icon: '<svg>...</svg>',
  supportedLevels: ['section', 'item'],
  pnpSupportIds: ['x-my-periodic-table'],
  isVisibleInContext: (ctx) => {
    return ctx.level === 'section' ||
           ctx.item?.metadata?.subject === 'chemistry';
  },
  createButton: (ctx, opts) => ({ /* ... */ }),
  createToolInstance: (ctx, opts) => { /* ... */ }
});

// 3. Override calculator visibility
const calcReg = registry.get('calculator');
registry.override({
  ...calcReg,
  isVisibleInContext: (ctx) => myCustomMathDetection(ctx)
});

// 4. Custom placement
const customPlacement = {
  questionHeader: ['textToSpeech'],
  sectionToolbar: ['my-periodic-table', 'calculator', 'graph']
};

// 5. Use in section player
<pie-section-player
  {assessment}
  {section}
  toolRegistry={registry}
  toolPlacementConfig={customPlacement}
  {toolCoordinator}
  {ttsService} />
```

**What this achieves**:

- ✅ Custom periodic table integrated with PNP
- ✅ Custom math detection for calculator
- ✅ Custom toolbar layout
- ✅ All done through configuration, no framework changes

---

### 5. Querying Tool Metadata (Building PNP UIs)

Clients can query the registry to build accommodation selection interfaces:

```typescript
const registry = createDefaultToolRegistry();

// Get all available tools with metadata
const allTools = registry.getAll();
/*
[
  { toolId: 'calculator', name: 'Calculator', description: '...', pnpSupportIds: ['calculator', ...] },
  { toolId: 'textToSpeech', name: 'Text-to-Speech', description: '...', pnpSupportIds: ['textToSpeech'] },
  // ... all registered tools
]
*/

// Build accommodation selection UI
const accommodationChoices = allTools.map(tool => ({
  label: tool.name,
  description: tool.description,
  icon: typeof tool.icon === 'string' ? tool.icon : tool.icon(defaultContext),
  pnpIds: tool.pnpSupportIds || []
}));

// Render in your UI framework
<AccommodationSelector choices={accommodationChoices} onSelect={handleSelect} />

// Generate PNP profile from selections
function handleSelect(selectedTools) {
  const pnp: PersonalNeedsProfile = {
    supports: selectedTools.flatMap(t => t.pnpIds)
  };

  // Save to student profile
  await saveStudentAccommodations(studentId, pnp);
}
```

**Key Points**:

- ✅ Registry provides tool metadata (name, description, icon)
- ✅ No hardcoded tool lists needed
- ✅ Dynamic accommodation UI generation
- ✅ PNP profile building from registry

---

## Tool Registration Example: Calculator

```typescript
// packages/tool-calculator/registration.ts

export const calculatorRegistration: ToolRegistration = {
  toolId: 'calculator',
  name: 'Calculator',
  description: 'Scientific, basic, and graphing calculator',
  icon: '<svg>...</svg>',

  // Can appear at section, item, or element level
  supportedLevels: ['section', 'item', 'element'],

  // Maps to these PNP support IDs
  pnpSupportIds: [
    'calculator',
    'scientificCalculator',
    'graphingCalculator',
    'basicCalculator'
  ],

  // Pass 2: Decide if relevant in current context
  isVisibleInContext(context: ToolContext): boolean {
    const { level } = context;

    switch (level) {
      case 'passage':
        // Never relevant for passages
        return false;

      case 'item':
        const item = (context as ItemContext).item;
        // Only for questions, not stimuli
        if (item.type !== 'question') return false;
        // Check if any element has math
        return item.elements?.some(el => hasMathContent(el)) ?? false;

      case 'element':
        const element = (context as ElementContext).element;
        // Check this specific element
        return hasMathContent(element);

      case 'section':
        // Always available at section level
        return true;

      default:
        return false;
    }
  },

  createButton(context: ToolContext, options: ButtonOptions): ToolButtonDefinition {
    return {
      toolInstanceId: getToolInstanceId(context),
      icon: this.icon,
      label: this.name,
      ariaLabel: 'Toggle calculator'
    };
  },

  createToolInstance(context: ToolContext, options: ToolOptions): HTMLElement {
    const element = createToolElement(this.toolId, context, options, options.componentOverrides);
    const config = this.getConfiguration(context);
    element.setAttribute('calculator-type', config.type);
    element.setAttribute('tool-id', getToolInstanceId(context));
    return element;
  },

  getConfiguration(context: ToolContext): any {
    // Priority 1: Item specification
    if (context.level === 'item') {
      const item = (context as ItemContext).item;
      if (item.calculatorType) {
        return {
          type: item.calculatorType,
          availableTypes: item.calculatorTypes || [item.calculatorType]
        };
      }
    }

    // Priority 2: Accessibility profile (from PNP)
    const accessibility = context.assessment.personalNeedsProfile;
    const settings = context.assessment.settings;
    const calcConfig = settings?.toolConfigs?.calculator;

    return {
      type: calcConfig?.type || 'scientific',
      availableTypes: calcConfig?.availableTypes || ['basic', 'scientific', 'graphing']
    };
  }
};

// Helper function (integrator can override)
export function hasMathContent(element: any): boolean {
  return element?.markup?.includes('math-inline') ||
         element?.markup?.includes('latex') ||
         element?.pieType === 'number-line' ||
         element?.pieType === 'math-inline' ||
         element?.correctResponse?.type === 'number';
}

function getToolInstanceId(context: ToolContext): string {
  switch (context.level) {
    case 'element':
      return `calculator-${(context as ElementContext).elementId}`;
    case 'item':
      return `calculator-${(context as ItemContext).itemId}`;
    case 'section':
      return `calculator-section-${(context as SectionContext).sectionId}`;
    default:
      return 'calculator';
  }
}
```

---

## Benefits Summary

### For Framework
- ✅ Clear separation: Orchestrator (allowance) vs. Tool (relevance)
- ✅ No duplication (no separate inline components)
- ✅ Enforced security (one-way veto power)
- ✅ Type-safe context
- ✅ Testable (pure functions)

### For Integrators
- ✅ Full control over tool placement
- ✅ Easy to add custom tools
- ✅ Override visibility logic per tool
- ✅ Query tool metadata for UI building
- ✅ No need to fork framework

### For Tool Authors
- ✅ Rich context for smart decisions
- ✅ Access to full element/item models
- ✅ Self-contained registration
- ✅ Clear lifecycle

### For Students
- ✅ Consistent accommodation enforcement (PNP)
- ✅ Only relevant tools shown (less clutter)
- ✅ Content-aware tool availability
- ✅ Same experience, better UX

---

## Key Architectural Rules

1. **Two-Pass Model**: Pass 1 (orchestrator) determines allowance, Pass 2 (tool) determines relevance
2. **One-Way Veto**: Tools can hide but cannot override orchestrator's NO
3. **Gate Enforcement**: Tools not in `allowedToolIds` are never consulted
4. **Rich Context**: Tools receive full context for smart decisions
5. **No Hardcoding**: Framework provides defaults, integrators configure everything
6. **Content-Aware**: Pass 2 inspects actual content (models, markup)
7. **PNP Respects Student**: Pass 1 enforces IEP/504 accommodations

---

## Migration from Current Architecture

### What Changes
- ❌ Delete separate inline tool components (`tool-calculator-inline`, `tool-tts-inline`)
- ❌ Remove hardcoded tool lists from toolbars
- ❌ Remove hardcoded PNPMapper
- ➕ Add ToolRegistry
- ➕ Add tool registrations
- ➕ Add generic ToolButton component
- ➕ Update toolbars to use registry

### What Stays the Same
- ✅ ToolCoordinator (unchanged)
- ✅ PNP precedence hierarchy (unchanged)
- ✅ Tool web components (minimal changes)
- ✅ All other services (unchanged)

### Backward Compatibility
- Phase 1: Add new system alongside old (both work)
- Phase 2: Deprecate old inline components
- Phase 3: Remove old components (major version bump)

---

## Conclusion

This architecture provides a clean, flexible, and secure model for tool visibility:

- **Pass 1 (Orchestrator)**: Enforces accommodations and policies
- **Pass 2 (Tools)**: Enables content-aware decisions
- **One-Way Veto**: Security through architecture
- **Integrator Control**: Full flexibility without hardcoding

The two-pass model respects student accommodations (PNP) while enabling smart, content-aware tool visibility decisions.
