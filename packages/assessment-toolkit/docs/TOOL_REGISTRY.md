# Tool Registry Reference

The toolkit's `ToolRegistry` holds the tools a deployment recognizes. This reference covers how a registered tool reaches a toolbar, what a registration declares, and how a host composes, renders and extends the registry. It is for tool authors and for host integrators composing a tool set. The policy inputs that grant and block tools, and their precedence, are in the [PNP configuration guide](./PNP_CONFIGURATION.md).

## Overview

The registry and the toolkit's policy engine together:

1. **Apply a three-pass visibility model**: policy decides which placed tools a toolbar may show (Pass 1), each tool decides whether it is relevant to the content (Pass 2), and a tool that declares an applicability gate removes itself from content it cannot act on (Pass 3)
2. **Grant from the learner's Personal Needs and Preferences (PNP) profile**: a profile's support id is the `toolId` it grants. A grant protects a placed tool from relevance filtering and carries its settings; it never places a tool that `tools.placement` leaves out
3. **Filter by content**: a tool shows or hides based on what the content holds
4. **Type registrations**: every registration implements the exported `ToolRegistration` interface

### Canonical IDs and Component Resolution

- Toolkit APIs use semantic `toolId` values (for example `calculator`, `textToSpeech`).
- Custom element tags (for example `pie-tool-calculator`) are resolved through `toolTagMap`.
- Integrators override both the tag mapping and the creation logic through
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

A tool can hide itself and cannot overturn policy:

- Policy allows a tool: the tool can still hide itself through `isVisibleInContext`, unless a grant protects it
- Policy withholds a tool: the tool cannot add itself back, since it is absent from the decision

`filterDecidedToolIds(entries, level, contexts)` enforces this by filtering only the entries of the policy decision it is given. It applies the toolbar's rule, and `<pie-item-toolbar>` calls it:

- **Pass 2** is skipped at section level, where relevance would depend on item content, and for a tool whose policy entry is `required` or `alwaysAvailable`, so a relevance heuristic cannot withdraw a granted accommodation.
- **Pass 3** runs below section level once content has resolved. A registration that declares `isApplicableToContent(context)` and answers `false` for every context at its placement is removed even under a grant, because a control that provably does nothing serves no learner. The answer eliminator declares this gate, answering `false` for content with no choice interaction.

A tool whose visibility a host `ToolContextResolver` decided keeps that answer, since the host may own an adapter that works with the content.

### Refresh and init contract

A toolbar container can stay mounted; its button visibility is re-evaluated on every init and render refresh:

1. Decide the toolbar's tools (Pass 1).
2. Rebuild the current item and element `ToolContext`s.
3. Call `filterDecidedToolIds(decision.visibleTools, level, contexts)` (Passes 2 and 3).
4. Render only the resulting buttons.

## Support ids

A tool's `toolId` is its PNP support id: a profile, district policy or item grants a tool by listing its id, and the registry a host composes is the only list of ids a deployment recognizes. Which supports a deployment offers is therefore known only at runtime, from the tools registered and the policy applied to them. An id no registered tool carries raises `tool-policy.unknownSupportId`, which the toolkit coordinator logs once per id and the PNP debugger lists.

