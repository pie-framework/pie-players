# PIE Assessment Toolkit

**Independent, composable services** for coordinating tools, accommodations, and item players in assessment applications.

This is not an opinionated framework or monolithic "player" - it's a toolkit that solves specific problems through centralized service management.

## Install

```bash
npm install @pie-players/pie-assessment-toolkit @pie-players/pie-default-tool-loaders
```

The examples build their tool registry with `createPackagedToolRegistry()` from
`@pie-players/pie-default-tool-loaders`, so a host that imports it declares it
in its own dependencies. The section player depends on it too, but strict
installers such as pnpm expose only the packages a host declares.

Server-backed TTS (`backend: "server"`) loads
`@pie-players/tts-client-server`, a dependency of
`@pie-players/pie-default-tool-loaders` whose TTS registration imports it on
first use. If it fails to load, TTS initialization reports a `provider-init`
framework error and falls back to browser speech.

A `ToolkitCoordinator` registers tool providers only from its `toolRegistry`.
Built without one, it adopts the registry of the toolkit it is bound to, such as
the section player's, which then validates its config and registers its
providers. A registry passed at construction is never replaced. Bound to a
toolkit that has none, it registers no providers, skips tool-id and placement
validation, and warns once (`tools.registryUnavailable`).

## What's New: ToolkitCoordinator

✨ **Centralized Service Management**: The new `ToolkitCoordinator` provides a single entry point for all toolkit services, simplifying initialization and configuration.

**Before** (scattered services):
```typescript
// Create 5+ services independently
const ttsService = new TTSService();
const highlightCoordinator = new HighlightCoordinator();
const catalogResolver = new AccessibilityCatalogResolver([...]);
// Missing: ElementToolStateStore

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Pass all services separately
player.ttsService = ttsService;
// ...
```

**After** (coordinator orchestrates):
```typescript
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// Create one coordinator with configuration
const toolRegistry = createPackagedToolRegistry();
const toolkitCoordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  toolRegistry,
  tools: {
    providers: {
      textToSpeech: { enabled: true, backend: 'browser' },
      // Desmos needs an application key; see "Simple Default" below.
      calculator: { enabled: true }
    },
    placement: {
      section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    }
  }
});

// Pass single coordinator to section-player through runtime
player.runtime = { ...(player.runtime ?? {}), coordinator: toolkitCoordinator };
```

## What Does It Solve?

- **Centralized service management**: One coordinator owns all toolkit services
- **Tool coordination**: z-index management, visibility state, element-level state
- **Accommodation support**: IEP/504 tool configuration logic
- **TTS + annotation coordination**: Prevent conflicts between highlights
- **Event communication**: Standard contracts between components
- **Accessibility theming**: Consistent high-contrast, font sizing
- **State separation**: Ephemeral tool state separate from persistent session data

## Instrumentation and Observability

Toolkit instrumentation is provider-agnostic and additive. It uses the shared
`InstrumentationProvider` contract from `@pie-players/pie-players-shared`.

### Injection Path

When toolkit is hosted by section/assessment player flows, the canonical
provider path is the item-player loader config:

- `runtime.player.loaderConfig.instrumentationProvider`

### Semantics

- With `trackPageActions: true`, missing/`undefined` providers use the default New Relic provider path.
- `instrumentationProvider: null` explicitly disables instrumentation.
- Invalid provider objects are ignored (optional debug warning), also no-op.
- Existing `item-player` behavior remains the compatibility anchor.
- Debug overlays can consume the same stream by composing providers with
  `CompositeInstrumentationProvider` (for example New Relic + debug panel).
- Toolkit telemetry forwarding uses the same provider path, so tool/backend
  instrumentation is sent to production providers and is visible in debug panel
  overlays.

### Toolkit-Owned Canonical Event Stream

- `pie-toolkit-runtime-owned`
- `pie-toolkit-runtime-inherited`
- `pie-toolkit-runtime-ready`
- `pie-toolkit-ready`
- `pie-toolkit-section-ready`
- `pie-toolkit-framework-error`

Toolkit tool/backend operational stream:

- `pie-tool-init-start|success|error`
- `pie-tool-backend-call-start|success|error`
- `pie-tool-library-load-start|success|error`

Ownership boundary: toolkit emits toolkit lifecycle semantics only. Section and
assessment semantic streams stay in their own layers to avoid overlap. Bridge
dedupe is a safety net, not a substitute for clear ownership.

## Architecture Overview

See the [ToolkitCoordinator section in the architecture overview](../../docs/architecture/architecture.md#toolkitcoordinator-centralized-service-management) for the current design documentation.

### Core Principles

1. **Centralized Coordination**: ToolkitCoordinator orchestrates all services
2. **Composable Services**: Import only what you need (or use coordinator for convenience)
3. **No Framework Lock-in**: Works with any JavaScript framework
4. **Product Control**: Products control navigation, layout and backend. Session persistence defaults to `localStorage` at the section and assessment layers, stored per attempt id and inactive without one, and a product replaces either through its persistence hook (`createSectionSessionPersistence` on the coordinator, `createAssessmentSessionPersistence` on the assessment player)
5. **Standard Contracts**: Well-defined event types for component communication
6. **Element-Level Granularity**: Tool state tracked per PIE element, not per item
7. **State Separation**: Tool state (ephemeral) separate from PIE session data (persistent)

## Configuration: attributes and a constructed coordinator

This package and `@pie-players/pie-section-player` give each input one entry
point (see [One tier per input](#one-tier-per-input)). A host that needs more
than the element inputs builds the coordinator itself.

### Element inputs and a constructed coordinator

- **Element attributes / properties.** Use these for the
  common cases that are static for the lifetime of the player or that hosts
  want to set declaratively in HTML / templating frameworks. Example:

  ```html
  <pie-assessment-toolkit
    assessment-id="my-assessment"
    section-id="s-1"
    tool-config-strictness="warn"
  ></pie-assessment-toolkit>
  ```

- **A constructed `ToolkitCoordinator` (or a
  `runtime` object on consumer CEs).** Use this for advanced cases: composed
  configuration, dynamic overrides, runtime mutation, fields without an
  attribute, or anything that benefits from being a single typed
  object passed by reference. Example:

  ```ts
  import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

  const toolRegistry = createPackagedToolRegistry();
  const coordinator = new ToolkitCoordinator({
    assessmentId: "my-assessment",
    toolRegistry,
    toolConfigStrictness: "warn",
    tools: {
      providers: { calculator: { enabled: true } },
      placement: { item: ["calculator", "textToSpeech"] },
    },
  });
  el.runtime = { ...(el.runtime ?? {}), coordinator };
  ```

### Naming rule

Top-level attributes use kebab-case (`assessment-id`,
`tool-config-strictness`). Section-player runtime configuration is grouped
under the `runtime` object instead of duplicated as top-level props.

### One tier per input

Each input has one entry point. On the section-player layout elements,
`runtime` carries `assessmentId`, the player, tool, accessibility,
coordinator, env and isolation fields, runtime factories and the `on*`
callbacks; attributes carry section identity, layout controls, `nds-icons`,
`locale` and `tool-config-strictness`. Unset inputs take their documented
defaults.

`<pie-assessment-toolkit>` takes the same fields as its own properties,
with `assessment-id`, `nds-icons`, `locale` and `tool-config-strictness` as
attributes, and reads `pnpEnforcement` from `tools.pnpEnforcement`.

### Canonical attribute set

- Identity: `assessment-id` on the toolkit, `section-id`, `attempt-id`
- Runtime config on section-player CEs: `runtime`
- Toolkit-only object properties: `tools`, `tool-registry`, `coordinator`,
  `accessibility`
- Interface: `nds-icons`, `locale`
- Diagnostics: `tool-config-strictness`, `debug`. Framework-error
  delivery is via the `onFrameworkError` callback (a toolkit property,
  `runtime.onFrameworkError` on a section player) and the
  `framework-error` DOM event dispatched on the layout CE host.

Inputs outside the runtime config:

- Identity (`section-id`, `attempt-id`, `section`): per-attempt host
  state, not configuration.
- Layout-only shell knobs on the section-player layout CEs
  (`show-toolbar`, `toolbar-position`, `narrow-layout-breakpoint`,
  `split-pane-collapse-strategy`): layout-CE rendering concerns.
- Per-region toolbar tool placement: hosts populate
  `tools.placement.item` / `tools.placement.passage` (object form) or
  `runtime.tools.placement.{item,passage}` directly.
- Runtime-only keys on the section-player layout CEs
  (`createSectionController`, `isolation`): accepted only via
  `runtime.<key>`. Section-player layouts forward both to the wrapped
  toolkit as properties. `<pie-assessment-toolkit>` keeps
  `createSectionController` JS-only and takes `isolation` as an
  attribute or a property. A `coordinator` passed to it wins over an
  outer toolkit's.

### When to add an attribute

Add an attribute only if all of the following hold:

- It is a common case that hosts set without composing a `ToolkitCoordinator`
  / `runtime` object.
- Its value is a primitive or small typed object that round-trips through
  HTML attributes (string, boolean-like, number; structured data passes via
  property assignment).
- It exists on every CE that conceptually owns the same knob, or has a
  deliberate documented exclusion.

Otherwise expose it through the configuration object only.

## Quick Start

### Option 1: Use ToolkitCoordinator (Recommended)

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// Create coordinator with configuration
const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  toolRegistry,
  tools: {
    providers: {
      textToSpeech: { enabled: true, backend: 'browser' },
      // Desmos needs an application key; see "Simple Default" below.
      calculator: { enabled: true }
    },
    placement: {
      section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    }
  },
  accessibility: {
    catalogs: assessment.accessibilityCatalogs || [],
    language: 'en-US'
  }
});

// Pass to section player
const player = document.getElementById('player');
player.runtime = { ...(player.runtime ?? {}), coordinator };

// Access services directly if needed
const ttsService = coordinator.ttsService;
const toolState = coordinator.elementToolStateStore.getAllState();
```

### Controller Event Subscriptions (Helper First)

For host-side session/progress logic, prefer helper subscriptions over the generic filter API. Subscriptions follow the toolkit's *active section cohort* automatically — a single `subscribe*` call survives navigation between sections without re-wiring:

```typescript
const unsubscribeItem = coordinator.subscribeItemEvents({
  itemIds: ['item-1', 'item-2'],
  listener: (event) => {
    // item-selected, item-session-data-changed, item-complete-changed, ...
  }
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event) => {
    // section-loading-complete, section-items-complete-changed, section-error, ...
  }
});

