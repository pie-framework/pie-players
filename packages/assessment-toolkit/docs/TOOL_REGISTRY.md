# Tool Registry Architecture

The Tool Registry provides a **registry-based system** for managing assessment tools with support for QTI 3.0 Personal Needs and Preferences (PNP) profiles and context-aware tool visibility.

## Overview

The Tool Registry replaces hardcoded tool lists with a flexible, extensible system that:

1. **Enforces two-pass visibility model**: Orchestrator determines allowed tools (Pass 1), tools decide relevance (Pass 2)
2. **Maps PNP features to tools**: Automatic tool enablement based on QTI 3.0 accessibility profiles
3. **Context-aware filtering**: Tools show/hide based on content analysis
4. **Type-safe registrations**: Full TypeScript support with standardized interfaces

## Architecture

### Two-Pass Visibility Model

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR LAYER                       │
│  (Assessment platform, PNP resolver, policies)              │
│                                                              │
│  Pass 1: Determines allowedToolIds[]                        │
│  - Reads QTI 3.0 PNP profile                                │
│  - Applies institutional policies                           │
│  - Maps accessFeature → toolIds via ToolRegistry            │
└──────────────────────┬──────────────────────────────────────┘
                       │ allowedToolIds: ["calculator", "tts", ...]
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOOL REGISTRY LAYER                       │
│  (ToolRegistry + ToolRegistrations)                         │
│                                                              │
│  Pass 2: Filters by tool relevance                          │
│  - Checks supportedLevels (item/passage/element)            │
│  - Calls isVisibleInContext(context)                        │
│  - Returns visible tools                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ visibleTools: [ToolRegistration, ...]
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI LAYER                                │
│  (ToolButtonGroup, QuestionToolBar)                         │
│                                                              │
│  Renders: Buttons for visible tools only                    │
└─────────────────────────────────────────────────────────────┘
```

### One-Way Veto Enforcement

Tools can **hide themselves** but cannot **override orchestrator's NO**:

- ✅ Orchestrator says YES → Tool can say NO (hide via `isVisibleInContext`)
- ❌ Orchestrator says NO → Tool cannot say YES (tool not in `allowedToolIds`)

This is enforced architecturally: `filterVisibleInContext()` only filters the `allowedToolIds` array.

## QTI 3.0 Standard Access Features

The toolkit includes comprehensive QTI 3.0 / IMS Access for All (AfA) 3.0 standard features in `pnp-standard-features.ts`:

### Standard Feature Categories

```typescript
import { QTI_STANDARD_ACCESS_FEATURES } from '@pie-players/pie-assessment-toolkit';

// 9 categories with 95+ standardized features:
QTI_STANDARD_ACCESS_FEATURES.visual          // magnification, contrast, display
QTI_STANDARD_ACCESS_FEATURES.auditory        // TTS, captions, audio controls
QTI_STANDARD_ACCESS_FEATURES.motor           // keyboard, timing, input
QTI_STANDARD_ACCESS_FEATURES.cognitive       // simplification, focus, tools
QTI_STANDARD_ACCESS_FEATURES.reading         // spacing, masking, highlighting
QTI_STANDARD_ACCESS_FEATURES.navigation      // structure, search, skip
QTI_STANDARD_ACCESS_FEATURES.linguistic      // translation, glossary
QTI_STANDARD_ACCESS_FEATURES.assessment      // calculator, ruler, answer masking
```

### Example Access Features

```typescript
// Visual accessibility
"magnification"           // QTI 3.0 visual.magnification
"screenMagnifier"         // QTI 3.0 visual.screenMagnifier
"highContrastDisplay"     // QTI 3.0 visual.highContrastDisplay
"colorContrast"           // QTI 3.0 visual.colorContrast
"invertColors"            // QTI 3.0 visual.invertColors

// Auditory accessibility
"textToSpeech"            // QTI 3.0 auditory.textToSpeech
"readAloud"               // QTI 3.0 auditory.readAloud
"captions"                // QTI 3.0 auditory.captions
"signLanguage"            // QTI 3.0 auditory.signLanguage