A new tool whose capability [AfA PNP 3.0](https://www.imsglobal.org/spec/afa/v3p0/info) names takes that term as its id, camelCased, since AfA terms are kebab-case. Among the packaged ids, `transcript` is an AfA term and `lineReader` is `line-reader`; `signLanguage`, from `@pie-players/pie-tool-sign-language`, is `sign-language`.

Other packaged ids name an AfA capability in other words, so a host holding a profile in AfA terms translates them:

| AfA term | Tool id |
| --- | --- |
| `calculator-on-screen` | `calculator` |
| `spoken` | `textToSpeech` |
| `answer-masking` | `answerEliminator` |
| `dictionary-on-screen` | `dictionary` |

AfA has no term for `ruler`, `protractor`, `graph`, `periodicTable` or `annotationToolbar`.

Keep a tool id stable once profiles use it: renaming it drops the grant from every profile that lists the old id. That is why an existing id keeps its name where the AfA term differs, as `textToSpeech` does for `spoken`.

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
      active: toolbarContext.isToolVisible(this.toolId)
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
        button.active = toolbarContext.isToolVisible(this.toolId);
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

A tool's module loads when its element first renders, through the registry's loader for that tool id. A tag in `toolTagMap` must be the tag that module defines: the packaged calculator loader defines `pie-tool-calculator`, so `customRegistry` above renders a blank calculator unless the host defines `my-calculator-tool` itself. The registry warns about an undefined tag only for a tool with no loader.

A calculator's provider reads `tools.providers.calculator`:

- `provider.id` selects Desmos (the default), GeoGebra or the keyless Cortex.
- `provider.init` configures loading. Desmos needs an API key, which `provider.init.proxyEndpoint` can return or, in development, `provider.init.apiKey` can carry.
- `provider.runtime.authFetcher` supplies the key from the host at runtime.
- `settings` goes to the vendor adapter.

[Configuring Tools](../../../docs/tools-and-accomodations/tool_provider_system.md#calculator-with-host-auth) covers the key sources.

### Default Tools

`createPackagedToolRegistry()` registers 15 capabilities. After each, the content its relevance check (Pass 2) accepts:

**Global accessibility tools** (assessment and section level):
- The color-scheme tool (`theme`): color schemes and contrast; any content

**Content-smart tools**:
- Calculator (`calculator`, item level): basic, scientific and graphing; math content
- Graph (`graph`): coordinate plane; math content
- Periodic Table (`periodicTable`): chemistry reference; science content

**Reading support tools**:
- Text-to-Speech (`textToSpeech`): reads content aloud; readable text of 10 or more characters, or a catalog reference (`data-catalog-idref`) whose spoken card it reads
- Line Reader (`lineReader`): reading guide overlay; readable text
- Annotation toolbar (`annotationToolbar`): highlights and annotates text with the CSS Custom Highlight API; readable text. It also runs as a section-scoped singleton selection gateway ([Activation Models](#activation-models))
- Dictionary, Picture Dictionary, Spanish Dictionary, Spanish Picture Dictionary (`dictionary`, `pictureDictionary`, `dictionarySpanish`, `pictureDictionarySpanish`): word definitions and pictures; readable text

**Interaction-specific tools**:
- Answer Eliminator (`answerEliminator`, item level): strikes through choices; multiple choice, inline choice, select text and evidence-based selected response (EBSR) interactions only, which its applicability gate (Pass 3) also enforces

**Measurement tools** (section, item and element level):
- Ruler (`ruler`): on-screen ruler; math content
- Protractor (`protractor`): angle measurement; math content

**Content region** (no toolbar button):
- Audio Transcript (`transcript`): an item's or passage's audio transcript, rendered into the `content-lead` surface

### PNP Resolution

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// The toolbar rendering below mounts tool elements, so the registry carries loaders
const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  toolRegistry,
  tools: { placement: { item: ["calculator", "textToSpeech"] } }
});
coordinator.updateAssessment(assessment);
// An item's <pie-item-scope> registers its settings when it mounts.
coordinator.registerItemSettings(itemRef.identifier, itemRef.settings);

const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: itemRef.identifier } })
  .visibleTools.map((tool) => tool.toolId);