// cleanup
unsubscribeItem?.();
unsubscribeSection?.();
```

Behavior pins (PIE-512 Phase D):

- Subscribe **after** the first `getOrCreateSectionController(...)` resolves; calling subscribe before any cohort exists throws.
- On every cohort transition (navigation, fresh `getOrCreateSectionController` for a new section), the listener is automatically migrated to the new controller and receives a snapshot replay (`content-loaded` × N then `section-loading-complete`) in the same order a fresh subscriber would have seen.
- A section's subscriptions receive `content-loaded` only for that section's renderables, live or replayed; the previous section's loads stay with it. A renderable in both sections, such as a passage that stays mounted across the switch, counts as loaded in each.
- Subscribing the **same listener function** twice replaces the first subscription (filter args from the second call win).
- A listener that throws is caught and `console.warn`-logged; the throw does not interrupt fan-out to other listeners.

Use `subscribeSectionEvents(...)` when you need advanced/custom filtering mixes. Section-scoped events do not carry item IDs, so pairing them with `itemIds` filters will not match.

To persist or snapshot an inactive section, use `coordinator.getSectionController({ sectionId, attemptId })` — that lookup is by id and is unaffected by the active-cohort behavior described above.

#### Migrating from `<0.3.35` (BREAKING — pre-1.0)

`0.3.35` is the first release where `subscribeSectionEvents` (and its two helper wrappers `subscribeItemEvents` / `subscribeSectionLifecycleEvents`) follows the toolkit's *active section cohort* automatically. The on-the-wire shape of the subscription args object changed.

If your host code looked like this:

```typescript
const unsub = coordinator.subscribeItemEvents({
  sectionId: 'section-1',
  attemptId: 'attempt-1',
  listener: handleEvent,
});
```

Update it to drop `sectionId` / `attemptId`:

```typescript
const unsub = coordinator.subscribeItemEvents({
  listener: handleEvent,
});
```

What this means in practice for typed integrations:

- **TypeScript breaking change.** `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, and `SectionScopedEventSubscriptionArgs` no longer declare `sectionId?` / `attemptId?` properties. Any host that imports these arg types directly and passes those keys will fail to compile after upgrade. **Action required.**
- **Runtime is tolerant.** The runtime silently ignores extra unknown properties, so an untyped or lightly-typed call site that still passes `sectionId` / `attemptId` continues to work without source changes. The args have **no effect** at runtime — the subscription always follows the active cohort.
- **New precondition.** `subscribe*` throws until the first `getOrCreateSectionController(...)` call; a listener added while a section is starting binds when that section becomes active. Subscribe **after** the first `getOrCreateSectionController(...)` resolves. Subscribing on `toolkit-ready` alone is no longer sufficient — though in practice the section player emits `toolkit-ready` *after* its first `getOrCreateSectionController(...)` resolves, so a `toolkit-ready` anchor is safe in section-player hosts.
- **Cohort migration is automatic.** If your wrapper previously re-subscribed on every navigation to keep listeners alive across sections, that wiring is no longer needed (and should be removed). A single subscribe call after the first controller-resolve is now enough — the listener migrates automatically and is replayed the new cohort's snapshot on every transition.
- **Watch for double-replay if you re-subscribe on every `toolkit-ready`.** Hosts that detached and re-subscribed on every `toolkit-ready` event (the correct pre-Phase D pattern, since each subscription was pinned to a `sectionId`) will now observe **two snapshot replays per navigation**: one delivered automatically when Phase D migrates the existing listener to the new active cohort, and a second when the manual re-subscribe attaches a fresh listener that replays again. Listener handlers that are not strictly idempotent will fire twice — analytics `pageAction`s, non-Set counters, side-effecting hydration. The fix is a one-line guard (`if (this.controllerUnsubscribe) return;`) so the subscribe runs only on the first `toolkit-ready`.
- **For intentionally-pinned subscriptions to inactive sections** (e.g. a host UI that wants to keep watching section A while the user views section B), the helper API does not support that pattern by design. Use `coordinator.getSectionController({ sectionId, attemptId })` and subscribe directly on the controller handle (`controller.subscribe?.(...)`) — that binding is pinned to one controller instance and does not migrate.

If your local types were hand-rolled structural copies of the public arg types (e.g. an Angular wrapper duplicating the shape rather than importing the package types), `sectionId` / `attemptId` keys will compile but are dead code at runtime — recommend dropping them as part of the upgrade.

#### Pre-Phase D vs Phase D wrapper pattern

```typescript
// BEFORE (pre-Phase D): rebind for every section change because the
// subscription was pinned to a sectionId.
public handleToolkitReady(event: Event): void {
  const coordinator = (event as CustomEvent).detail?.coordinator;
  if (!coordinator) return;
  this.controllerUnsubscribe?.();  // detach prior pin
  const itemUnsub = coordinator.subscribeItemEvents({
    sectionId: this.sectionId,
    listener: handleItemEvent,
  });
  const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
    sectionId: this.sectionId,
    listener: handleSectionEvent,
  });
  this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
}
```