// Cognitive/reading support
"calculator"              // QTI 3.0 cognitive.calculator
"highlighting"            // QTI 3.0 cognitive.highlighting
"annotations"             // QTI 3.0 cognitive.annotations
"readingMask"             // QTI 3.0 reading.readingMask
"readingGuide"            // QTI 3.0 reading.readingGuide

// Assessment tools
"graphingCalculator"      // QTI 3.0 assessment.graphingCalculator
"ruler"                   // QTI 3.0 assessment.ruler
"protractor"              // QTI 3.0 assessment.protractor
"periodicTable"           // QTI 3.0 assessment.periodicTable
"answerMasking"           // QTI 3.0 assessment.answerMasking
```

### Example PNP Configurations

The toolkit provides example configurations showing how standard features combine for different accessibility needs:

```typescript
import { EXAMPLE_PNP_CONFIGURATIONS } from '@pie-players/pie-assessment-toolkit';

// Example: Student with low vision
EXAMPLE_PNP_CONFIGURATIONS.lowVision.features
// → ["magnification", "screenMagnifier", "highContrastDisplay", "textToSpeech", ...]

// Example: Student with dyslexia
EXAMPLE_PNP_CONFIGURATIONS.dyslexia.features
// → ["textToSpeech", "readAloud", "highlighting", "readingMask", ...]

// Example: Student with ADHD
EXAMPLE_PNP_CONFIGURATIONS.adhd.features
// → ["reducedDistraction", "highlighting", "annotations", "timingControl", ...]
```

**Note**: These are illustrative examples, not official QTI profiles. Real student profiles are institution-specific combinations of standard features.

## Tool Registration

### Registering a Tool

```typescript
import type { ToolRegistration } from '@pie-players/pie-assessment-toolkit';

export const calculatorToolRegistration: ToolRegistration = {
  toolId: "calculator",
  name: "Calculator",
  description: "Multi-type calculator",
  icon: "calculator",

  // Which context levels support this tool
  supportedLevels: ["section", "item", "passage", "rubric", "element"],

  // QTI 3.0 PNP support IDs that enable this tool
  // Maps to standard features from pnp-standard-features.ts
  pnpSupportIds: [
    "calculator",           // QTI 3.0 standard (cognitive.calculator)
    "graphingCalculator",   // QTI 3.0 standard (assessment.graphingCalculator)
    "basicCalculator",      // Common variant
    "scientificCalculator"  // Common variant
  ],

  // Pass 2: Is this tool relevant in the current context?
  isVisibleInContext(context: ToolContext): boolean {
    // Show at section/item level (student might need it)
    if (context.level === "section" || context.level === "item") {
      return true;
    }

    // At element level, only show if math content detected
    return hasMathContent(context);
  },

  // Create toolbar button
  createButton(context, options): ToolButtonDefinition {
    return {
      toolId: this.toolId,
      label: this.name,
      icon: this.icon,
      disabled: options.disabled || false,
      ariaLabel: "Calculator",
      tooltip: "Calculator",
      onClick: options.onClick || (() => {}),
      className: options.className
    };
  },

  // Create tool instance (web component)
  createToolInstance(context, options): HTMLElement {
    const calculator = document.createElement('pie-tool-calculator');
    calculator.visible = true;

    if (options.config?.toolkitCoordinator) {
      calculator.toolkitCoordinator = options.config.toolkitCoordinator;
    }

    if (options.onClose) {
      calculator.addEventListener('close', options.onClose);
    }

    return calculator;
  }
};
```

### Tool Context

Tools receive a `ToolContext` that describes the current content context:

```typescript
type ToolLevel = "assessment" | "section" | "item" | "passage" | "rubric" | "element";

interface ItemToolContext {
  level: "item";
  assessment: AssessmentEntity;
  section: QtiAssessmentSection;
  itemRef: AssessmentItemRef;
  item: ItemEntity;
  passage?: PassageEntity;
}

interface ElementToolContext {
  level: "element";
  assessment: AssessmentEntity;
  section: QtiAssessmentSection;
  itemRef: AssessmentItemRef;
  item: ItemEntity;
  elementId: string;
  passage?: PassageEntity;
}

// ... AssessmentToolContext, SectionToolContext, PassageToolContext, RubricToolContext
```

### Context Helper Functions

```typescript
import {
  hasReadableText,
  hasMathContent,
  hasScienceContent,
  hasChoiceInteraction
} from '@pie-players/pie-assessment-toolkit';

