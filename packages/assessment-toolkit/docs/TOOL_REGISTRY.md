# Tool Registry Architecture

The Tool Registry provides a **registry-based system** for managing assessment tools with support for AfA PNP 3.0 Personal Needs and Preferences (PNP) profiles and context-aware tool visibility.

## Overview

The Tool Registry replaces hardcoded tool lists with a flexible, extensible system that:

1. **Enforces a three-pass visibility model**: the orchestrator determines allowed tools (Pass 1), tools decide relevance (Pass 2), and a tool that declares an applicability gate removes itself from content it cannot act on (Pass 3)
2. **Grants from PNP profiles**: a profile's support id is the `toolId` it grants. A grant protects a placed tool from relevance filtering and carries its settings; it never places a tool that `tools.placement` leaves out
3. **Context-aware filtering**: Tools show/hide based on content analysis
4. **Type-safe registrations**: Full TypeScript support with standardized interfaces

### Canonical IDs and Component Resolution

- Toolkit APIs use semantic `toolId` values (for example `calculator`, `textToSpeech`).
- Web component tags (for example `pie-tool-calculator`) are resolved through `toolTagMap`.
- Integrators can override both tag mapping and creation logic via
  `createPackagedToolRegistry({ toolTagMap, toolComponentFactories })` from `@pie-players/pie-default-tool-loaders`.

## Architecture

### Three-Pass Visibility Model

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR LAYER                       │
│  (ToolkitCoordinator policy engine: PNP, policies)          │
│                                                              │
│  Pass 1: Determines allowedToolIds[]                        │
│  - Reads the AfA PNP 3.0 profile                            │
│  - Applies institutional policies                           │
│  - Grants by tool id: a support id is the toolId            │
└──────────────────────┬──────────────────────────────────────┘
                       │ allowedToolIds: ["calculator", "textToSpeech", ...]
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOOL REGISTRY LAYER                       │
│  (ToolRegistry + ToolRegistrations)                         │
│                                                              │
│  Pass 2: Filters by tool relevance                          │
│  - Checks supportedLevels (item/passage/element)            │
│  - Calls isVisibleInContext(context)                        │
│  - Skipped for required/alwaysAvailable grants              │
│  - Returns visible tools                                    │
│                                                             │
│  Pass 3: Vetoes inapplicable tools                          │
│  - Calls isApplicableToContent(context) where declared      │
│  - Removes the tool even under a grant                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ visibleTools: [ToolRegistration, ...]
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI LAYER                                │
│  (ItemToolBar, SectionToolBar)                              │
│                                                              │
│  Renders: Buttons for visible tools only                    │
└─────────────────────────────────────────────────────────────┘
```

### One-Way Veto Enforcement

Tools can **hide themselves** but cannot **override orchestrator's NO**:

- ✅ Orchestrator says YES → Tool can say NO (hide via `isVisibleInContext`)
- ❌ Orchestrator says NO → Tool cannot say YES (tool not in `allowedToolIds`)

This is enforced architecturally: `filterVisibleInContext()` only filters the `allowedToolIds` array.

`<pie-item-toolbar>` skips Pass 2 at section level, where relevance would depend on item content, and for a tool whose policy entry is `required` or `alwaysAvailable`, so a relevance heuristic cannot withdraw a granted accommodation. Pass 3 runs below section level once content has resolved: a registration that declares `isApplicableToContent(context)` and answers `false` for every context at its placement is removed even under a grant, because a control that provably does nothing serves no learner. A tool whose visibility a host resolver decided keeps that answer. The answer eliminator declares the gate, answering `false` for content with no choice interaction.

### Refresh / Init Contract

Toolbar containers may remain mounted, but button visibility is re-evaluated on each
init/render refresh:

1. Resolve `allowedToolIds` (Pass 1).
2. Rebuild the current `ToolContext`.
3. Call `filterVisibleInContext(allowedToolIds, context)` (Pass 2).
4. Drop each tool for which `isApplicableToAnyContext(toolId, contexts)` is `false` (Pass 3).
5. Render only the resulting buttons.

This keeps visibility deterministic and context-driven for every refresh cycle.

## Support ids

A tool's `toolId` is its PNP support id: a profile, district policy or item grants a tool by listing its id, and the registry a host composes is the only list of ids a deployment recognizes. Which supports a deployment offers is therefore known only at runtime, from the tools registered and the policy applied to them. An id no registered tool carries raises `tool-policy.unknownSupportId`, which the toolkit coordinator logs once per id and the PNP debugger lists.

A new tool whose capability [AfA PNP 3.0](https://www.imsglobal.org/spec/afa/v3p0/info) names takes that term as its id, camelCased, since AfA terms are kebab-case. Among the packaged ids, `transcript` is an AfA term and `lineReader` is `line-reader`; `signLanguage`, from `@pie-players/pie-tool-sign-language`, is `sign-language`. Other ids name an AfA capability in other words, so a host holding a profile in AfA terms translates them: `calculator-on-screen` to `calculator`, `spoken` to `textToSpeech`, `answer-masking` to `answerEliminator` and `dictionary-on-screen` to `dictionary`. AfA has no term for `ruler`, `protractor`, `graph`, `periodicTable` or `annotationToolbar`.

## Tool Registration

### Registering a Tool

```typescript
import type {
  ToolContext,
  ToolRegistration,
  ToolToolbarButtonDefinition,
  ToolToolbarRenderResult,
  ToolbarContext
} from '@pie-players/pie-assessment-toolkit/tools/registration';
import {
  createScopedToolId,
  createToolElement,
  hasMathContent
} from '@pie-players/pie-assessment-toolkit/tools/registration';