```typescript
// AFTER (Phase D): subscribe once; the listener follows the active
// cohort across all subsequent navigation.
public handleToolkitReady(event: Event): void {
  const coordinator = (event as CustomEvent).detail?.coordinator;
  if (!coordinator) return;
  this.toolkitCoordinator = coordinator;
  if (this.controllerUnsubscribe) return; // already subscribed; do nothing on re-fire
  const itemUnsub = coordinator.subscribeItemEvents({
    listener: handleItemEvent,
  });
  const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
    listener: handleSectionEvent,
  });
  this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
}
```

### Option 2: Create Services Manually (Advanced)

```typescript
import {
  TTSService,
  BrowserTTSProvider,
  HighlightCoordinator,
  AccessibilityCatalogResolver,
  ElementToolStateStore
} from '@pie-players/pie-assessment-toolkit';

// Initialize each service independently
const ttsService = new TTSService();
const highlightCoordinator = new HighlightCoordinator();
const elementToolStateStore = new ElementToolStateStore();
const catalogResolver = new AccessibilityCatalogResolver([], 'en-US');

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Use them from host-built UI
```

No player element takes services one by one. The section and assessment
players reach services only through a coordinator, `runtime.coordinator` on a
section player and `coordinator` on an assessment player; manually created
services serve host code that drives them directly. The tool coordinator is
not among them: it is created and disposed by its `ToolkitCoordinator`.

### Without a Section Player

`<pie-assessment-toolkit>` needs no section. Bind none and it provides tools,
policy and services to the item toolbars and item players inside it, which is
how the toolkit accompanies a plain item player. `<pie-item-scope>` holds the
item for its tools, as it does in a section player's card. The tree this
builds:

```html
<pie-assessment-toolkit>
  <pie-item-scope item-id="q1">
    <pie-item-toolbar></pie-item-toolbar>
    <div data-region="content">
      <pie-item-player></pie-item-player>
    </div>
  </pie-item-scope>
</pie-assessment-toolkit>
```

The host sets the toolkit's properties before the tree enters the document. A
scope registers as soon as it mounts, and that first registration starts the
coordinator from the toolkit's inputs at that moment; see the binding rules
below.

```typescript
import '@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element';
import '@pie-players/pie-assessment-toolkit/components/item-scope-element';
import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
import '@pie-players/pie-item-player';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// With no section player, the registry's loaders are what define the tool elements.
const toolRegistry = createPackagedToolRegistry();

const toolkit = document.createElement('pie-assessment-toolkit');
toolkit.tools = {
  pnpEnforcement: 'on',
  placement: { item: ['textToSpeech', 'calculator'] },
};
toolkit.toolRegistry = toolRegistry;
toolkit.toolContextResolvers = toolContextResolvers;
toolkit.assessment = { id: 'a1', personalNeedsProfile: { supports: ['calculator'] } };

const scope = document.createElement('pie-item-scope');
scope.setAttribute('item-id', 'q1');
scope.item = item;
scope.innerHTML = `
  <pie-item-toolbar></pie-item-toolbar>
  <div data-region="content"><pie-item-player></pie-item-player></div>
`;

toolkit.append(scope);
container.append(toolkit);
```

The toolbars and tools inside the scope take the item and its id from it, and
act on the scope, or on the element its `scopeElement` property names;
`textToSpeech` reads the scope's `[data-region="content"]` first. A toolbar's
own `item`, `item-id` and `scopeElement` still override the scope, and its
`toolRegistry` the toolkit's. The scope
registers the item with the toolkit once it finds one above it, so it may mount
first, and the toolkit files the item's accessibility catalogs, which read-aloud
speaks in place of the markup they name. Item player events pass through the
scope unchanged, and the session stays the item player's. A registry whose
`toolModuleLoaders` leave a tool out renders a button for it whose element never
loads unless the host defines it.

A profile change is a new `assessment` value; the toolbars re-derive on the
policy change it emits. The toolkit announces `runtime-ready`, with
`{ runtimeId, coordinator, ownership }`, once per coordinator, with or without a
section. Without one, the coordinator starts at the first item that registers,
and a host reads its readiness from `coordinator.waitUntilReady()` or
`isReady()`; `toolkit-ready` and `section-ready` wait for a bound section. The
toolkit emits no stage events: `pie-stage-change` is the section player's. A
host that holds
the coordinator from `runtime-ready`, or passes its own as `coordinator`,
changes the profile with `coordinator.updateAssessment(...)`; the toolkit
applies its `assessment` property only to a coordinator it owns. The
`calculator-pnp` section demo composes the owned-coordinator form.

The toolkit builds its own coordinator at mount from `tools`, `enabled-tools`,
`assessment-id`, `accessibility`, `lazy-init`, `tool-config-strictness` and
`toolRegistry`. Its first content binds it: the section, or without one the
first item scope that registers. Content that arrives after one of those inputs
changed binds a coordinator rebuilt from the current values, and the toolbars
move to it. After that, a change to them is reported once in the console and
does not reach the coordinator, except a `toolRegistry` given to a toolkit that
had none, which the coordinator adopts in place; `tools.pnpEnforcement`,
`assessment` and `toolContextResolvers` apply to it at any
time. That
coordinator reports feature policy asked with no assessment bound only while
`tools.pnpEnforcement` is `on`: a toolkit given no `assessment` and no enforcement
has asked for no accommodation.

A toolkit nested in another inherits the outer one's coordinator when the outer
one has a coordinator by the time the inner one connects, which holds for both
mounted together. Otherwise the inner one builds its own and keeps it, and
reports an outer coordinator arriving later once in the console. `isolation`
`"force"` keeps a nested toolkit on its own coordinator by design.

Section controllers live as long as the coordinator that caches them. At
unmount the toolkit disposes a coordinator it owns, which persists and disposes
every cached controller. A coordinator the host passes, or an outer toolkit
lends, keeps its controllers when the toolkit unmounts: its owner disposes them
with `coordinator.dispose()`, or one section at a time with
`coordinator.disposeSectionController(...)`.

Text-to-speech starts at the toolkit's first content, once the section composes
or the first item scope registers, and `coordinator.waitUntilReady()` waits for it. With `lazy-init` it starts at the first read-aloud instead, unless policy
grants it. A tool provider or text-to-speech that fails to start is a
recoverable framework error: the tool reports itself unavailable and the
assessment goes on. When policy grants the tool, through an item or district
requirement, a profile support or a test-administration override set to `true`,
the failure is fatal, including one that a later policy change grants. A toolbar
tool counts only the grants of decisions PNP enforcement applies to.

## Tool Configuration Model

The toolkit uses one canonical `tools` model with three concerns:

- `policy`: allow/block constraints (global gates)
- `placement`: where tools appear (`section`, `item`, `passage`). Each tool
  declares the levels it supports; `calculator` is item-only, and a tool placed
  at a level it does not support fails validation, which throws under the
  default `toolConfigStrictness: "error"`.
- `providers`: provider/runtime options (calculator, textToSpeech, etc.)

Example:

```typescript
tools: {
  policy: {
    allowed: ['calculator', 'textToSpeech', 'answerEliminator', 'graph', 'periodicTable'],
    blocked: ['graph']
  },
  placement: {
    section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
    item: ['calculator', 'textToSpeech', 'answerEliminator'],
    passage: ['textToSpeech']
  },
  providers: {
    calculator: {
      provider: {
        runtime: { authFetcher: async () => ({ apiKey: '...' }) }
      }
    },
    textToSpeech: { enabled: true, backend: 'browser' }
  }
}
```

### Scope and Lifecycle

The runtime still distinguishes between contextual (`item`/`passage`) and section-wide tools:

Tool instances use structured IDs so scope is explicit:

```text
<toolId>:<scopeLevel>:<scopeId>[:inline]
```

Examples:
- `calculator:section:section-1`
- `calculator:item:item-42`
- `textToSpeech:passage:passage-1`
- `highlighter:rubric:rubric-3`

### Item-Level Tools (`tools.placement.item`)

Tools that operate **within the context of a specific question/item**:

```typescript
tools: {
  placement: {
    item: ['calculator', 'textToSpeech', 'answerEliminator']
  }
}
```

**Characteristics:**
- **Scope**: Bound to a specific item's DOM context
- **Lifecycle**: Instance created/destroyed as you navigate between items
- **State**: Isolated per-item (eliminations for Q5 don't affect Q6)
- **UI Pattern**: Inline buttons in question headers/toolbars
- **State Persistence**: Tracked per-item in ElementToolStateStore

**Available Item-Level Tools:**
- **TTS (Text-to-Speech)**: Reads the specific question/passage text
- **Answer Eliminator**: Strikes through answer choices for that question
- **Calculator**: Basic, scientific or graphing calculator
- **Highlighter** (`annotationToolbar`): Highlights and annotates selected text; it opens from a text selection, outside the toolbars

**Example Use Case:**
A student uses answer eliminator on Question 3 to cross out choices B and D. When they navigate to Question 4, they see fresh, uneliminated choices. When they return to Question 3, their eliminations are restored.

### Section-Level Tools (`tools.placement.section`)

Tools that **float above the entire assessment** and persist across questions:

```typescript
tools: {
  placement: {
    section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler', 'theme']
  }
}
```

The section player renders the section toolbar only when its `show-toolbar`
attribute is `true`; the attribute defaults to `false`.

**Characteristics:**
- **Scope**: Section-wide, shared across all questions
- **Lifecycle**: Single instance initialized for entire section
- **State**: Persistent (a tool stays open and in place as you navigate)
- **UI Pattern**: Draggable floating panels/overlays with z-index management
- **State Persistence**: Global state maintained throughout section

**Available Floating Tools:**
- **Graph**: Coordinate plane
- **Periodic Table**: Interactive periodic table reference
- **Protractor**: Angle measurement tool
- **Ruler**: Linear measurement tool (metric/imperial)
- **Line Reader**: Reading guide/masking overlay
- **Color Scheme** (`theme`): High-contrast color adjustments

**Example Use Case:**
A student opens the periodic table on Question 2 and moves it beside the passage. When they navigate to Question 7, it is still open where they left it.

### When to Use Each

Use **item-level tools** when:
- Tool needs to read/interact with specific question content
- State should be isolated per-question
- Tool appears inline with the question (space-efficient)
- Tool behavior is contextual to the current item

Use **floating tools** when:
- Tool is a general-purpose utility used across multiple questions
- State should persist across navigation
- Tool needs independent positioning and sizing
- Tool provides reference information or computation capability

### Configuration Example

Complete example showing both types:

```typescript
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: 'math-exam',
  toolRegistry,
  tools: {
    placement: {
      // Contextual placement
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
      // Section-level utilities
      section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler', 'theme']
    },
    providers: {
      calculator: {
        enabled: true,
        provider: {
          runtime: {
            authFetcher: async () => {
              const response = await fetch('/api/tools/desmos/auth');
              return response.json();
            }
          }
        }
      },
      textToSpeech: { enabled: true, backend: 'browser' }
    }
  },
  accessibility: {
    catalogs: [],
    language: 'en-US'
  }
});
```

**A common placement:**

A coordinator shows a tool only where `tools.placement` lists it. Its default
placement is empty, so a coordinator configured without one shows no tools, and
a profile grant does not place a tool either. This placement covers the
commonly used tools:

```typescript
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  toolRegistry,
  tools: {
    placement: {
      section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    },
    providers: {
      calculator: {
        enabled: true,
        provider: {
          runtime: { authFetcher: fetchLicensedDesmosApiKey }
        }
      },
      textToSpeech: { enabled: true, backend: 'browser' }
    }
  }
});
```

The ToolkitCoordinator handles service initialization, provider management, and
state coordination. With no calculator provider configuration, the Desmos
implementation remains the default. Desmos's CDN rejects a `calculator.js`
request without an `apiKey` (HTTP 403), so the Desmos calculator opens only when
the host supplies `provider.init.apiKey` or `provider.runtime.authFetcher`, or
has already loaded `window.Desmos`; the adapter's keyless request grants no
Desmos license either. Runtime key delivery avoids committing the key but does
not hide it from the browser's Desmos script request. The bundled open-source
implementation below needs no key.

Select the separate GeoGebra implementation explicitly without changing the
calculator capability, placement, or item policy:

```typescript
providers: {
  calculator: {
    provider: { id: 'calculator-geogebra' },
    settings: { showResetIcon: true }
  }
}
```

Select the bundled open-source implementation in the same way. It uses no API
key or runtime network request and supports basic, scientific, and focused
graphing modes:

```typescript
providers: {
  calculator: {
    provider: { id: 'calculator-cortex' },
    settings: { angleMode: 'degree', evaluationTimeLimitMs: 1000 }
  }
}
```

### Minimal Server-Backed TTS Config

For Polly/Google server-backed TTS, the provider config supports a minimal form.
Common options are defaulted so you can start with:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'server',
      serverProvider: 'polly'
    }
  }
}
```

By default, server-backed TTS resolves:

- `apiEndpoint: '/api/tts'`
- `transportMode: 'custom'` for `serverProvider: 'custom'`, else `'pie'`
- `endpointValidationMode: 'voices'`, so the provider reads the voices route
  before it reports ready; `'none'` skips the probe

You can still set `apiEndpoint` explicitly when your host route is not `/api/tts`.

### Inline TTS Speed Options

Inline TTS speed buttons are configurable via `speedOptions` on the provider config.

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: "browser",
      speedOptions: [2, 1.25, 1.5] // host options keep this order; Normal is added if omitted
    }
  }
}
```

Hosts that need semantic UI copy can use object-form options. The `rate` still
drives playback and provider mapping; `label` / `ariaLabel` only change visible
and accessible button text.

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: "server",
      serverProvider: "custom",
      speedOptions: [
        { rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
        { rate: 1, label: "Normal", ariaLabel: "Normal speed", default: true },
        { rate: 1.5, label: "Fast", ariaLabel: "Fast speed" }
      ]
    }
  }
}
```

`speedOptions` semantics:

- Omitted or non-array: default speed choices are shown (`Slow`, `Normal`, `Fast`), with `Normal` selected.
- Explicit empty array (`[]`): hide all speed choices and reset playback speed to `1.0`.
- Invalid-only arrays (for example `["fast", -1]`): fall back to defaults.
- Valid numeric values are deduplicated and keep first-seen order.
- Object-form entries use the same numeric validation/deduping by `rate`.
- Missing labels fall back to numeric text like `1.5x`; missing `ariaLabel`
  falls back to a matching accessible name like `Fast speed`.
- Visible labels render lowercase regardless of the configured casing (so
  `Slow`/`Normal`/`Fast` display as `slow`/`normal`/`fast`). This is a
  presentation transform only — the accessible name still uses `ariaLabel`
  (e.g. `Slow speed`), so screen readers announce the canonical text.
- `1` is a visible `Normal` choice. If a non-empty config omits `1`, PIE adds
  `Normal` at the natural point in the speed scale while preserving the
  relative order of host-provided options.
- Speed choices are exposed as a `Playback speed` radio group: one option is
  always selected, and choosing the already-selected speed is a no-op.
- If only one speed option remains, the speed group is hidden by default. Set
  `showSingleSpeedOption: true` on the provider config to surface that one-option state.

### Browser Fallback

The coordinator owns fallback to browser speech. When a server-backed provider
fails to initialize, the coordinator re-initializes TTS on the browser backend
and reports `pie-tool-init-fallback`. `TTSService.initialize` itself rejects
when its provider fails to start, and a playback failure after initialization
rejects that read without switching provider.

`provider.runtime.authFetcher` is optional. Add it only when your host environment
requires runtime auth material for TTS requests:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'server',
      serverProvider: 'polly',
      apiEndpoint: '/api/tts',
      provider: {
        runtime: {
          authFetcher: async () => {
            const response = await fetch('/api/tts/auth');
            return response.json();
          }
        }
      }
    }
  }
}
```