// Check if context has readable text (10+ characters)
isVisibleInContext(context: ToolContext): boolean {
  return hasReadableText(context);
}

// Check if context has math content (MathML, LaTeX, symbols)
isVisibleInContext(context: ToolContext): boolean {
  return hasMathContent(context);
}

// Check if context has science content (chemistry, biology, physics terms)
isVisibleInContext(context: ToolContext): boolean {
  return hasScienceContent(context);
}

// Check if context has choice-based interaction
isVisibleInContext(context: ToolContext): boolean {
  return hasChoiceInteraction(context);
}
```

## Using the Tool Registry

### Creating a Registry

```typescript
import { createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';

// Create registry with all 12 default PIE tools
const toolRegistry = createDefaultToolRegistry();

// Or create custom registry
const customRegistry = new ToolRegistry();
customRegistry.register(calculatorToolRegistration);
customRegistry.register(ttsToolRegistration);
// ... register only the tools you need
```

### Default Tools

The default registry includes 12 tools organized by purpose:

**Global Accessibility Tools** (assessment/section level):
- Magnifier - zoom lens for visual accessibility
- Color Scheme - accessible color themes and contrast

**Context-Smart Tools** (auto-detect content):
- Calculator - basic, scientific, graphing (math content)
- Graph - graphing calculator (math content)
- Periodic Table - chemistry reference (science content)

**Reading Support Tools** (text detection):
- Text-to-Speech - read content aloud
- Line Reader - reading guide overlay
- Annotation Toolbar - text highlighting with CSS Custom Highlight API
- Highlighter - text highlighting (legacy)

**Interaction-Specific Tools**:
- Answer Eliminator - strike through choices (choice questions only)

**Measurement Tools** (element level):
- Ruler - on-screen ruler
- Protractor - angle measurement

### PNP Resolution

```typescript
import { PNPToolResolver } from '@pie-players/pie-assessment-toolkit';

// Create resolver with tool registry
const pnpResolver = new PNPToolResolver(toolRegistry);

// Get allowed tool IDs from QTI 3.0 PNP profile
const allowedToolIds = pnpResolver.getAllowedToolIds(assessment, itemRef);
// Returns: ["calculator", "textToSpeech", "magnifier", ...]
```

The `PNPToolResolver` reads QTI 3.0 `accessibilityInfo.accessFeature` arrays and maps them to tool IDs using the tool registry's PNP index.

### Filtering by Context

```typescript
// Pass 1: Orchestrator determines allowed tools
const allowedToolIds = pnpResolver.getAllowedToolIds(assessment, itemRef);

// Pass 2: Filter by tool relevance
const context: ItemToolContext = {
  level: "item",
  assessment,
  section,
  itemRef,
  item
};

const visibleTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);
// Returns: ToolRegistration[] (only tools that passed both gates)
```

### Creating Tool Buttons

```typescript
// Create buttons for visible tools
const buttons = visibleTools.map(tool =>
  tool.createButton(context, {
    onClick: () => handleToolClick(tool.toolId),
    className: "custom-button-class"
  })
);

// Render buttons
buttons.forEach(button => {
  // button.toolId, button.label, button.icon, button.onClick, etc.
});
```

## UI Components

### ToolButtonGroup

Generic toolbar component that implements the two-pass visibility model:

```svelte
<script lang="ts">
  import { ToolButtonGroup } from '@pie-players/pie-assessment-toolkit';

  let {
    toolRegistry,      // ToolRegistry instance
    allowedToolIds,    // Pass 1: from orchestrator
    context,           // ToolContext for Pass 2
    onToolClick        // Callback when tool clicked
  } = $props();
</script>

<ToolButtonGroup
  {toolRegistry}
  {allowedToolIds}
  {context}
  {onToolClick}
  orientation="horizontal"
  compact={false}
/>
```

### ToolButton

Individual button component:

```svelte
<script lang="ts">
  import { ToolButton } from '@pie-players/pie-assessment-toolkit';

  let { button } = $props();  // ToolButtonDefinition
</script>