export const calculatorToolRegistration: ToolRegistration = {
  toolId: "calculator",
  name: "Calculator",
  description: "Multi-type calculator (basic, scientific, graphing)",
  icon: "calculator",

  // Which context levels support this tool
  supportedLevels: ["item"],

  // Pass 2: Is this tool relevant in the current context?
  isVisibleInContext(context: ToolContext): boolean {
    // Show only when math content is present
    return hasMathContent(context);
  },

  // Toolbar button and the floating element it toggles
  renderToolbar(
    context: ToolContext,
    toolbarContext: ToolbarContext
  ): ToolToolbarRenderResult {
    const fullToolId = createScopedToolId(
      this.toolId,
      toolbarContext.scope.level,
      toolbarContext.scope.scopeId
    );
    const calculator = createToolElement(
      this.toolId,
      context,
      toolbarContext,
      toolbarContext.componentOverrides
    ) as HTMLElement & { visible?: boolean };
    calculator.setAttribute("tool-id", fullToolId);

    const button: ToolToolbarButtonDefinition = {
      toolId: this.toolId,
      label: this.name,
      icon: "calculator",
      ariaLabel: "Calculator",
      tooltip: "Calculator",
      onClick: () => toolbarContext.toggleTool(this.toolId),
      active: toolbarContext.isToolVisible(fullToolId)
    };
    calculator.visible = button.active;

    return {
      toolId: this.toolId,
      button,
      elements: [
        {
          element: calculator,
          mount: "after-buttons",
          shell: { title: "Calculator", draggable: true, resizable: true, closeable: true }
        }
      ],
      // Called by the toolbar on render and on every tool visibility change
      sync: () => {
        button.active = toolbarContext.isToolVisible(fullToolId);
        calculator.visible = button.active;
      }
    };
  }
};
```

The packaged registration in `@pie-players/pie-default-tool-loaders` adds provider selection (Desmos, GeoGebra or Cortex), calculator-type render params and per-type window sizes.

### Tool Context

Tools receive a `ToolContext` that describes the current content context:

```typescript
type ToolLevel = "assessment" | "section" | "item" | "passage" | "rubric" | "element";

interface ItemToolContext {
  level: "item";
  assessment: AssessmentEntity;
  section?: AssessmentSection;
  itemRef: AssessmentItemRef;
  item: ItemEntity;
  passage?: PassageEntity;
}

