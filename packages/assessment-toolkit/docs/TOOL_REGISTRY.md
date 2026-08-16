# Tool Registry Architecture

The Tool Registry provides a **registry-based system** for managing assessment tools with support for QTI 3.0 Personal Needs and Preferences (PNP) profiles and context-aware tool visibility.

## Overview

The Tool Registry replaces hardcoded tool lists with a flexible, extensible system that:

1. **Enforces two-pass visibility model**: Orchestrator determines allowed tools (Pass 1), tools decide relevance (Pass 2)
2. **Maps PNP features to tools**: Automatic tool enablement based on QTI 3.0 accessibility profiles
3. **Context-aware filtering**: Tools show/hide based on content analysis
4. **Type-safe registrations**: Full TypeScript support with standardized interfaces

### Canonical IDs and Component Resolution

- Toolkit APIs use semantic `toolId` values (for example `calculator`, `textToSpeech`).
- Web component tags (for example `pie-tool-calculator`) are resolved through `toolTagMap`.
- Integrators can override both tag mapping and creation logic via
  `createPackagedToolRegistry({ toolTagMap, toolComponentFactories })` from `@pie-players/pie-default-tool-loaders`.

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
│  (ToolButtonGroup, ItemToolBar)                             │
│                                                              │
│  Renders: Buttons for visible tools only                    │
└─────────────────────────────────────────────────────────────┘
```

### One-Way Veto Enforcement

Tools can **hide themselves** but cannot **override orchestrator's NO**:

- ✅ Orchestrator says YES → Tool can say NO (hide via `isVisibleInContext`)
- ❌ Orchestrator says NO → Tool cannot say YES (tool not in `allowedToolIds`)

This is enforced architecturally: `filterVisibleInContext()` only filters the `allowedToolIds` array.

### Refresh / Init Contract

Toolbar containers may remain mounted, but button visibility is re-evaluated on each
init/render refresh:

1. Resolve `allowedToolIds` (Pass 1).
2. Rebuild the current `ToolContext`.
3. Call `filterVisibleInContext(allowedToolIds, context)` (Pass 2).
4. Render only the resulting buttons.

This keeps visibility deterministic and context-driven for every refresh cycle.

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
  supportedLevels: ["item", "element"],

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
    // Show only when math content is present
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
    const calculator = createToolElement(
      this.toolId,
      context,
      options,
      options.componentOverrides
    );
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
  section: AssessmentSection;
  itemRef: AssessmentItemRef;
  item: ItemEntity;
  passage?: PassageEntity;
}

interface ElementToolContext {
  level: "element";
  assessment: AssessmentEntity;
  section: AssessmentSection;
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
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';
import {
  DEFAULT_TOOL_MODULE_LOADERS,
} from '@pie-players/pie-default-tool-loaders';

// Create registry with the packaged PIE tools
const toolRegistry = createPackagedToolRegistry();

// Optional: wire lazy module loaders at bootstrap
const lazyRegistry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
});

// Optional: replace default tag mapping/factories for selected tools
const customRegistry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
  toolTagMap: {
    calculator: 'my-calculator-tool'
  },
  toolComponentFactories: {
    calculator: ({ tagName }) => document.createElement(tagName)
  }
});

// Optional: provide only section-level default loaders
import {
  registerSectionToolModuleLoaders
} from '@pie-players/pie-default-tool-loaders';
registerSectionToolModuleLoaders(customRegistry);

// Or create custom registry
const selectiveRegistry = new ToolRegistry();
selectiveRegistry.register(calculatorToolRegistration);
selectiveRegistry.register(ttsToolRegistration);
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
- Highlighter - text highlighting

**Interaction-Specific Tools**:
- Answer Eliminator - strike through choices (choice questions only)

**Measurement Tools** (element level):
- Ruler - on-screen ruler
- Protractor - angle measurement

### PNP Resolution

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  tools: { placement: { item: ["calculator", "textToSpeech", "theme"] } }
});
coordinator.updateAssessment(assessment);
coordinator.updateCurrentItemRef(itemRef);

const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);
// Returns: ["calculator", "textToSpeech", "theme", ...]
```