<ToolButton {button} />
```

### QuestionToolBar

The `QuestionToolBar` component supports dual-mode operation:

**Registry Mode** (new architecture):
```html
<pie-question-toolbar
  .toolRegistry={toolRegistry}
  .pnpResolver={pnpResolver}
  .assessment={assessment}
  .itemRef={itemRef}
  .item={item}
></pie-question-toolbar>
```

**Legacy Mode** (hardcoded tools):
```html
<pie-question-toolbar
  tools="calculator,tts,answerEliminator"
  item-id="question-1"
></pie-question-toolbar>
```

## Default Tool Placement

The toolkit provides recommended tool placement by context level:

```typescript
import { DEFAULT_TOOL_PLACEMENT } from '@pie-players/pie-assessment-toolkit';

DEFAULT_TOOL_PLACEMENT.assessment  // ["magnifier", "colorScheme"]
DEFAULT_TOOL_PLACEMENT.section     // ["magnifier", "colorScheme", "calculator", "textToSpeech"]
DEFAULT_TOOL_PLACEMENT.item        // ["calculator", "textToSpeech", "answerEliminator", ...]
DEFAULT_TOOL_PLACEMENT.passage     // ["textToSpeech", "highlighter", "annotationToolbar", "lineReader"]
DEFAULT_TOOL_PLACEMENT.rubric      // ["textToSpeech", "highlighter", "annotationToolbar", "lineReader"]
DEFAULT_TOOL_PLACEMENT.element     // ["calculator", "textToSpeech", "ruler", "protractor", ...]
```

These are **recommendations**, not requirements. Integrators can customize placement based on their needs.

## Tool Categories

Tools are organized by purpose:

### Global Tools
- **Magnifier** - Always visible when allowed, works across entire assessment
- **Color Scheme** - Always visible when allowed, affects entire assessment

### Context-Smart Tools
- **Calculator** - Shows at section/item level, or when math content detected
- **Graph** - Shows when math content detected
- **Periodic Table** - Shows when science content detected

### Reading Support
- **Text-to-Speech** - Shows when readable text exists (10+ characters)
- **Line Reader** - Shows when readable text exists
- **Annotation Toolbar** - Shows when readable text exists
- **Highlighter** - Shows when readable text exists (legacy)

### Interaction-Specific
- **Answer Eliminator** - Shows only on choice-based questions (MC, inline choice, select text)

### Measurement Tools
- **Ruler** - Shows at element level when math content detected
- **Protractor** - Shows at element level when math content detected

## Creating Custom Tools

To create a new tool:

1. **Create registration file** (e.g., `my-tool.ts`):

```typescript
import type { ToolRegistration } from '@pie-players/pie-assessment-toolkit';

export const myToolRegistration: ToolRegistration = {
  toolId: "myTool",
  name: "My Tool",
  description: "Custom tool description",
  icon: "custom-icon",
  supportedLevels: ["item", "element"],
  pnpSupportIds: ["myToolFeature", "customFeature"],

  isVisibleInContext(context) {
    // Custom visibility logic
    return true;
  },

  createButton(context, options) {
    // Return button definition
  },

  createToolInstance(context, options) {
    // Return web component instance
  }
};
```

2. **Register with tool registry**:

```typescript
const registry = new ToolRegistry();
registry.register(myToolRegistration);
```

3. **Add PNP mapping** (if using PNP resolver):

```typescript
// The pnpSupportIds in your registration automatically create the mapping
// No additional configuration needed
```

## TypeScript Support

Full TypeScript definitions:

```typescript
import type {
  ToolRegistry,
  ToolRegistration,
  ToolContext,
  ToolLevel,
  ToolButtonDefinition,
  ToolButtonOptions,
  ToolInstanceOptions,
  ItemToolContext,
  ElementToolContext,
  PassageToolContext,
  RubricToolContext
} from '@pie-players/pie-assessment-toolkit';

import {
  QTI_STANDARD_ACCESS_FEATURES,
  EXAMPLE_PNP_CONFIGURATIONS,
  isStandardAccessFeature,
  getFeatureCategory,
  getFeaturesInCategory
} from '@pie-players/pie-assessment-toolkit';
```

## Migration from Legacy

### Before (Hardcoded)

```typescript
// Hardcoded tool list
const tools = "calculator,tts,answerEliminator";