interface ElementToolContext {
  level: "element";
  assessment: AssessmentEntity;
  section?: AssessmentSection;
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
  hasChoiceInteraction,
  type ToolContext
} from '@pie-players/pie-assessment-toolkit/tools/registration';

// Context has readable text (10+ characters)
const textToSpeech = {
  isVisibleInContext(context: ToolContext): boolean {
    return hasReadableText(context);
  },
};

// Context has math content (MathML, LaTeX, symbols)
const calculator = {
  isVisibleInContext(context: ToolContext): boolean {
    return hasMathContent(context);
  },
};

// Context has science content (chemistry, biology, physics terms)
const periodicTable = {
  isVisibleInContext(context: ToolContext): boolean {
    return hasScienceContent(context);
  },
};

// Context has a choice-based interaction
const answerEliminator = {
  isVisibleInContext(context: ToolContext): boolean {
    return hasChoiceInteraction(context);
  },
};
```

## Using the Tool Registry

### Creating a Registry

```typescript
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// Registrations plus module loaders: each tool's package loads on first render
const toolRegistry = createPackagedToolRegistry();

// Registrations only: the host defines the tool elements itself
const preloadedRegistry = createPackagedToolRegistry({ toolModuleLoaders: {} });

// Optional: replace default tag mapping/factories for selected tools
const customRegistry = createPackagedToolRegistry({
  toolTagMap: {
    calculator: 'my-calculator-tool'
  },
  toolComponentFactories: {
    calculator: ({ tagName }) => document.createElement(tagName)
  }
});

// Or register only the packaged tools you need
const selectiveRegistry = createPackagedToolRegistry({
  toolIds: ["calculator", "textToSpeech"]
});
```

A registration reaches the learner in this order: the toolbar keeps the tools policy places at its level (Pass 1), drops those `isVisibleInContext` rejects (Pass 2) and those `isApplicableToContent` rejects (Pass 3), and renders a button for each tool left. The tool's module loads when its element first renders, through the registry's loader for that tool id. A tag in `toolTagMap` must be the tag that module defines: the packaged calculator loader defines `pie-tool-calculator`, so `customRegistry` above renders a blank calculator unless the host defines `my-calculator-tool` itself. The registry warns about an undefined tag only for a tool with no loader. A calculator's provider reads `tools.providers.calculator`: `provider.id` selects Desmos or GeoGebra, `provider.init` configures loading, `provider.runtime.authFetcher` supplies the key, and `settings` goes to the vendor adapter ([Tool Provider System](../../../docs/tools-and-accomodations/tool_provider_system.md)).

### Default Tools

`createPackagedToolRegistry()` registers 15 capabilities, organized by purpose:

**Global Accessibility Tools** (assessment/section level):
- Theme (`theme`) - accessible themes and contrast

**Context-Smart Tools** (auto-detect content):
- Calculator (`calculator`) - basic, scientific, graphing (math content)
- Graph (`graph`) - coordinate plane (math content)
- Periodic Table (`periodicTable`) - chemistry reference (science content)

**Reading Support Tools** (text detection):
- Text-to-Speech (`textToSpeech`) - read content aloud
- Line Reader (`lineReader`) - reading guide overlay
- Highlighter (`annotationToolbar`) - highlight and annotate text with the CSS Custom Highlight API
- Dictionary, Picture Dictionary, Spanish Dictionary, Spanish Picture Dictionary (`dictionary`, `pictureDictionary`, `dictionarySpanish`, `pictureDictionarySpanish`) - word definitions and pictures

**Interaction-Specific Tools**:
- Answer Eliminator (`answerEliminator`) - strike through choices (choice questions only)

**Measurement Tools** (section, item and element level):
- Ruler (`ruler`) - on-screen ruler
- Protractor (`protractor`) - angle measurement

**Content Region** (no toolbar button):
- Audio Transcript (`transcript`) - an item's or passage's audio transcript, rendered into the `content-lead` surface

### PNP Resolution

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// The toolbar rendering below mounts tool elements, so the registry carries loaders
const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  toolRegistry,
  tools: { placement: { item: ["calculator", "textToSpeech", "theme"] } }
});
coordinator.updateAssessment(assessment);
// An item's <pie-item-scope> registers its settings when it mounts.
coordinator.registerItemSettings(itemRef.identifier, itemRef.settings);

const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);
// Returns: ["calculator", "textToSpeech", "theme", ...]
```