The fetch completes before the first TTS request, and its result merges over the
provider config: a returned `authToken` is sent as `Authorization: Bearer <token>`
and returned `headers` with every synthesis request, and under
`includeAuthOnAssetFetch` the `Authorization` header also reaches the custom
transport's speech-mark and audio fetches. A failed fetch falls back to browser
speech and reports `pie-tool-init-fallback`.

For a server that authenticates by cookie on another origin, set `credentials:
"include"` on the `textToSpeech` provider config, beside
`includeAuthOnAssetFetch`. The cookie reaches speech-mark and audio fetches only
for origins in `assetOrigins`; unset, every TTS fetch keeps the browser default.

### Custom Transport via Server Proxy (SC-style)

For custom backends that return URL assets (for example `{ audioContent, word }`),
prefer a host-owned proxy endpoint so secrets never ship to the browser.

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: "server",
      serverProvider: "custom",
      transportMode: "custom",
      endpointMode: "rootPost",
      endpointValidationMode: "none",
      apiEndpoint: "/api/tts/sc",
      speedRate: "medium",
      lang_id: "en-US",
      cache: true
    }
  }
}
```

Recommended host boundary:

- Browser calls local proxy (`/api/tts/sc`) only.
- Proxy route reads required server env vars (no defaults) and signs/attaches auth
  upstream.
- Browser never receives shared secret, API key, or signing material.

SchoolCity is used as a host-configured integration example for custom transport.
Toolkit defaults still remain browser/standard providers unless the host explicitly
configures custom server-backed TTS.

## Test Attempt Session

The toolkit exposes a canonical `TestAttemptSession` runtime. The host maps its
backend's attempt payload into it and back out.

```typescript
import {
  createNewTestAttemptSession,
  toItemSessionsRecord,
  upsertItemSessionFromPieSessionChange,
} from "@pie-players/pie-assessment-toolkit";

let testAttemptSession = createNewTestAttemptSession({
  testAttemptSessionIdentifier: attempt.id,
  assessmentId: assessment.id,
  seed: attempt.id,
  itemIdentifiers: assessment.itemIdentifiers,
});

// Record a PIE session change against its item
testAttemptSession = upsertItemSessionFromPieSessionChange(testAttemptSession, {
  itemIdentifier: "q1",
  pieSessionId: change.session.id,
  session: change.session,
});

// Use in section-player handoff (same item session shape as item players expect)
const itemSessions = toItemSessionsRecord(testAttemptSession);
```

### Integration Boundary

- `@pie-players/pie-section-player` stays backend-agnostic and emits session/state changes.
- Host applications own backend I/O to pie backend (`../../kds/pie-api-aws`).
- Hosts decide persistence policy (immediate, debounced, checkpoint, submit).

### Section session API (controller + persistence)

For section-level session flows, the toolkit supports two complementary APIs:

- Persistence hook: `createSectionSessionPersistence(context, defaults)` for load/save/clear orchestration
- Direct controller API: `getSession()`, `applySession(session, { mode })`, `updateItemSession(itemId, detail)`

The persistence strategy works with the same `SectionControllerSessionState` shape exposed by the controller, so hosts can choose bulk restore (`applySession`) and fine-grained updates (`updateItemSession`) without internal runtime coupling.

## Implementation Status

### ✅ Toolkit Services

- **ToolkitCoordinator**: ⭐ NEW - Centralized service orchestration
- **ElementToolStateStore**: ⭐ NEW - Element-level ephemeral tool state management
- **ToolRegistry**: ⭐ NEW - Registry-based tool management with AfA PNP 3.0 profile support
- **ToolPolicyEngine**: AfA PNP 3.0 Personal Needs Profile and host policy decisions via registry-backed policy sources
- **ToolCoordinator**: Manages z-index layering and visibility for floating tools
- **HighlightCoordinator**: Separate highlight layers for TTS (temporary) and annotations (persistent)
- **TTSService**: Text-to-speech with QTI 3.0 catalog support
- **AccessibilityCatalogResolver**: QTI 3.0 accessibility catalog management
- **SSMLExtractor**: Extraction of embedded `<speak>` tags into `config.extractedCatalogs`, run by a host's preprocessing step

### ✅ PNP Support Ids

- **Support ids are tool ids**: A profile, district policy or item setting names a tool by its `toolId`, and an id no registered tool carries raises `tool-policy.unknownSupportId`. [Support ids](docs/TOOL_REGISTRY.md#support-ids) lists the AfA PNP 3.0 terms the packaged ids serve.

### ✅ Section Player Integration

The toolkit integrates seamlessly with the **PIE Section Player**:

- **Primary Interface**: Section player is the main integration point
- **Default Coordinator**: Creates ToolkitCoordinator automatically if not provided
- **Extracted SSML Catalogs**: Registers the `config.extractedCatalogs` that `SSMLExtractor` preprocessing writes onto passages and items
- **Catalog Lifecycle**: Manages item-level catalogs automatically
- **Service Coordination**: All toolkit services work together automatically

## ToolkitCoordinator API

### Configuration

```typescript
export interface ToolkitCoordinatorConfig {
  assessmentId: string;  // Required: unique assessment identifier
  tools?: {
    policy?: {
      allowed?: string[];
      blocked?: string[];
    };
    placement?: {
      section?: string[];
      item?: string[];
      passage?: string[];
    };
    providers?: {
      textToSpeech?: {
        enabled?: boolean;
        backend?: 'browser' | 'server';
        serverProvider?: 'polly' | 'google' | 'custom';
        defaultVoice?: string;
        rate?: number;
      };
      calculator?: {
        enabled?: boolean;
        provider?: {
          id?: 'calculator-desmos' | 'calculator-geogebra' | 'calculator-cortex';
          init?: Record<string, unknown>;
          runtime?: {
            authFetcher?: () => Promise<Record<string, unknown>>;
          };
        };
        settings?: Record<string, unknown>;
        restrictedMode?: boolean;
      };
    };
  };
  toolRegistry?: ToolRegistry | null;
  accessibility?: {
    catalogs?: any[];
    language?: string;
  };
}
```

### Methods

```typescript
// Tool configuration
coordinator.getToolConfig('textToSpeech');  // Get tool-specific config
coordinator.updateToolConfig('textToSpeech', { rate: 1.5 });  // Update tool config; replaces the tool's provider, which starts again on next use

// Final teardown by the owner that constructed the coordinator
await coordinator.dispose();
```

### Direct Service Access

All services are public properties for direct access:

```typescript
coordinator.ttsService              // TTSService instance
coordinator.toolCoordinator         // ToolCoordinatorApi, owned by the coordinator
coordinator.highlightCoordinator    // HighlightCoordinator instance
coordinator.elementToolStateStore   // ElementToolStateStore instance
coordinator.catalogResolver         // AccessibilityCatalogResolver instance
```

## ElementToolStateStore API

The `ElementToolStateStore` manages ephemeral tool state at the element level using globally unique composite keys.

### Key Concepts

- **Global Element ID**: Composite key format: `${assessmentId}:${sectionId}:${attemptId}:${itemId}:${elementId}`, with `attemptId` `""` when the host names no attempt
- **Element-Level Granularity**: State tracked per PIE element; a tool keyed by item or section leaves `elementId`, and for a section `itemId`, as `""`
- **Per-Attempt State**: two attempts at one section never share a key
- **Ephemeral State**: Tool state is client-only, separate from PIE session data
- **Cross-Section Persistence**: State persists when navigating between sections

### ID Utilities

```typescript
// Generate global element ID
const globalElementId = store.getGlobalElementId({
  assessmentId: 'demo-assessment',
  sectionId: 'section-1',
  attemptId: 'attempt-1',
  itemId: 'question-1',
  elementId: 'mc1'
});
// Returns: "demo-assessment:section-1:attempt-1:question-1:mc1"