// Returns: ["calculator", "textToSpeech"]
```

The policy engine reads the assessment's `personalNeedsProfile`, `settings.districtPolicy` and `settings.testAdministration` and, for a decision scoped to an item, that item's registered `settings`. A support id in any of them is a tool id: `supports: ["calculator"]` grants the tool registered as `calculator`.

Two diagnostics report policy input that reaches no toolbar:

- `tool-policy.unknownSupportId`: an id no tool is registered under, naming the fields that list it. It describes the inputs, so it rides on the engine's resolved inputs (`coordinator.getPolicyInputs().diagnostics`), recomputed when the assessment, an item's settings or the registry's tool ids change.
- `tool-policy.requiredToolBlocked`: a requirement that a host gate keeps off every toolbar (`policy.blocked`, the allowlist, a disabled provider, or no level of `placement` listing it). It rides on the toolbar decision. A requirement placed at another level is served there and raises nothing.

The toolkit coordinator logs each once per code and tool and hands it to its `onPolicyDiagnostic` listeners.

### Filtering by Context

```typescript
// Pass 1: Orchestrator determines allowed tools
const decision = coordinator.decideToolPolicy({
  level: "item",
  scope: { level: "item", scopeId: itemRef.identifier }
});

const context: ItemToolContext = {
  level: "item",
  assessment,
  section,
  itemRef,
  item
};

// Passes 2 and 3: relevance, which a granted entry skips, then applicability
const visibleToolIds = toolRegistry.filterDecidedToolIds(decision.visibleTools, "item", [context]);
// Returns: tool ids that passed all three gates, in decision order
```

### Toolbar Rendering

```typescript
// Load the tools' element modules, then render through the registry,
// which attaches its component overrides
await toolRegistry.ensureToolModulesLoaded(visibleToolIds);
for (const toolId of visibleToolIds) {
  const result = toolRegistry.renderForToolbar(toolId, context, toolbarContext);
  if (!result) continue;
  // result.button: toolId, label, icon, ariaLabel, onClick, active
  // result.elements: tool elements to mount beside the buttons
  // result.sync: re-applies state after a visibility change
}
```

`<pie-item-toolbar>` runs this loop with the `ToolbarContext` it builds for its scope.

## UI Components

### Item toolbar

`<pie-item-toolbar>` takes its registry from its `toolRegistry` property, else from the toolkit coordinator in scope. With neither it renders no buttons; when policy places tools on it and its registry stays empty, it warns once per page.

Inside `<pie-assessment-toolkit>` it shows the coordinator's policy decision for its level and scope. The toolkit forwards its `assessment` and `toolRegistry` properties to the coordinator it builds; a host that passes its own `coordinator` binds the assessment with `updateAssessment`.

An item's settings reach the decisions of its own item-level toolbar through the `settings` property of its `<pie-item-scope>`; section- and assessment-level toolbars ignore them ([PNP Configuration](./PNP_CONFIGURATION.md#scope-of-item-settings)).

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
</script>
```

The toolkit README's [Without a Section Player](../README.md#without-a-section-player) section covers this form.

**Standalone `tools` attribute**: the `tools` attribute applies only when no toolkit is in scope. Its ids still resolve against `toolRegistry`, and with no tool coordinator the buttons cannot open their tools, so this form suits static demos only.
```html
<pie-item-toolbar
  tools="calculator,textToSpeech,answerEliminator"
  item-id="question-1"
></pie-item-toolbar>
```

### Host toolbar buttons and links

`<pie-item-toolbar>` and `<pie-section-toolbar>` both take a `hostButtons` property. Its entries render after the tool buttons, each as a button or a link.

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

## Activation Models

Tool registration supports explicit activation semantics:

- `toolbar-toggle` (default): rendered as a regular toolbar button and toggled by the coordinator.
- `selection-gateway`: mounted as a singleton gateway that reacts to text selection and opens in-place actions.
- `region`: rendered into a host surface, with no toolbar button and no icon.

### Selection-Gateway Example

`annotationToolbar` is registered as:

- `activation: "selection-gateway"`
- `singletonScope: "section"`

One annotation gateway is active per section runtime, and it still honors the tool config (`policy`, `placement`, `providers`).

### Selection Actions

A gateway acting on the learner's selection has to hand it to a tool it does not mount, under a scoped instance id it cannot construct. Two halves make that possible, and each belongs to a different layer.