The policy engine reads the assessment's `personalNeedsProfile`, `settings.districtPolicy` and `settings.testAdministration`, and, for a decision scoped to an item, that item's registered `settings`. A support id in any of them is a tool id: `supports: ["calculator"]` grants the tool registered as `calculator`, and an id no tool is registered under produces a `tool-policy.unknownSupportId` diagnostic naming the fields that list it. A requirement that a block or a restriction outranks produces `tool-policy.requiredToolBlocked`. Both ride on the toolbar decision and the feature decision; the toolkit coordinator logs each once per code and tool.

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

const relevantTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);

// Pass 3: Drop tools that declare they cannot act on this content
const visibleTools = relevantTools.filter((tool) =>
  toolRegistry.isApplicableToAnyContext(tool.toolId, [context])
);
// Returns: ToolRegistration[] (only tools that passed all three gates)
```

### Toolbar Rendering

```typescript
// Load the tools' element modules, then render through the registry,
// which attaches its component overrides
await toolRegistry.ensureToolModulesLoaded(visibleTools.map((tool) => tool.toolId));
for (const tool of visibleTools) {
  const result = toolRegistry.renderForToolbar(tool.toolId, context, toolbarContext);
  if (!result) continue;
  // result.button: toolId, label, icon, ariaLabel, onClick, active
  // result.elements: tool elements to mount beside the buttons
  // result.sync: re-applies state after a visibility change
}
```

`<pie-item-toolbar>` runs this loop with the `ToolbarContext` it builds for its scope.

## UI Components

### ItemToolBar

`<pie-item-toolbar>` renders tool buttons only from its own `toolRegistry`; without one it renders none. Inside `<pie-assessment-toolkit>` it shows the coordinator's policy decision for its level and scope. The toolkit forwards its `assessment` property to the coordinator it builds; a host that passes its own `coordinator` binds it with `updateAssessment`. An item's settings reach the decisions of its own item-level toolbar through the `settings` property of its `<pie-item-scope>`; section- and assessment-level toolbars ignore them ([PNP Configuration](./PNP_CONFIGURATION.md#scope-of-item-settings)).

```html
<pie-assessment-toolkit id="toolkit">
  <pie-item-scope id="scope" item-id="question-1">
    <pie-item-toolbar id="toolbar"></pie-item-toolbar>
  </pie-item-scope>
</pie-assessment-toolkit>
<script>
  const toolkit = document.getElementById("toolkit");
  toolkit.tools = { placement: { item: ["calculator", "textToSpeech", "answerEliminator"] } };
  toolkit.toolRegistry = toolRegistry;
  toolkit.assessment = assessment;

  const scope = document.getElementById("scope");
  scope.item = item;
  scope.settings = itemRef.settings;
  document.getElementById("toolbar").toolRegistry = toolRegistry;
</script>
```

The toolkit README's [Without a Section Player](../README.md#without-a-section-player) section covers this form.

**Explicit tools list** (test fixtures): the `tools` attribute applies only when no toolkit is in scope. Its ids still resolve against `toolRegistry`, and with no tool coordinator the buttons cannot open their tools.
```html
<pie-item-toolbar
  tools="calculator,textToSpeech,answerEliminator"
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

The toolkit's default placement is empty at every level, so a coordinator with no `tools.placement` places no tools. The recommended placement names packaged capabilities, so it lives in `@pie-players/pie-default-tool-loaders`:

```typescript
import { SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT } from '@pie-players/pie-default-tool-loaders';

SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.section  // ["theme", "graph", "periodicTable", "lineReader", "ruler", "protractor", ...]
SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.item     // ["calculator", "textToSpeech", "answerEliminator", "annotationToolbar"]
SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage  // ["textToSpeech", "annotationToolbar"]
```

`SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` has exactly the levels `tools.placement` takes (`section`, `item`, `passage`). It is a recommendation; a host sets its own `tools.placement`.

## Tool Categories

Tools are organized by purpose:

### Global Tools
- **Theme** - Always visible when allowed, affects entire assessment

### Context-Smart Tools
- **Calculator** - Shows at item level when math content detected
- **Graph** (coordinate plane) - Shows when math content detected
- **Periodic Table** - Shows when science content detected

### Reading Support
- **Text-to-Speech** - Shows when readable text exists (10+ characters)
- **Line Reader** - Shows when readable text exists
- **Highlighter** (`annotationToolbar`) - Shows when readable text exists; runs as a section-scoped singleton selection gateway
- **Dictionaries** - Show when readable text exists

### Interaction-Specific
- **Answer Eliminator** - Shows only on choice-based questions (MC, inline choice, select text, EBSR)

### Measurement Tools
- **Ruler** - Shows when math content detected
- **Protractor** - Shows when math content detected

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
coordinator.canRequestTool("calculator", "item", itemId); // one card's toolbar
```

A toolbar claims requests for its placement level through `registerToolRequestTarget`, turns the unscoped id into a scoped instance, applies `params` and shows the tool. `params` layer over whatever a host's `ToolContextResolver` returned and arrive through `getToolRenderParams`, so a tool already reading that seam receives a request with no new code.

Resolution is a claim, not a broadcast: exactly one target answers, the one at the requested level that hosts the tool. `level` defaults to `"section"`, the level at which a whole section shares one instance and the level a section-scoped gateway can address unambiguously. At `"item"` and `"passage"` a section holds one target per card and the first that hosts the tool claims the request, unless the request names the card's `scopeId`; a control inside one card, such as the inline calculator, names it. A toolbar whose module load for a tool failed stops hosting that tool, and the coordinator re-announces the targets through `onToolRequestTargetsChange`.

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

A renderer finds what it can mount by asking the registry, which is what keeps it from naming a capability. `section-player` centralizes that work in the toolkit's Tool Surface Host (`createToolSurfaceHost` on `tools/registration`): the geometry adapters provide only a surface name, anchor, scope, registry, and runtime services. The host owns discovery, policy/catalog invalidation, content resolution, structural comparison, lazy loading, mount/sync/teardown, and per-capability failure isolation.

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

## Creating Custom Tools

To create a new tool:

1. **Create registration file** (e.g., `my-tool.ts`):

```typescript
import type {
  ToolContext,
  ToolRegistration,
  ToolToolbarRenderResult,
  ToolbarContext
} from '@pie-players/pie-assessment-toolkit/tools/registration';
import { createToolElement } from '@pie-players/pie-assessment-toolkit/tools/registration';

export const myToolRegistration: ToolRegistration = {
  toolId: "myTool",
  name: "My Tool",
  description: "Custom tool description",
  icon: "custom-icon",
  supportedLevels: ["item", "element"],

  isVisibleInContext(context: ToolContext): boolean {
    // Custom visibility logic
    return true;
  },

  renderToolbar(
    context: ToolContext,
    toolbarContext: ToolbarContext
  ): ToolToolbarRenderResult {
    // The element tag comes from the registry's tool tag map (step 2)
    const element = createToolElement(
      this.toolId,
      context,
      toolbarContext,
      toolbarContext.componentOverrides
    ) as HTMLElement & { visible?: boolean };
    const button = {
      toolId: this.toolId,
      label: this.name,
      ariaLabel: this.name,
      onClick: () => toolbarContext.toggleTool(this.toolId),
      active: toolbarContext.isToolVisible(this.toolId)
    };
    element.visible = button.active;

    return {
      toolId: this.toolId,
      button,
      elements: [{ element, mount: "after-buttons", shell: { title: this.name } }],
      sync: () => {
        button.active = toolbarContext.isToolVisible(this.toolId);
        element.visible = button.active;
      }
    };
  }
};
```

2. **Register with tool registry** and map the tool id to the custom element you define:

```typescript
import { ToolRegistry } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const registry = new ToolRegistry();
registry.register(myToolRegistration);
registry.setComponentOverrides({ toolTagMap: { myTool: "my-tool" } });