The policy engine reads QTI 3.0 `accessibilityInfo.accessFeature` arrays and maps them to tool IDs using the tool registry's PNP index.

### Filtering by Context

```typescript
// Pass 1: Orchestrator determines allowed tools
const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);

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

### ItemToolBar

The `ItemToolBar` component supports registry-driven operation and explicit tool lists:

**Registry-driven tools**:
```html
<pie-item-toolbar
  .toolRegistry={toolRegistry}
  .pnpResolver={pnpResolver}
  .assessment={assessment}
  .itemRef={itemRef}
  .item={item}
></pie-item-toolbar>
```

**Explicit tools list**:
```html
<pie-item-toolbar
  tools="calculator,tts,answerEliminator"
  item-id="question-1"
></pie-item-toolbar>
```

### Host-Provided Toolbar Buttons/Links

Both `pie-item-toolbar` and `pie-section-toolbar` accept a `hostButtons` property.
This is appended after native tool buttons and supports either clickable buttons or links.

```ts
type ToolbarItem = {
  id: string;
  label: string;
  ariaLabel?: string;
  icon?: string;      // inline SVG, URL, or icon key
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
} & (
  | { onClick: () => void }                       // button mode
  | { href: string; target?: string; rel?: string } // link mode
);
```

Example:

```html
<pie-item-toolbar id="item-toolbar"></pie-item-toolbar>
<script>
  const toolbar = document.getElementById("item-toolbar");
  toolbar.hostButtons = [
    { id: "help", label: "Help", href: "/help/tools", target: "_blank", rel: "noopener" },
    { id: "flag", label: "Flag", icon: "flag", onClick: () => console.log("flagged") }
  ];
</script>
```

## Default Tool Placement

The toolkit provides recommended tool placement by context level:

```typescript
import { DEFAULT_TOOL_PLACEMENT } from '@pie-players/pie-assessment-toolkit';

DEFAULT_TOOL_PLACEMENT.assessment  // ["theme"]
DEFAULT_TOOL_PLACEMENT.section     // ["theme", "textToSpeech"]
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
- **Annotation Toolbar** - Singleton selection gateway (section-scoped)
- **Highlighter** - Shows when readable text exists

## Activation Models

Tool registration supports explicit activation semantics:

- `toolbar-toggle` (default): rendered as a regular toolbar button and toggled by the coordinator.
- `selection-gateway`: mounted as a singleton gateway that reacts to text selection and opens in-place actions.
- `region`: rendered into a host surface, with no toolbar button and no icon.

### Selection-Gateway Example

`annotationToolbar` is registered as:

- `activation: "selection-gateway"`
- `singletonScope: "section"`

This keeps one active annotation gateway per section runtime while still honoring canonical tool config (`policy`, `placement`, `providers`).

### Selection Actions

A gateway acting on the learner's selection has to hand it to a tool it does not mount, under a scoped instance id it cannot construct. Two halves make that possible, and each belongs to a different layer.

`ToolSelectionAction` is what a gateway renders: an id, a label, optional icon markup, an `isAvailable` predicate asked per selection, and a `run(selection)`. The gateway knows nothing about what an action does. The pairing of an action to a capability belongs to whoever composes them — `@pie-players/pie-default-tool-loaders` for the packaged set — which is what keeps a highlighter from naming a dictionary and lets a host contribute an action for a capability PIE does not ship.

The coordinator supplies the other half:

```ts
coordinator.canRequestTool("dictionary"); // gate the affordance before offering it
coordinator.requestTool({ toolId: "dictionary", params: { term } });
```

A toolbar claims requests for its placement level through `registerToolRequestTarget`, turns the unscoped id into a scoped instance, applies `params` and shows the tool. `params` layer over whatever a host's `ToolContextResolver` returned and arrive through `getToolRenderParams`, so a tool already reading that seam receives a request with no new code.

Resolution is a claim, not a broadcast: exactly one target answers, the one at the requested level that hosts the tool. `level` defaults to `"section"`, the level at which a whole section shares one instance and the level a section-scoped gateway can address unambiguously. At `"item"` and `"passage"` a section holds one target per card and the first that hosts the tool claims the request, so a requester needing a particular card's instance cannot express that.