`ToolSelectionAction` is what a gateway renders: an id, a label, optional icon markup, an `isAvailable` predicate asked per selection, and a `run(selection)`. The gateway knows nothing about what an action does. The pairing of an action to a capability belongs to whoever composes them — `@pie-players/pie-default-tool-loaders` for the packaged set — which keeps the annotation toolbar from naming a dictionary and lets a host contribute an action for a capability PIE does not ship.

The coordinator supplies the other half:

```ts
coordinator.canRequestTool("dictionary"); // gate the affordance before offering it
coordinator.requestTool({ toolId: "dictionary", params: { term } });
coordinator.canRequestTool("calculator", "item", itemId); // one card's toolbar
```

A toolbar claims requests for its placement level through `registerToolRequestTarget`, turns the unscoped id into a scoped instance, applies `params` and shows the tool. `params` layer over whatever a host's `ToolContextResolver` returned and arrive through `getToolRenderParams`, so a tool already reading that seam receives a request with no new code.

Exactly one target claims a request: the one at the requested level that hosts the tool.

- A request naming a level is held to it.
- A request naming none prefers `"section"`, where a whole section shares one instance and a section-scoped gateway can address it unambiguously. Otherwise it goes to the first toolbar at any level that hosts the tool.
- At `"item"` and `"passage"` a section holds one target per card, and the first that hosts the tool claims the request unless the request names the card's `scopeId`. A control inside one card, such as the inline calculator, names it.
- A toolbar whose module load for a tool failed stops hosting that tool, and the coordinator re-announces the targets through `onToolRequestTargetsChange`.

An action is a shortcut and never a capability's only entry point. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on — an OS toggle absent on mobile — so a sighted keyboard-only learner cannot originate one. A capability reachable only through a selection gateway is unreachable for them, which is why both dictionaries keep a toolbar button and their own term field.

## Host Surfaces

Not every policy-addressable capability is a toolbar surface. A signed alternate renders as its own region beside item content. A host gates a `region` capability on `decideFeaturePolicy`, because an item-level `decideToolPolicy(...)` reports it absent whenever nothing placed it, whatever policy says, and placing a region capability is a `tools.unplaceableActivation` error.

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

Surface names belong to the host. Core validates only that a region capability claims at least one, so a host can open a new surface without a change here. `section-player` ships three:

| Surface | Scope | Grant question | Content dependency |
| --- | --- | --- | --- |
| `content-lead` | per item or passage card | `decideFeaturePolicy` | resolved and passed as `content` |
| `content-media` | per item or passage card | `decideFeaturePolicy` | resolved and passed as `content` |
| `section-overlay` | section singleton | `decideFeaturePolicy` for `region`, `decideToolPolicy` for a placed toolbar activation | not resolvable — see below |

A renderer finds what it can mount by asking the registry, which keeps it from naming a capability. `section-player` centralizes that work in the toolkit's [Tool Surface Host](../../../CONTEXT.md#tool-surface-language) (`createToolSurfaceHost` on `tools/registration`). Its geometry adapters provide only a surface name, anchor, scope, registry and runtime services. The Tool Surface Host owns discovery, policy and catalog invalidation, content resolution, structural comparison, lazy loading, mount, sync and teardown, and per-capability failure isolation.

```ts
const unsubscribe = registry.onRegistryChange((event) => {
  // Re-query the affected surface after a successful register, override,
  // unregister, clear, component-override, or module-loader change.
  reconcileSurface(event);
});

// Later, when the renderer is disposed:
unsubscribe();
```

`onRegistryChange` delivers successful mutations synchronously in registry order. Invalid and no-op mutations do not emit; listener failures are isolated; the returned unsubscribe is idempotent. A host using section-player needs no subscription of its own, since its Tool Surface Host subscribes.

On re-resolve, reconcile by `toolId` and call `sync(context)` with a freshly built context instead of remounting: a `<video>` recreated mid-playback restarts the recording, and a capability handed its render-time context back learns nothing.