// Beside the packaged tools; setComponentOverrides would replace their tag map.
// The loaders load each packaged tool's element on first render.
const packagedRegistry = createPackagedToolRegistry({
  toolTagMap: { myTool: "my-tool" }
});
packagedRegistry.register(myToolRegistration);
```

3. **Place it, then grant it**: list `myTool` in `tools.placement` at each level where it renders. A profile listing `myTool` in `supports` then grants it, which keeps it on the toolbar through Pass 2; a grant alone renders nothing. The tool id is the support id, so there is no mapping to declare.

### Services, Providers and Config Hooks

A tool element reads the toolkit's services from the runtime context it connects to with `connectToolRuntimeContext`: the toolkit coordinator, the tool coordinator, the TTS service, the highlight coordinator, the catalog resolver and the element tool state store. That context is the one channel. An element declares no prop carrying a service and a registration assigns none onto the element it creates, because a value set at render goes stale when a context republish brings another coordinator.

A tool that needs a backend declares `provider` on its registration. The coordinator registers that provider under the tool's id, and the element starts it with `toolkitCoordinator.ensureProviderReady(baseToolId)`, where `baseToolId` is the tool id without its scope suffix (`parseScopedToolId(toolId)?.baseToolId`). `provider.id` in the tool's config selects an implementation and never renames the registration, so `updateToolConfig` selecting another implementation replaces the provider under the same id.

Config hooks belong to the registration, since they govern the tool's `tools.providers.<toolId>` entry whether or not the tool has a provider. Tools-config validation runs `sanitizeConfig` first and passes its result to `validateConfig`:

```typescript
export const myToolRegistration: ToolRegistration = {
  // ...the fields above
  provider: {
    createProvider: (config) => new MyToolProvider(config?.provider?.id),
    getInitConfig: (config) => config?.provider?.init ?? {},
  },
  sanitizeConfig: (config) => ({ ...config, settings: { ...config.settings } }),
  validateConfig: (config) =>
    config.settings?.mode === "unknown"
      ? [{
          code: "tools.providerValidateFailed",
          severity: "error",
          path: "providers.myTool.settings.mode",
          message: "Unknown mode.",
        }]
      : [],
};
```

## TypeScript Support

Full TypeScript definitions:

```typescript
import type {
  ToolRegistry,
  ToolRegistration,
  ToolContext,
  ToolLevel,
  ToolToolbarButtonDefinition,
  ToolToolbarRenderResult,
  ToolbarContext,
  ItemToolContext,
  ElementToolContext,
  PassageToolContext,
  RubricToolContext
} from '@pie-players/pie-assessment-toolkit';

```

## Registry-Based Configuration

### Explicit Static Lists

```typescript
// Hardcoded list for the toolbar's `tools` attribute, read only when no toolkit is in scope
const tools = "calculator,textToSpeech,answerEliminator";
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
coordinator.registerItemSettings(itemRef.identifier, itemRef.settings);
const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);