An action is a shortcut and never a capability's only entry point. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on — an OS toggle absent on mobile — so a sighted keyboard-only learner cannot originate one. A capability reachable only through a selection gateway is unreachable for them, which is why both dictionaries keep a toolbar button and their own term field.

## Host Surfaces

Not every policy-addressable capability is a toolbar surface. A signed alternate renders as its own region beside item content; asking `decide({ level: "item" })` about it answers the wrong question, since it comes back absent because nothing placed it rather than because policy said no. That is why a host gates a `region` capability on `decideFeaturePolicy` — the placement-scoped question cannot be made to work, since placing a region capability is itself a `tools.unplaceableActivation` error.

A capability that renders somewhere other than a toolbar declares which host surfaces it fits, and implements `renderSurface`:

```ts
export const alternateMediaRegistration: ToolRegistration = {
  toolId: 'hostAlternateMedia',
  name: 'Alternate media',
  description: 'Docked alternate media for an item',
  supportedLevels: ['item'],
  activation: 'region',
  surfaces: ['content-media'],
  pnpSupportIds: ['hostAlternateMedia'],
  requiresAuthoredContent: {
    description: 'an alternate-media catalog card on the item',
    resolve: ({ catalogs }) => findAlternateMediaCard(catalogs),
  },
  renderSurface: (context) => {
    // Through `resolveToolTag`, not a literal tag: that is what lets a deployment
    // substitute its own element for this capability through `componentOverrides`.
    const tagName = resolveToolTag(context.toolId, context.componentOverrides ?? {});
    if (!customElements.get(tagName)) return null;
    const element = document.createElement(tagName) as HTMLElement & {
      media?: unknown;
    };
    // Reads the context it is handed, never the one captured at mount: `sync` is
    // called with the current context, and closing over this one re-applies the
    // values the host already had.
    const apply = (current: ToolSurfaceRenderContext) => {
      element.media = current.content;
    };
    apply(context);
    return { element, ariaLabel: 'Alternate media', sync: apply };
  },
};
```

Surface names belong to the host, not to this package. Core validates only that a region capability claims at least one, so a host can open a new surface without a change here. `section-player` ships three:

| Surface | Scope | Grant question | Content dependency |
| --- | --- | --- | --- |
| `content-lead` | per item or passage card | `decideFeaturePolicy` | resolved and passed as `content` |
| `content-media` | per item or passage card | `decideFeaturePolicy` | resolved and passed as `content` |
| `section-overlay` | section singleton | `decideFeaturePolicy` for `region`, `decideToolPolicy` for a placed toolbar activation | not resolvable — see below |

A renderer finds what it can mount by asking the registry, which is what keeps it from naming a capability. `section-player` centralizes that work in its internal Tool Surface Host: the geometry adapters provide only a surface name, anchor, scope, registry, and runtime services. The host owns discovery, policy/catalog invalidation, content resolution, structural comparison, lazy loading, mount/sync/teardown, and per-capability failure isolation.

```ts
const unsubscribe = registry.onRegistryChange((event) => {
  // Re-query the affected surface after a successful register, override,
  // unregister, clear, component-override, or module-loader change.
  reconcileSurface(event);
});

// Later, when the renderer is disposed:
unsubscribe();
```

`onRegistryChange` delivers successful mutations synchronously in registry order. Invalid and no-op mutations do not emit; listener failures are isolated; the returned unsubscribe is idempotent. Existing hosts do not need to subscribe just to use section-player — its Tool Surface Host does that automatically.

Reconcile by `toolId` on re-resolve and call `sync(context)` with a freshly built context rather than remounting: a `<video>` recreated mid-playback restarts the recording, and a capability handed its render-time context back learns nothing. Call `destroy()` and remove the element when a capability loses its grant — including when losing the last one destroys the surface itself, where returning early leaves a detached element with its listeners and playback intact. `renderSurface() === null` is a legitimate mountable-but-unoccupied answer.

Resolution, loading, rendering, synchronization, and teardown failures are isolated to one capability. Section-player reports them as `kind: "tool-surface"`, `severity: "warning"`, `recoverable: true`; recoverable warnings remain observable through the normal framework-error routes without moving section readiness to `error`.