// Parse global element ID
const components = store.parseGlobalElementId(globalElementId);
// Returns: { assessmentId, sectionId, attemptId, itemId, elementId }
```

### CRUD Operations

```typescript
// Set state for a tool on an element
store.setState(globalElementId, 'answerEliminator', {
  eliminatedChoices: ['choice-a', 'choice-c']
});

// Get state for a specific tool
const state = store.getState(globalElementId, 'answerEliminator');

// Get all tool states for an element
const elementState = store.getElementState(globalElementId);

// Get all states across all elements
const allState = store.getAllState();
```

### Cleanup Operations

```typescript
// Clear state for a specific element
store.clearElement(globalElementId);

// Clear state for a specific tool across all elements
store.clearTool('answerEliminator');

// Clear all elements in a specific section, across its attempts
store.clearSection('demo-assessment', 'section-1');

// Clear all state
store.clearAll();
```

### Persistence Integration

```typescript
// Set callback for persistence (e.g., localStorage)
store.setOnStateChange((state) => {
  localStorage.setItem('tool-state', JSON.stringify(state));
});

// Load state from persistence
const saved = localStorage.getItem('tool-state');
if (saved) {
  store.loadState(JSON.parse(saved));
}
```

### Reactivity

```typescript
// Subscribe to state changes
const unsubscribe = store.subscribe((state) => {
  console.log('State changed:', state);
});

// Unsubscribe when done
unsubscribe();
```

## Service APIs

### TTSService

```typescript
import { BrowserTTSProvider, TTSService } from '@pie-players/pie-assessment-toolkit';

const ttsService = new TTSService();

// Initialize with provider
await ttsService.initialize(new BrowserTTSProvider());

// Set catalog resolver for SSML support
ttsService.setCatalogResolver(catalogResolver);

// Playback: reads an element or a range, or the named card in its place
await ttsService.speak(promptElement, {
  catalogId: 'prompt-001',
  language: 'en-US'
});

// Controls
ttsService.pause();
ttsService.resume();
ttsService.stop();

// Settings
await ttsService.updateSettings({
  rate: 1.5,
  voice: 'Matthew'
});
```

### ToolCoordinator

The toolkit owns the coordinator. A tool element registers with the one in its
runtime context and hands it the element once it renders:

```typescript
import {
  createToolCoordinatorRegistration,
  ZIndexLayer,
} from '@pie-players/pie-assessment-toolkit/tools/registration';

const registration = createToolCoordinatorRegistration('Calculator', ZIndexLayer.TOOL);

// Re-registers when a republished context brings a new coordinator.
$effect(() => registration.sync(coordinator, toolId));
$effect(() => {
  if (coordinator && containerEl && toolId) {
    coordinator.updateToolElement(toolId, containerEl);
  }
});
onDestroy(() => registration.release());
```

Visibility and stacking then go through the coordinator by scoped tool id:
`showTool`, `hideTool`, `toggleTool`, `isToolVisible`, `bringToFront(element)`,
and `getVisibleTools({ baseId })` / `hideAllTools({ baseId })` for one tool
across scopes. Disposing the toolkit coordinator releases every entry. Its
debug lines print only under `window.PIE_DEBUG = true`.

### HighlightCoordinator

```typescript
import { HighlightColor, HighlightCoordinator } from '@pie-players/pie-assessment-toolkit';

const highlightCoordinator = new HighlightCoordinator();

// TTS highlights (temporary)
highlightCoordinator.highlightTTSWord([wordRange]); // one range per tree the word spans
highlightCoordinator.highlightTTSSentence([range1, range2]);
highlightCoordinator.clearTTS();

// Annotation highlights (persistent)
const id = highlightCoordinator.addAnnotation(range, HighlightColor.YELLOW);
highlightCoordinator.removeAnnotation(id);
```

Reading highlights resolve through five `component-public` tokens registered in
`packages/theme/src/token-registry.json`:

| Custom property | Default | Description |
| --- | --- | --- |
| `--pie-tts-word-highlight` | `--pie-missing` at 68% | Fill behind the current word |
| `--pie-tts-sentence-highlight` | `--pie-missing` at 38% | Fill behind the current sentence |
| `--pie-tts-line-highlight` | `--pie-tts-sentence-highlight` | Fill behind the current line |
| `--pie-tts-word-underline` | `--pie-text` at 70% | Underline marking the current word |
| `--pie-tts-word-shadow` | `--pie-text` at 35% | Shadow carrying the word over its fill |

The coordinator derives all five from the active theme's accent, text and
background — opacities clamped to a legible band, and the underline colour picked
by background luminance so the cue survives a dark scheme — then writes them
inline on the document element. Inline styles outrank any author selector, so a
host override takes `!important` and owns the contrast the derivation was
maintaining, across every scheme it ships.

### AccessibilityCatalogResolver

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

const resolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US'
);

// Add item-level catalogs
resolver.addItemCatalogs(item.accessibilityCatalogs);

// Get alternative representation
const alternative = resolver.getAlternative('prompt-001', {
  type: 'spoken',
  language: 'en-US'
});

// Clear item catalogs when navigating away
resolver.clearItemCatalogs();
```

A resolved card carries either a string `content` (SSML for `spoken`, text for
`braille`) or a structured `payload`, decided by its `catalog` type — never both.
Consumers select by type and then validate the form they expect; a card with no
string form is not text content, and treating it as such would speak or render an
empty string.

Catalogs carried by a rendered item or passage are registered as one owner-level
transaction. The resolver owns the walk over entity-root,
`config.extractedCatalogs`, and model catalogs, along with their registration
precedence and change notification:

```typescript
import {
  catalogOwnerContextFor,
} from '@pie-players/pie-assessment-toolkit';

const owner = {
  kind: 'item',
  itemId: item.id,
  canonicalItemId,
  assessmentId,
  sectionId,
} as const;

const unregister = resolver.registerOwner({ owner, entity: item });
const ownerView = resolver.forOwner(catalogOwnerContextFor(owner));

const stopObserving = ownerView.onChange(() => {
  const snapshot = ownerView.snapshot();
  // Interpret only the card types your capability owns.
});

stopObserving();
unregister();
```

`CatalogOwnerSnapshot` is immutable and deterministic. A content capability
receives it as `ToolContentDependencyContext.catalogs`; it does not receive the
raw entity, resolver, or separately assembled lookup context. Direct consumers
such as TTS may still call `getAlternative(...)` with a context built by
`catalogOwnerContextFor`.

### SSMLExtractor

```typescript
import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

const extractor = new SSMLExtractor();

// Extract from item config
const result = extractor.extractFromItemConfig(item.config);

// Update item with cleaned config
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;

// Register with catalog resolver
catalogResolver.addItemCatalogs(result.catalogs);
```

### Cards without an extractor

Not every catalog card is lifted out of item markup. A signed alternate is
authored or written by an importer and has no extractor at all; one such lift
existed and was removed, because nothing produced the inline form and a runtime
that could not parse the markup left the video in the visible content, showing the
accommodation to every learner regardless of eligibility.