// Filter by context
const visibleTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);
```

## PNP Precedence Hierarchy

The policy engine implements a **precedence hierarchy** based on common assessment platform governance patterns. This hierarchy is **not defined by AfA PNP 3.0 or QTI 3.0** but follows common practices in K-12 assessment platforms.

### Standards-Based vs Implementation-Specific

**Standards-Based (from AfA PNP 3.0):**

- **PNP prohibitions and supports** (#4, #8) - Student's documented accessibility needs (`personalNeedsProfile.prohibitedSupports`, `personalNeedsProfile.supports`)

**Implementation-Specific (PIE extensions and common practice):**

- **Item-level settings** (#3, #6) - Per-item requirements and restrictions, a PIE extension registered by the item's `<pie-item-scope>`
- **District policy** (#1, #7) - Institutional governance and legal compliance
- **Test administration** (#2, #5) - Session-level operational control

### Precedence Order

`PnpPolicySource` applies these rules in order (highest to lowest priority):

1. **District block** (absolute veto)
   - **Purpose**: Legal/policy requirements
   - **Example**: District blocks calculator on state standardized math test
   - **Effect**: Tool completely unavailable, cannot be overridden

2. **Test administration withdrawal**
   - **Purpose**: Proctor/administrator operational control
   - **Example**: Proctor disables TTS due to technical issues in testing lab
   - **Effect**: `testAdministration.toolOverrides[toolId]` set to `false` disables the tool for this test session

3. **Item restriction** (per-item block)
   - **Purpose**: Content author can disable for specific items
   - **Example**: Calculator disabled on mental math questions
   - **Effect**: Tool unavailable on this item's own toolbar

4. **Profile prohibition** (student declines)
   - **Purpose**: The student's documented refusal of a support
   - **Example**: Student's profile declines text-to-speech
   - **Effect**: `personalNeedsProfile.prohibitedSupports` withdraws the tool, over a test-administration grant and every requirement

5. **Test administration grant**
   - **Purpose**: Proctor/administrator enables a tool for the session
   - **Example**: Proctor enables the calculator for a retake
   - **Effect**: `testAdministration.toolOverrides[toolId]` set to `true` grants the tool. An item restriction or a profile prohibition that withdraws it raises a `tool-policy.overrideBlocked` diagnostic

6. **Item requirement** (per-item grant)
   - **Purpose**: Required by IEP/504 or content needs
   - **Example**: Calculator required for multi-step word problems
   - **Effect**: A tool placed on this item's own toolbar stays there through relevance filtering; a requirement places no tool

Rungs 3 and 6 apply to decisions scoped to the item: its item-level toolbar and its content's feature decisions. A section-, assessment- or passage-level toolbar skips them and reports each tool on it that a mounted item restricts or requires with a `tool-policy.itemSettingNotApplied` diagnostic; place the tool at item level to enforce the setting per item.

7. **District requirement**
   - **Purpose**: Institutional accessibility requirements
   - **Example**: District mandates TTS for all ELL students
   - **Effect**: Grants a placed tool by institutional policy

8. **PNP supports** (student needs)
   - **Purpose**: AfA PNP 3.0 student supports
   - **Example**: Student's IEP document specifies a reading mask
   - **Effect**: `supports` grants a placed tool

### Governance Rationale

This hierarchy aligns with typical **IEP/504 accommodation hierarchies** in US K-12 education:

- **Institutional veto** (district) trumps individual preferences (legal compliance)
- **Session control** (test admin) enables operational flexibility for testing environments
- **Content restrictions** (item) prevent tools that invalidate assessment construct
- **Required accommodations** (IEP/504) ensure legal compliance with disability law
- **Student preferences** (PNP) are honored when not overridden by policy

### Important Notes

- The precedence order is a **common pattern** that no standard defines
- Different assessment platforms may implement different precedence rules
- The precedence logic is implemented by `PnpPolicySource` inside the tool policy engine.
- Integrators can extend policy decisions with custom `PolicySource` implementations.

## Best Practices

1. **Keep a tool id stable once profiles use it** - A profile grants the tool by its id, so renaming it drops the grant from every profile that lists the old id. An existing id keeps its name where the AfA term differs: the packaged `lineReader` serves the AfA `readingMask` feature
2. **Make tools context-aware** - Use helper functions like `hasMathContent()`, `hasReadableText()`
3. **Test all three passes** - Verify tools respect orchestrator allowance, context relevance and, where declared, the applicability veto
4. **Keep visibility logic simple** - Complex logic should be in helper functions, not in `isVisibleInContext()`
5. **Understand precedence** - Know which governance rules take priority in your platform

## References

- **[PNP Configuration Guide](PNP_CONFIGURATION.md)** - How integrators configure governance rules
- [IMS AfA PNP 3.0 Information Model](https://www.imsglobal.org/spec/afa/v3p0/info)
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0)
- [Schema.org Accessibility Features](https://schema.org/accessibilityFeature)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