A content dependency is resolvable only on a surface the host renders per item or per passage. The catalog resolver binds that content owner to a `CatalogOwnerView`; the Tool Surface Host passes the view's immutable `CatalogOwnerSnapshot` as `ToolContentDependencyContext.catalogs`. The snapshot already reflects entity-root, extracted, and model traversal plus registration precedence, so a capability interprets its own card type without receiving the raw entity, resolver, or owner identifiers. A section has no content owner, so `section-overlay` declines a capability that declares a content dependency instead of mounting it with nothing.

`@pie-players/pie-tool-sign-language` is the shipped example of this end to end: a
capability package that owns its registration, its content resolver and its
element, registered by the host rather than by us.

Three consequences of `activation: "region"`:

- `icon`, `renderToolbar` and `isVisibleInContext` are not required — there is no button to put them on, and the question `isVisibleInContext` would answer (is there anything to show here) is `requiresAuthoredContent`. All three stay required for the two toolbar activations, so no existing registration is relaxed. A registration without `isVisibleInContext` is never returned by `getVisibleTools`.
- Naming a region capability in `placement.{section,item,passage}` is a `tools.unplaceableActivation` error. It would never render there, and reporting it at the config rather than at render time is the difference between a diagnostic and a silently absent accommodation.
- `renderForToolbar` throws with the activation named if a caller asks a region capability for a button.

A capability can be both: `annotationToolbar` is a toolbar button at item and passage level *and* a section-scoped singleton, so it carries `renderToolbar` and `renderSurface` together.

## Content Dependencies

Some capabilities need authored content before they have anything to show. Signing needs a catalog card, braille a transcription, authored SSML a `<speak>` in that item. A registration declares that with `requiresAuthoredContent`:

```ts
requiresAuthoredContent: {
  description: 'a sign-language catalog card on the item',
  resolve: ({ catalogs, parameters }) =>
    findSigningCard(catalogs, parameters),
},
```

This is the resource half of AfA's PNP/DRD pair, and it is intrinsic to the capability — unlike eligibility tier, which is a property of the program and belongs in policy configuration.

Two independent things follow, and both were previously done by naming ids in core:

- **Availability is grant AND content.** A host renders only when policy granted the feature *and* `resolve` returned something. Neither half implies the other and neither is a default, so a learner who has the accommodation still sees nothing on an item carrying no resource — no dead affordance. `resolve`'s return value is handed straight back through `ToolSurfaceRenderContext.content`; the host never inspects it, which is what keeps the host from knowing which accommodation it is resolving.
- **It is never granted wholesale.** `registry.getContentDependentSupportIds()` is what a host filters a default grant list on, in place of a compile-time array of ids it cannot extend. A host adding its own accommodation gets the same guarantee by declaring the dependency.

A registration declaring a content dependency must carry at least one `pnpSupportIds` entry — that is what a host filters on, so declaring the dependency with nothing to filter would silently drop the second guarantee. Registration rejects it.

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

## Registry-Based Configuration

### Explicit Static Lists

```typescript
// Hardcoded tool list
const tools = "calculator,tts,answerEliminator";

// PNPMapper with static mappings
const toolIds = PNPMapper.mapPNPToTools(pnpProfile);
```

### Registry-Based

```typescript
// Create registry
const toolRegistry = createPackagedToolRegistry();

// Policy engine uses registry + coordinator inputs
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  toolRegistry,
  tools: { placement: { item: ["calculator", "textToSpeech"] } }
});
coordinator.updateAssessment(assessment);
coordinator.updateCurrentItemRef(itemRef);
const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);

// Filter by context
const visibleTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);
```

## PNP Precedence Hierarchy

The policy engine implements a **precedence hierarchy** based on common assessment platform governance patterns. This hierarchy is **not defined by QTI 3.0 standards** but follows common practices in K-12 assessment platforms.

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
- The precedence logic is implemented by `PnpPolicySource` inside the tool policy engine.
- Integrators can extend policy decisions with custom `PolicySource` implementations.

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