This package resolves and registers those cards through
`AccessibilityCatalogResolver` and the generic media helpers it re-exports
from `@pie-players/pie-players-shared/media`. Which card types mean what belongs to the capability that
needs them — signing's card validators and its resolution rules live in
`@pie-players/pie-tool-sign-language`, behind that capability's
`requiresAuthoredContent`.

### Feature policy without a placement

`ToolPolicyEngine.decideFeature(featureId, scope?)` (and
`ToolkitCoordinator.decideFeaturePolicy(featureId, scope?)`) resolve one feature id
through `PnpPolicySource`'s six-level precedence, independent of any toolbar
placement. Use it for capabilities that are not toolbar surfaces — signing is the
first — where a placement-scoped `decide(...)` would answer the wrong question:
absent because it was never placed, rather than absent because policy said no.
An item scope applies that item's registered settings, the item restriction and
requirement rungs; a decision without one applies no item's.

This package ships no profile. Which capabilities a deployment grants by default is a property
of the program rather than of a capability — TTS is a universal feature in one
program and a documented accommodation in another — so it belongs in policy
configuration alongside the district and test-administration levels. Hosts that
want today's universal set take `createUniversalPersonalNeedsProfile()` from
`@pie-players/pie-default-tool-loaders`, which ships it as data beside
`createEmptyPersonalNeedsProfile()`.

Nothing derives a profile from the registry any more. Doing so read registry
membership as eligibility tier — registration means "policy-addressable", not
"universal, on by default" — and had to be corrected with a compile-time list of
ids to exclude that a host could not extend for its own accommodation.

### Live registry changes

`ToolRegistry.onRegistryChange(listener)` observes successful `register`,
`override`, `unregister`, `clear`, component-override, and module-loader
changes synchronously. Invalid and no-op mutations do not emit, listener
failures do not interrupt other listeners, and unsubscribe is idempotent.
Section-player subscribes internally, so a capability registered after mount
appears without a host-forced rerender; unregister and clear destroy their
mounted surface elements immediately.

## Integration with Section Player

The section player provides automatic ToolkitCoordinator integration:

```html
<pie-section-player-splitpane id="player" section-id="section-1"></pie-section-player-splitpane>

<script type="module">
  import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
  import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

  // Create coordinator
  const toolRegistry = createPackagedToolRegistry();
  const coordinator = new ToolkitCoordinator({
    assessmentId: 'my-assessment',
    toolRegistry,
    tools: {
      providers: { textToSpeech: { enabled: true, backend: 'browser' } },
      placement: {
        section: ['graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
        item: ['calculator', 'textToSpeech', 'answerEliminator'],
        passage: ['textToSpeech']
      }
    }
  });

  // Pass to player
  const player = document.getElementById('player');
  player.runtime = { ...(player.runtime ?? {}), coordinator };
  player.section = mySection;

  // Player automatically:
  // - Extracts services from coordinator
  // - Scopes its runtime engine to `section-id`
  // - Provides runtime context to child components
  // - Registers item catalogs, including SSML catalogs a host extracted
  //   into `config.extractedCatalogs` with `SSMLExtractor`
  // - Handles catalog lifecycle
</script>
```

### Runtime Context Contract

Section-player and toolkit components share one runtime context. An element
inside the toolkit's tree connects to it:

```typescript
import {
  connectToolRuntimeContext,
  type AssessmentToolkitRuntimeContext
} from "@pie-players/pie-assessment-toolkit";

let runtime: AssessmentToolkitRuntimeContext | undefined;
const disconnect = connectToolRuntimeContext(hostElement, (value) => {
  runtime = value;
});
```

`AssessmentToolkitRuntimeContext` carries ambient orchestration dependencies
that should not be prop-drilled through intermediate components:

- `toolkitCoordinator`
- `toolCoordinator`
- `ttsService`
- `highlightCoordinator`
- `catalogResolver`
- `elementToolStateStore`
- `assessmentId`
- `sectionId`

These runtime fields are expected to be present once the section-player
provider is established (host-supplied coordinator or lazily created by
section-player). Use explicit props/events for direct content contracts, and
use runtime context for cross-cutting orchestration scope.

### Standalone Sections (No Coordinator Provided)

If no coordinator is provided, the section player creates a default one:

```javascript
// No coordinator provided - section player creates default
player.section = mySection;

// Internally creates:
// new ToolkitCoordinator({
//   assessmentId: 'section-demo-direct', // or runtime.assessmentId
//   toolRegistry,                        // the player's toolRegistry, else the packaged registry
//   tools: player.runtime?.tools         // no tools are placed when this is unset
// })
```

### Safe Custom Tool Configuration

Default behavior is now framework-owned: invalid tools/runtime initialization is handled in `pie-assessment-toolkit` without host try/catch.

- Framework logs a deterministic console error prefix: `[pie-framework:<kind>:<source>]`
- Framework emits a canonical `framework-error` event
- Framework renders a fallback error panel instead of a blank player
- Startup tool-config validation can surface as `kind: "coordinator-init"` when the owned coordinator construction path throws.

Use `createToolsConfig()` when you want to pre-validate and inspect diagnostics before mounting:

```typescript
import {
  createToolsConfig,
  ToolkitCoordinator
} from "@pie-players/pie-assessment-toolkit";
import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

const toolRegistry = createPackagedToolRegistry();
const { config, diagnostics } = createToolsConfig({
  source: "host.bootstrap",
  strictness: "error",
  toolRegistry,
  tools: {
    providers: {
      textToSpeech: { enabled: true, backend: "browser" },
      calculator: { enabled: true }
    },
    placement: {
      item: ["calculator", "textToSpeech"]
    }
  }
});

// Fail-fast default: invalid config throws at the boundary.
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo-assessment",
  toolRegistry,
  tools: config,
  toolConfigStrictness: "error"
});
```

Notes:
- `providers.textToSpeech` is the canonical TTS provider key.
- `providers.tts` is rejected by the validation contract.
- A tool registration can declare `sanitizeConfig` and `validateConfig` hooks for its `providers.<toolId>` entry.
- Hosts can react to framework errors via the `framework-error` DOM event,
  the `onFrameworkError(model)` callback prop, or by subscribing directly
  to the package-internal bus via
  `ToolkitCoordinator.subscribeFrameworkErrors(listener)`. The callback
  prop fires exactly once per error, regardless of wrapper depth. Filter
  by `model.kind` (e.g. `"tts-init"`, `"provider-init"`,
	`"provider-register"`, `"tool-surface"`) for tool- or provider-specific
	handling. Recoverable warnings remain observable but do not move section
	readiness to `error`.
- See `docs/tools-and-accomodations/framework-owned-error-handling.md` for event payload and error-kind mapping details.

## Section Runtime Engine (advanced)

The section runtime engine is the section player's stage chain: a pure FSM that
turns the cohort a layout shows, the controller resolving and the readiness
signals the layout derives into `pie-stage-change` and `pie-loading-complete`.
The section player's layout kernel owns one per layout element, and it is the
only stage emitter. `<pie-assessment-toolkit>` emits no stages: its
`SectionControllerBinding` resolves the section's controller, which the toolkit
announces with `toolkit-ready`, and the toolkit publishes framework errors.

### Entry point

`@pie-players/pie-assessment-toolkit/runtime/engine` is the stable entry for a
host that drives a section's stage chain. It carries `SectionRuntimeEngine` and
the vocabulary of its surface: the `SectionEngineInput`s `dispatchInput` takes,
the `SectionEngineOutput`s `subscribe` delivers, the `SectionEngineState` and
`SectionEnginePhase` `getState` returns, the cohort helpers (`makeCohort`,
`cohortsEqual`), the runtime config types with
`resolveSectionEngineRuntimeState`, and the readiness signals. The engine core, its adapter and its DOM bridge have no
entry: a host reaches them through the facade.

### Stage chain