// PNPMapper with static mappings
const toolIds = PNPMapper.mapPNPToTools(pnpProfile);
```

### After (Registry-Based)

```typescript
// Create registry
const toolRegistry = createDefaultToolRegistry();

// PNP resolver uses registry
const pnpResolver = new PNPToolResolver(toolRegistry);
const allowedToolIds = pnpResolver.getAllowedToolIds(assessment, itemRef);

// Filter by context
const visibleTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);
```

## PNP Precedence Hierarchy

The `PNPToolResolver` implements a **precedence hierarchy** based on common assessment platform governance patterns. This hierarchy is **not defined by QTI 3.0 standards** but follows common practices in K-12 assessment platforms.

### Standards-Based vs Implementation-Specific

**Standards-Based (from QTI 3.0):**

- **PNP supports** (#6) - Student's documented accessibility needs (`accessibilityInfo.accessFeature`)
- **Item-level settings** (#3, #4) - Per-item accessibility requirements/restrictions

**Implementation-Specific (common practice):**

- **District policy** (#1, #5) - Institutional governance and legal compliance
- **Test administration** (#2) - Session-level operational control

### Precedence Order

The resolver applies these rules in order (highest to lowest priority):

1. **District block** (absolute veto)
   - **Purpose**: Legal/policy requirements
   - **Example**: District blocks calculator on state standardized math test
   - **Effect**: Tool completely unavailable, cannot be overridden

2. **Test administration override**
   - **Purpose**: Proctor/administrator operational control
   - **Example**: Proctor disables TTS due to technical issues in testing lab
   - **Effect**: Tool disabled for this test session

3. **Item restriction** (per-item block)
   - **Purpose**: Content author can disable for specific items
   - **Example**: Calculator disabled on mental math questions
   - **Effect**: Tool unavailable only for this item

4. **Item requirement** (forces enable)
   - **Purpose**: Required by IEP/504 or content needs
   - **Example**: Calculator required for multi-step word problems
   - **Effect**: Tool must be available for this item

5. **District requirement**
   - **Purpose**: Institutional accessibility requirements
   - **Example**: District mandates TTS for all ELL students
   - **Effect**: Tool enabled by institutional policy

6. **PNP supports** (student needs)
   - **Purpose**: QTI 3.0 standard student preferences
   - **Example**: Student's IEP document specifies magnification support
   - **Effect**: Tool enabled based on student's accessibility profile

### Governance Rationale

This hierarchy aligns with typical **IEP/504 accommodation hierarchies** in US K-12 education:

- **Institutional veto** (district) trumps individual preferences (legal compliance)
- **Session control** (test admin) enables operational flexibility for testing environments
- **Content restrictions** (item) prevent tools that invalidate assessment construct
- **Required accommodations** (IEP/504) ensure legal compliance with disability law
- **Student preferences** (PNP) are honored when not overridden by policy

### Important Notes

- This is a **common pattern**, not a QTI 3.0 standard
- Different assessment platforms may implement different precedence rules
- The precedence logic is implemented in `PNPToolResolver.resolveSupport()`
- Integrators can extend or modify this logic for their governance model

## Best Practices

1. **Use standard QTI 3.0 features first** - Check `QTI_STANDARD_ACCESS_FEATURES` before adding custom features
2. **Include standard + variants** - List standard features first, then common variants in `pnpSupportIds`
3. **Make tools context-aware** - Use helper functions like `hasMathContent()`, `hasReadableText()`
4. **Document PNP mappings** - Add comments showing which QTI 3.0 features each tool maps to
5. **Test both passes** - Verify tools respect orchestrator allowance AND context relevance
6. **Keep visibility logic simple** - Complex logic should be in helper functions, not in `isVisibleInContext()`
7. **Understand precedence** - Know which governance rules take priority in your platform

## References

- **[PNP Configuration Guide](PNP_CONFIGURATION.md)** - How integrators configure governance rules
- [IMS Global Access for All (AfA) 3.0](https://www.imsglobal.org/spec/afa/v3p0)
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0)
- [Schema.org Accessibility Features](https://schema.org/accessibilityFeature)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