When a capability loses its grant, call `destroy()` and remove the element. That holds when losing the last grant destroys the surface itself: returning early there leaves a detached element with its listeners and playback intact.

`renderSurface() === null` is a legitimate answer: the surface is mountable and unoccupied.

Resolution, loading, rendering, synchronization, and teardown failures are isolated to one capability. Section-player reports them as `kind: "tool-surface"`, `severity: "warning"`, `recoverable: true`; recoverable warnings remain observable through the normal framework-error routes without moving section readiness to `error`.

A content dependency is resolvable only on a surface the host renders per item or per passage. The catalog resolver binds that content owner to a `CatalogOwnerView`, and the Tool Surface Host passes the view's immutable `CatalogOwnerSnapshot` as `ToolContentDependencyContext.catalogs` (both terms are defined in [CONTEXT.md](../../../CONTEXT.md#tool-surface-language)). The snapshot already reflects entity-root, extracted and model traversal plus registration precedence, so a capability interprets its own card type without receiving the raw entity, the resolver or owner identifiers.

A section has no content owner, so `section-overlay` declines a capability that declares a content dependency instead of mounting it with nothing.

`@pie-players/pie-tool-sign-language` is the shipped end-to-end example: a capability package that owns its registration, its content resolver and its element, which the host registers.

Three consequences of `activation: "region"`:

- `icon`, `renderToolbar` and `isVisibleInContext` are not required — there is no button to put them on, and the question `isVisibleInContext` would answer (is there anything to show here) is `requiresAuthoredContent`. All three stay required for the two toolbar activations. A registration without `isVisibleInContext` is never returned by `getVisibleTools`.
- Naming a region capability in `placement.{section,item,passage}` is a `tools.unplaceableActivation` error. It would never render there, and reporting it at config time turns a silently absent accommodation into a diagnostic.
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

This is the resource half of AfA's PNP/DRD pair, where the Digital Resource Description (DRD) states what a resource offers. It is intrinsic to the capability. Eligibility tier is a property of the program and belongs in policy configuration.

Two independent rules follow:

- **Availability is grant AND content.** A host renders only when policy granted the feature *and* `resolve` returned something. Neither half implies the other and neither is a default, so a learner who has the accommodation still sees nothing on an item carrying no resource — no dead affordance. `resolve`'s return value is handed straight back through `ToolSurfaceRenderContext.content`; the host never inspects it, which is what keeps the host from knowing which accommodation it is resolving.
- **It is never granted wholesale.** A host filters a default grant list on `registry.getContentDependentSupportIds()`. A host adding its own accommodation gets the same guarantee by declaring the dependency.

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

2. **Register it** and map the tool id to the custom element you define, either in a registry of its own (`setComponentOverrides`) or beside the packaged tools (`createPackagedToolRegistry({ toolTagMap })`):

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

The registry's types are exported from the package root:

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

## Precedence

`PnpPolicySource`, inside the tool policy engine, resolves the district, test-administration, item and profile inputs through eight ordered rules. The [PNP configuration guide](./PNP_CONFIGURATION.md#precedence) lists them with their rule ids and effects.

AfA PNP 3.0 defines the profile's supports and prohibitions. Item settings, district policy and test administration are PIE extensions, and no standard defines the order; it follows common K-12 assessment-platform practice. A host adds rules of its own with a custom `PolicySource` ([Custom policy rules](./PNP_CONFIGURATION.md#custom-policy-rules)).

## References

- [PNP Configuration Guide](PNP_CONFIGURATION.md) - How integrators configure governance rules
- [Configuring Tools](../../../docs/tools-and-accomodations/tool_provider_system.md) - Placement, providers and host resolvers
- [CONTEXT.md](../../../CONTEXT.md) - Definitions of support id, placement, grant, tool surface and catalog owner
- [IMS AfA PNP 3.0 Information Model](https://www.imsglobal.org/spec/afa/v3p0/info)
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0)
- [Schema.org Accessibility Features](https://schema.org/accessibilityFeature)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