A cohort moves through `composed`, `engine-ready` and `interactive`, and ends at
`disposed` on a cohort change or unmount. `engine-ready` follows the
`section-controller-resolved` input, `interactive` the readiness signals that
satisfy the readiness mode. A readiness update that reports `runtimeError`
before `interactive` ends the chain: the first stage the cohort did not reach is
`failed` and the rest up to `interactive` are `skipped`. The section player sets
`runtimeError` from a non-recoverable `framework-error`, so a host waiting on
`engine-ready` or `interactive` always hears an answer. `pie-loading-complete`
fires once per cohort, when every item has loaded.

### Common-host wiring example

Most hosts never construct the engine: the section-player layout elements do,
and a host-built section layout takes its engine from
`pie-section-player-kernel-host` (see the section player's
[Custom layout authoring](../section-player/README.md#custom-layout-authoring)).
Use the facade for a section renderer outside the section player. The shape
mirrors the section-player kernel:

```ts
import {
  SectionRuntimeEngine,
  makeCohort,
} from "@pie-players/pie-assessment-toolkit/runtime/engine";

const engine = new SectionRuntimeEngine();

// 1. Attach to the layout host. `sourceCe` is stamped onto every event.
engine.attachHost({ host: layoutHostElement, sourceCe: "my-custom-layout" });

// 2. (Optional) Subscribe to the output batches the DOM bridge dispatches.
engine.subscribe((outputs) => {
  // `stage-change` and `loading-complete` outputs
});

// 3. Drive the engine with `SectionEngineInput`s.
const cohort = makeCohort({ sectionId, attemptId });
engine.dispatchInput({
  kind: "initialize",
  cohort,
  effectiveRuntime,
  effectiveToolsConfig,
  itemCount,
});

// When the toolkit's `section-ready` delivers the cohort's section controller:
engine.dispatchInput({ kind: "section-controller-resolved" });

// On readiness signal updates:
engine.dispatchInput({
  kind: "update-readiness-signals",
  signals: {
    sectionReady,
    interactionReady,
    allLoadingComplete,
    runtimeError,
  },
  itemCount,
  mode: "progressive",
});

// On unmount; emits `disposed` for the active cohort.
engine.dispose();
```

The adapter dispatches `pie-stage-change` and `pie-loading-complete` on `host`,
bubbling and composed, as the toolkit dispatches its own events. Framework
errors are not an engine output. The toolkit that owns the coordinator publishes
each one once: one bubbling, composed `framework-error` event, which reaches the
layout host and `document`, and one `onFrameworkError` call. A coordinator the
host passes in reports through the same surfaces.
`packages/section-player/tests/section-player-event-delivery.spec.ts` pins these
counts.

## Writing a capability package

`@pie-players/pie-assessment-toolkit/tools/registration` is the stable entry a
capability package imports: the `ToolRegistration` contract, the
`ToolProviderApi` its provider descriptor creates, the surface and content
dependency types, the context predicates, `createToolElement`, `resolveToolTag`
and the toolbar registration helpers. A renderer that puts registrations on
screen uses the same entry for `createToolSurfaceHost` and
`resolveContentCapabilities`.

Import it rather than the package root: the root pulls in `ToolkitCoordinator`,
`TTSService` and the components, none of which a registration needs, and a
capability bundle that inlines them ends up with a second `ToolRegistry` class
that fails every `instanceof` across the host boundary. Mark the toolkit external
in the package's build with a pattern that covers subpaths, not a bare specifier.

`@pie-players/pie-tool-sign-language` is the worked example end to end: a
registration, a content resolver, its own custom element, and no edit to any
generic package. `packages/default-tool-loaders/README.md` covers how a
deployment then composes it in, and `docs/TOOL_REGISTRY.md` the registration and
host-surface contracts.

## State Separation: Tool State vs Session Data

The toolkit enforces a clear separation between ephemeral tool state and persistent session data:

### Tool State (Ephemeral - ElementToolStateStore)

**Client-only**, never sent to server for scoring:

```typescript
{
  "demo-assessment:section-1:attempt-1:question-1:mc1": {
    "answerEliminator": {
      "eliminatedChoices": ["choice-b", "choice-d"]
    },
    "annotationToolbar": {
      "annotations": [...]
    }
  }
}
```

**Use for:**
- Answer eliminations
- Highlighting/annotations
- Tool preferences
- UI state

### PIE Session Data (Persistent)

**Sent to server** for scoring:

```typescript
{
  "question-1": {
    "id": "session-123",
    "data": [
      { "id": "mc1", "element": "multiple-choice", "value": ["choice-a"] }
    ]
  }
}
```

**Use for:**
- Student responses
- Scoring data
- Assessment outcomes

## Examples

See the [section-demos](../../apps/section-demos/) for complete examples:

- **Three Questions Demo**: Element-level answer eliminator with state persistence
- **TTS Integration Demo**: Toolkit coordinator with TTS service
- **Paired Passages Demo**: Multi-section assessment with cross-section state

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  ToolkitCoordinatorApi,
  ElementToolStateStoreApi,
  ToolkitCoordinatorConfig
} from '@pie-players/pie-assessment-toolkit';
```

## Content trust boundary

The toolkit embeds item content via the underlying `pie-item-player`
custom element and renders tool icons / SSML fragments that originate
from tool configuration. Two sanitization layers apply:

- **Item / passage markup** - sanitized by default in
  `pie-item-player`. See
  [pie-item-player README](../item-player/README.md#content-trust-boundary)
  for the `trust-markup` opt-out and the `sanitizeMarkup` override.
  As a post-sanitization step, every authored `<img>` outside a `pie-*`
  custom element is wrapped in `<span class="pie-image-scroll">` so
  overwide images surface a horizontal scrollbar instead of being
  clipped by the section layout's `overflow-x: hidden` ancestors
  (PIE-94 / WCAG 1.4.10 Reflow at 400% zoom). The wrapper is
  keyboard-scrollable (`tabindex="0"`, `role="region"`) and carries
  the image's `alt` text in its `aria-label`; matching CSS lives in
  `@pie-players/pie-theme` (`components.css`). Authored `<table>`
  elements outside a `pie-*` custom element get the same treatment via
  `<div class="pie-table-scroll">` so wide data grids reflow into a
  horizontally scrollable region; the wrapper's `aria-label` is derived
  from the table's `aria-label` / `aria-labelledby` / `<caption>`.
- **Tool icons and SSML** - tool-registered icon markup is parsed and
  DOMPurified inside the toolbar at render time; SSML payloads are
  restricted to an allow-listed subset of SSML tags/attributes before
  being forwarded to TTS providers. Do not ship tools that rely on raw
  `<script>` or event-handler attributes in their icon strings.

## Related Documentation

- **[Tool Registry Architecture](docs/TOOL_REGISTRY.md)** - ⭐ NEW - Registry-based tool management and AfA PNP 3.0 profile support
- **[PNP Configuration Guide](docs/PNP_CONFIGURATION.md)** - ⭐ NEW - How to configure student profiles, district policies, and governance rules
- [ToolkitCoordinator Architecture](../../docs/architecture/architecture.md#toolkitcoordinator-centralized-service-management) - Design decisions and patterns
- [Section Player README](../section-player/README.md) - Section player integration
- [Section Player Architecture](../section-player/ARCHITECTURE.md#layered-runtime-engine-post-m7) - Layered runtime engine, kernel/toolkit wiring, lifecycle emit invariant
- [Framework-Owned Error Handling](../../docs/tools-and-accomodations/framework-owned-error-handling.md) - Canonical framework error model/events and fallback behavior
- [Safe Custom Tool Configuration](../../docs/tools-and-accomodations/safe-custom-tool-config.md) - Host-side config patterns and validation guidance
- [Architecture Overview](../../docs/architecture/architecture.md) - Complete system architecture

## License

MIT
