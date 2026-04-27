# PIE Assessment Toolkit

**Independent, composable services** for coordinating tools, accommodations, and item players in assessment applications.

This is not an opinionated framework or monolithic "player" - it's a toolkit that solves specific problems through centralized service management.

## What's New: ToolkitCoordinator

✨ **Centralized Service Management**: The new `ToolkitCoordinator` provides a single entry point for all toolkit services, simplifying initialization and configuration.

**Before** (scattered services):
```typescript
// Create 5+ services independently
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const catalogResolver = new AccessibilityCatalogResolver([...]);
// Missing: ElementToolStateStore

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Pass all services separately
player.ttsService = ttsService;
player.toolCoordinator = toolCoordinator;
// ...
```

**After** (coordinator orchestrates):
```typescript
// Create one coordinator with configuration
const toolkitCoordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  tools: {
    providers: {
      textToSpeech: { enabled: true, backend: 'browser' },
      calculator: { enabled: true }
    },
    placement: {
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    }
  }
});

// Pass single coordinator to player
player.toolkitCoordinator = toolkitCoordinator;
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

See [ToolkitCoordinator Architecture](../../docs/architecture/TOOLKIT_COORDINATOR.md) for complete design documentation.

### Core Principles

1. **Centralized Coordination**: ToolkitCoordinator orchestrates all services
2. **Composable Services**: Import only what you need (or use coordinator for convenience)
3. **No Framework Lock-in**: Works with any JavaScript framework
4. **Product Control**: Products control navigation, persistence, layout, backend
5. **Standard Contracts**: Well-defined event types for component communication
6. **Element-Level Granularity**: Tool state tracked per PIE element, not per item
7. **State Separation**: Tool state (ephemeral) separate from PIE session data (persistent)

## Configuration tiers: easy attribute + sophisticated `runtime`

This package and `@pie-players/pie-section-player` follow a deliberate
two-tier configuration model. The same knob can usually be set in either
tier; the choice is about ergonomics, not capability.

### When to use each tier

- **Easy tier — top-level CE attributes / properties.** Use these for the
  common cases that are static for the lifetime of the player or that hosts
  want to set declaratively in HTML / templating frameworks. Example:

  ```html
  <pie-assessment-toolkit
    assessment-id="my-assessment"
    section-id="s-1"
    tool-config-strictness="warn"
  ></pie-assessment-toolkit>
  ```

- **Sophisticated tier — passing a constructed `ToolkitCoordinator` (or a
  `runtime` object on consumer CEs).** Use this for advanced cases: composed
  configuration, dynamic overrides, runtime mutation, fields without a
  tier-1 attribute, or anything that benefits from being a single typed
  object passed by reference. Example:

  ```ts
  const coordinator = new ToolkitCoordinator({
    assessmentId: "my-assessment",
    toolConfigStrictness: "warn",
    tools: {
      providers: { calculator: { enabled: true } },
      placement: { item: ["calculator", "textToSpeech"] },
    },
  });
  el.coordinator = coordinator;
  ```

### Naming rule

The easy-tier attribute name is the kebab-cased version of the runtime /
config key. `tool-config-strictness` ↔ `toolConfigStrictness`,
`assessment-id` ↔ `assessmentId`, `player-type` ↔ `playerType`. Hosts can
move a knob from the easy tier to the configuration object (or back)
without renaming.

### Precedence rule

The configuration object wins. When the same knob is set in both tiers,
resolution is:

1. The constructed `ToolkitCoordinator` config (or `runtime.<key>` on a
   consumer CE) if set
2. Top-level attribute / property if set
3. Documented default

This applies symmetrically to `pie-assessment-toolkit` itself and to
section-player CEs that embed it. New knobs MUST follow this precedence;
do not add ad-hoc fall-throughs.

### Canonical tier-1 attribute set

The tier-1 attribute set is the same shape across
`pie-assessment-toolkit`, `pie-section-player-base`, and the
`pie-section-player-*` layout elements (locked in M5). Every tier-1
surface obeys the strict mirror rule:

```
kebab-attribute  ↔  camelCaseProp  ↔  runtime.<sameCamelCaseKey>
```

Common members include:

- Identity: `assessment-id`, `section-id`, `attempt-id`
- Player: `player-type`, `lazy-init`
- Tools: `tools` (object property), `tool-registry` (object property),
  `enabled-tools` (shorthand for `tools.placement.section`)
- Coordination: `coordinator`, `create-section-controller`
- Accessibility: `accessibility` (object property; the deprecated
  `accessibility` *attribute* mapping was removed in M5)
- Diagnostics: `tool-config-strictness`, `debug`. Framework-error
  delivery is via the canonical `onFrameworkError` callback prop and the
  `framework-error` DOM event dispatched on the layout CE host.

Documented exceptions to the mirror rule:

- Identity (`section-id`, `attempt-id`, `section`): per-attempt host
  state, not configuration.
- Layout-only shell knobs on the section-player layout CEs
  (`show-toolbar`, `toolbar-position`, `narrow-layout-breakpoint`,
  `split-pane-collapse-strategy`): layout-CE rendering concerns.
- Deprecated aliases (`item-toolbar-tools`, `passage-toolbar-tools`):
  absorbed at the CE boundary.

### When to add a tier-1 attribute

Add a tier-1 attribute only if all of the following hold:

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

// Create coordinator with configuration
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    providers: {
      textToSpeech: { enabled: true, backend: 'browser', defaultVoice: 'en-US' },
      calculator: { enabled: true }
    },
    placement: {
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
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
player.toolkitCoordinator = coordinator;

// Access services directly if needed
const ttsService = coordinator.ttsService;
const toolState = coordinator.elementToolStateStore.getAllState();
```

### Controller Event Subscriptions (Helper First)

For host-side session/progress logic, prefer helper subscriptions over the generic filter API:

```typescript
const unsubscribeItem = coordinator.subscribeItemEvents({
  sectionId: 'section-1',
  attemptId: 'attempt-1',
  itemIds: ['item-1', 'item-2'],
  listener: (event) => {
    // item-selected, item-session-data-changed, item-complete-changed, ...
  }
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  sectionId: 'section-1',
  attemptId: 'attempt-1',
  listener: (event) => {
    // section-loading-complete, section-items-complete-changed, section-error, ...
  }
});

// cleanup
unsubscribeItem?.();
unsubscribeSection?.();
```

Use `subscribeSectionEvents(...)` when you need advanced/custom filtering mixes.  
Note that section-scoped events do not carry item IDs, so pairing them with `itemIds` filters will not match.
For late subscribers, `subscribeSectionLifecycleEvents(...)` immediately replays
`section-loading-complete` when the target controller runtime is already in a
loaded state.
For deterministic targeting in multi-attempt hosts, pass both `sectionId` and
`attemptId` to helper subscriptions.

### Option 2: Create Services Manually (Advanced)

```typescript
import {
  TTSService,
  BrowserTTSProvider,
  ToolCoordinator,
  HighlightCoordinator,
  AccessibilityCatalogResolver,
  ElementToolStateStore
} from '@pie-players/pie-assessment-toolkit';

// Initialize each service independently
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const elementToolStateStore = new ElementToolStateStore();
const catalogResolver = new AccessibilityCatalogResolver([], 'en-US');

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Pass services individually
player.ttsService = ttsService;
player.toolCoordinator = toolCoordinator;
// ...
```

## Tool Configuration Model

The toolkit uses one canonical `tools` model with three concerns:

- `policy`: allow/block constraints (global gates)
- `placement`: where tools appear (`assessment`, `section`, `item`, `passage`, `rubric`, plus custom registered levels)
- `providers`: provider/runtime options (calculator, textToSpeech, etc.)

Example:

```typescript
tools: {
  policy: {
    allowed: ['calculator', 'textToSpeech', 'answerEliminator', 'graph', 'periodicTable'],
    blocked: ['graph']
  },
  placement: {
    assessment: [],
    section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
    item: ['calculator', 'textToSpeech', 'answerEliminator'],
    passage: ['textToSpeech'],
    rubric: []
  },
  providers: {
    calculator: { authFetcher: async () => ({ apiKey: '...' }) },
    textToSpeech: { enabled: true, backend: 'browser', defaultVoice: 'en-US' }
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
- **Highlighter**: Highlights text within the item (future)

**Example Use Case:**
A student uses answer eliminator on Question 3 to cross out choices B and D. When they navigate to Question 4, they see fresh, uneliminated choices. When they return to Question 3, their eliminations are restored.

### Section-Level Tools (`tools.placement.section`)

Tools that **float above the entire assessment** and persist across questions:

```typescript
tools: {
  placement: {
    section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler', 'colorScheme']
  },
  providers: {
    calculator: {
      enabled: true,
      authFetcher: async () => { /* ... */ }
    }
  }
}
```

**Characteristics:**
- **Scope**: Section-wide, shared across all questions
- **Lifecycle**: Single instance initialized for entire section
- **State**: Persistent (calculator history remains as you navigate)
- **UI Pattern**: Draggable floating panels/overlays with z-index management
- **State Persistence**: Global state maintained throughout section

**Available Floating Tools:**
- **Calculator**: Scientific/graphing calculator with computation history
- **Graph**: Graphing tool for plotting functions
- **Periodic Table**: Interactive periodic table reference
- **Protractor**: Angle measurement tool
- **Ruler**: Linear measurement tool (metric/imperial)
- **Line Reader**: Reading guide/masking overlay
- **Magnifier**: Screen magnification tool
- **Color Scheme**: High-contrast color adjustments

**Example Use Case:**
A student opens the calculator on Question 2, computes 45 × 12 = 540. They navigate to Question 7, and the calculator still shows their computation history. They can reference previous calculations across multiple questions without losing context.

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
const coordinator = new ToolkitCoordinator({
  assessmentId: 'math-exam',
  tools: {
    placement: {
      // Contextual placement
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
      // Section-level utilities
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler', 'colorScheme']
    },
    providers: {
      calculator: {
        enabled: true,
        authFetcher: async () => {
          const response = await fetch('/api/tools/desmos/auth');
          return response.json();
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

**Simple Default (All Tools Enabled):**

For most use cases, simply enable all available tools:

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  tools: {
    placement: {
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    },
    providers: {
      calculator: { enabled: true },
      textToSpeech: { enabled: true, backend: 'browser' }
    }
  }
});
```

The ToolkitCoordinator handles all internal complexity (service initialization, provider management, state coordination). The only special configuration is `authFetcher` for Desmos calculator (optional - falls back to local calculator if not provided).

### Minimal Server-Backed TTS Config

For Polly/Google server-backed TTS, the provider config supports a minimal form.
Common options are defaulted so you can start with:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'polly'
    }
  }
}
```

By default, server-backed TTS resolves:

- `apiEndpoint: '/api/tts'`
- `transportMode: 'pie'`
- `endpointValidationMode: 'voices'`

You can still set `apiEndpoint` explicitly when your host route is not `/api/tts`.

### Inline TTS Speed Options

Inline TTS speed buttons are configurable via `speedOptions` in provider settings.

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: "browser",
      settings: {
        speedOptions: [2, 1.25, 1.5] // rendered in this order
      }
    }
  }
}
```

`speedOptions` semantics:

- Omitted or non-array: default speed buttons are shown (`0.8x`, `1.25x`).
- Explicit empty array (`[]`): hide all speed buttons.
- Invalid-only arrays (for example `["fast", -1, 1]`): fall back to defaults.
- Valid numeric values are deduplicated and keep first-seen order.
- `1` is excluded (normal speed is already available by toggling active speed off).

### Runtime Fallback: Server TTS -> Browser TTS

When server-backed playback fails at runtime (for example `503`, network outage,
or synthesized asset fetch failure), `TTSService` now performs a one-time
runtime fallback for that session:

1. Switches provider from server-backed implementation to browser speech synthesis.
2. Rebinds highlight callbacks to the browser provider.
3. Retries the same `speak()` request once.

This keeps the inline/passage TTS controls usable during transient backend
incidents without requiring host-side reconfiguration.

Telemetry emitted for observability:

- `pie-tool-runtime-fallback` (fallback switch succeeded)
- `pie-tool-runtime-fallback-error` (fallback switch failed)

`provider.runtime.authFetcher` is optional. Add it only when your host environment
requires runtime auth material for TTS requests:

```typescript
tools: {
  providers: {
    textToSpeech: {
      enabled: true,
      backend: 'polly',
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

## Test Attempt Session Adapter (pie backend)

The toolkit exposes a canonical `TestAttemptSession` runtime and a deterministic adapter for pie backend activity payloads from `../../kds/pie-api-aws`.

```typescript
import {
  mapActivityToTestAttemptSession,
  toItemSessionsRecord,
  buildActivitySessionPatchFromTestAttemptSession
} from "@pie-players/pie-assessment-toolkit";

const testAttemptSession = mapActivityToTestAttemptSession({
  activityDefinition,
  activitySession
});

// Use in section-player handoff (same item session shape as item players expect)
const itemSessions = toItemSessionsRecord(testAttemptSession);

// Host-owned backend persistence payload
const patch = buildActivitySessionPatchFromTestAttemptSession(testAttemptSession);
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

### ✅ Core Infrastructure

- **TypedEventBus**: Generic type-safe `EventTarget` wrapper exported as a building block. The toolkit's own production events are emitted via DOM `CustomEvent`s on `<pie-assessment-toolkit>` and via `ToolkitCoordinator.subscribe*` helpers, not through this bus. Hosts and downstream packages may still use it to compose their own typed event maps.
- **Event Types**: ⚠️ The colon-namespaced `AssessmentToolkitEvents` map (`player:*`, `tool:*`, `nav:*`, `assessment:*`, `state:*`, `interaction:*`, `i18n:*`) and its member interfaces are deprecated. They were aspirational and are not emitted from any production path. They will be removed in the next major release. See `src/types/events.ts` for the canonical replacement surfaces (DOM `CustomEvent`s, `ToolkitCoordinator.subscribe*`, and the M3 framework-error contract).

### ✅ Toolkit Services

- **ToolkitCoordinator**: ⭐ NEW - Centralized service orchestration
- **ElementToolStateStore**: ⭐ NEW - Element-level ephemeral tool state management
- **ToolRegistry**: ⭐ NEW - Registry-based tool management with QTI 3.0 PNP support
- **PNPToolResolver**: ⭐ REFACTORED - QTI 3.0 Personal Needs Profile tool resolution via registry
- **ToolCoordinator**: Manages z-index layering and visibility for floating tools
- **HighlightCoordinator**: Separate highlight layers for TTS (temporary) and annotations (persistent)
- **TTSService**: Text-to-speech with QTI 3.0 catalog support
- **AccessibilityCatalogResolver**: QTI 3.0 accessibility catalog management
- **SSMLExtractor**: Automatic extraction of embedded `<speak>` tags
- **ThemeProvider**: Consistent accessibility theming

### ✅ QTI 3.0 Standard Access Features

- **95+ Standardized Features**: Complete QTI 3.0 / IMS AfA 3.0 accessibility features
- **9 Feature Categories**: Visual, auditory, motor, cognitive, reading, navigation, linguistic, assessment
- **Example Configurations**: Illustrative PNP profile examples (low vision, dyslexia, ADHD, etc.)
- **Tool Mappings**: All 12 default tools map to standard QTI 3.0 features

### ✅ Section Player Integration

The toolkit integrates seamlessly with the **PIE Section Player**:

- **Primary Interface**: Section player is the main integration point
- **Default Coordinator**: Creates ToolkitCoordinator automatically if not provided
- **Automatic SSML Extraction**: Extracts embedded `<speak>` tags from passages and items
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
      assessment?: string[];
      section?: string[];
      item?: string[];
      passage?: string[];
      rubric?: string[];
    };
    providers?: {
      textToSpeech?: {
        enabled?: boolean;
        backend?: 'browser' | 'polly' | 'google' | 'server';
        defaultVoice?: string;
        rate?: number;
      };
      calculator?: {
        enabled?: boolean;
        authFetcher?: () => Promise<Record<string, unknown>>;
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
// Get all services as a bundle
const services = coordinator.getServiceBundle();
// Returns: { ttsService, toolCoordinator, highlightCoordinator, elementToolStateStore, catalogResolver }

// Tool configuration
coordinator.isToolEnabled('textToSpeech');  // Check if tool is enabled
coordinator.getToolConfig('textToSpeech');  // Get tool-specific config
coordinator.updateToolConfig('textToSpeech', { rate: 1.5 });  // Update tool config
```

### Direct Service Access

All services are public properties for direct access:

```typescript
coordinator.ttsService              // TTSService instance
coordinator.toolCoordinator         // ToolCoordinator instance
coordinator.highlightCoordinator    // HighlightCoordinator instance
coordinator.elementToolStateStore   // ElementToolStateStore instance
coordinator.catalogResolver         // AccessibilityCatalogResolver instance
```

## ElementToolStateStore API

The `ElementToolStateStore` manages ephemeral tool state at the element level using globally unique composite keys.

### Key Concepts

- **Global Element ID**: Composite key format: `${assessmentId}:${sectionId}:${itemId}:${elementId}`
- **Element-Level Granularity**: State tracked per PIE element (not per item)
- **Ephemeral State**: Tool state is client-only, separate from PIE session data
- **Cross-Section Persistence**: State persists when navigating between sections

### ID Utilities

```typescript
// Generate global element ID
const globalElementId = store.getGlobalElementId(
  'demo-assessment',
  'section-1',
  'question-1',
  'mc1'
);
// Returns: "demo-assessment:section-1:question-1:mc1"

// Parse global element ID
const components = store.parseGlobalElementId(globalElementId);
// Returns: { assessmentId, sectionId, itemId, elementId }
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

// Clear all elements in a specific section
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
const ttsService = new TTSService();

// Initialize with provider
await ttsService.initialize(new BrowserTTSProvider());

// Set catalog resolver for SSML support
ttsService.setCatalogResolver(catalogResolver);

// Playback
await ttsService.speak('Read this text', {
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

```typescript
const toolCoordinator = new ToolCoordinator();

// Register tools
toolCoordinator.registerTool('calculator', 'Calculator', element);

// Manage visibility
toolCoordinator.showTool('calculator');
toolCoordinator.hideTool('calculator');
toolCoordinator.toggleTool('calculator');

// Z-index management
toolCoordinator.bringToFront(element);

// Check state
const isVisible = toolCoordinator.isToolVisible('calculator');
```

### HighlightCoordinator

```typescript
const highlightCoordinator = new HighlightCoordinator();

// TTS highlights (temporary)
highlightCoordinator.highlightTTSWord(textNode, start, end);
highlightCoordinator.highlightTTSSentence([range1, range2]);
highlightCoordinator.clearTTS();

// Annotation highlights (persistent)
const id = highlightCoordinator.addAnnotation(range, 'yellow');
highlightCoordinator.removeAnnotation(id);
```

### AccessibilityCatalogResolver

```typescript
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

### SSMLExtractor

```typescript
const extractor = new SSMLExtractor();

// Extract from item config
const result = extractor.extractFromItemConfig(item.config);

// Update item with cleaned config
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;

// Register with catalog resolver
catalogResolver.addItemCatalogs(result.catalogs);
```

## Integration with Section Player

The section player provides automatic ToolkitCoordinator integration:

```html
<pie-section-player id="player"></pie-section-player>

<script type="module">
  import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

  // Create coordinator
  const coordinator = new ToolkitCoordinator({
    assessmentId: 'my-assessment',
    tools: {
      providers: { textToSpeech: { enabled: true, backend: 'browser' } },
      placement: {
        section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
        item: ['calculator', 'textToSpeech', 'answerEliminator'],
        passage: ['textToSpeech']
      }
    }
  });

  // Pass to player
  const player = document.getElementById('player');
  player.toolkitCoordinator = coordinator;
  player.section = mySection;

  // Player automatically:
  // - Extracts services from coordinator
  // - Generates section ID
  // - Provides runtime context to child components
  // - Manages SSML extraction
  // - Handles catalog lifecycle
</script>
```

### Runtime Context Contract

The toolkit now exports a shared context key used by section-player and toolkit
components:

```typescript
import {
  assessmentToolkitRuntimeContext,
  type AssessmentToolkitRuntimeContext
} from "@pie-players/pie-assessment-toolkit";
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
//   assessmentId: 'anon_...',  // auto-generated
//   tools: {
//     providers: { textToSpeech: { enabled: true, backend: 'browser' }, calculator: { enabled: true } },
//     placement: {
//       section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
//       item: ['calculator', 'textToSpeech', 'answerEliminator'],
//       passage: ['textToSpeech']
//     }
//   }
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
  createPackagedToolRegistry,
  createToolsConfig,
  ToolkitCoordinator
} from "@pie-players/pie-assessment-toolkit";

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
- Custom tools can provide provider-level `sanitizeConfig` and `validateConfig` hooks.
- Hosts can react to framework errors via the `framework-error` DOM event,
  the `onFrameworkError(model)` callback prop, or by subscribing directly
  to the package-internal bus via
  `ToolkitCoordinator.subscribeFrameworkErrors(listener)`. The callback
  prop fires exactly once per error, regardless of wrapper depth.
- Per-tool/provider error hooks (`onProviderError`, `onTTSError`) are
  delivered through the same bus and continue to fire for hosts that
  rely on them.
- See `docs/tools-and-accomodations/framework-owned-error-handling.md` for event payload and error-kind mapping details.

## Section Runtime Engine (advanced)

The toolkit exposes a layered **section runtime engine** that consolidates
runtime resolution, FSM-driven stage progression, framework-error reporting,
DOM-event fan-out, and instrumentation into a single object hosts can mount
and dispose. The engine is what `<pie-section-player-…>` and
`<pie-assessment-toolkit>` use internally, and it is also the surface
custom hosts (or alternate layout shells) consume directly.

### Two import paths

The engine ships with two deliberately separate entry points so consumers
pick the stability surface that matches their use case:

- **Stable facade — `@pie-players/pie-assessment-toolkit/runtime/engine`.**
  Narrow, semver-stable surface for hosts that want to mount, drive, and
  dispose a section runtime. Re-exports `SectionRuntimeEngine`,
  `SECTION_RUNTIME_ENGINE_KEY` (Svelte context), the cross-CE host
  context (`sectionRuntimeEngineHostContext`), and the consumer-side
  helper for that bridge (`connectSectionRuntimeEngineHostContext`).
- **Internal surface — `@pie-players/pie-assessment-toolkit/runtime/internal`.**
  Wider, evolving surface for advanced hosts that need to construct an
  engine manually, inspect FSM state, or build alternate fan-out paths.
  Exposes `SectionEngineCore`, the five adapter bridges
  (`createDomEventBridge`, `createFrameworkErrorBridge`,
  `createLegacyEventBridge`, `createCoordinatorBridge`,
  `createInstrumentationBridge`), `FrameworkErrorBus`, cohort helpers,
  and the `resolveRuntime` / `resolveToolsConfig` /
  `resolveSectionEngineRuntimeState` helpers. Symbols here may change
  between minor versions with a changeset note.

### Single-engine invariant

When `<pie-assessment-toolkit>` is nested inside a section-player layout,
the layout kernel publishes its engine reference via
`sectionRuntimeEngineHostContext`. The toolkit detects that upstream
engine and **suppresses its own external lifecycle DOM emits and stage
tracker** in favor of the kernel's engine. From the outside, one cohort
yields one `pie-stage-change` / `pie-loading-complete` chain on the
layout CE host regardless of wrapper depth — even though, during the
0.x line, the toolkit still constructs a local engine instance for its
controller-side surface (`register`, `handleContent*`, `initialize`).
A future release collapses the toolkit's controller-side surface onto
the upstream engine; until then the externally observable invariant —
**one cohort, one canonical event chain** — is what hosts should rely
on. A standalone `<pie-assessment-toolkit>` (no upstream context)
emits from its own engine.

**Detection.** If a custom layout shell emits two `pie-stage-change`
events per stage transition (or two `pie-loading-complete` per cohort)
on the same layout CE — typically with two distinct `detail.runtimeId`
values — the shell has not published its engine via
`sectionRuntimeEngineHostContext`, so the wrapped
`<pie-assessment-toolkit>` falls back to its standalone path and
constructs a second engine. Wire the bridge as shown below.

### Common-host wiring example

Most hosts never construct the engine directly — the section-player
layout CE and the toolkit CE handle it. Use the facade only when
building an alternate layout shell (e.g. a custom kernel host). The
shape mirrors what the section-player kernel does internally:

```ts
import { ContextProvider } from "@pie-players/pie-context";
import {
  SectionRuntimeEngine,
  sectionRuntimeEngineHostContext,
} from "@pie-players/pie-assessment-toolkit/runtime/engine";
import {
  FrameworkErrorBus,
  makeCohort,
} from "@pie-players/pie-assessment-toolkit/runtime/internal";

const bus = new FrameworkErrorBus();
const engine = new SectionRuntimeEngine();

// 1. Attach to the layout CE host. `sourceCe` is stamped onto every
//    DOM event the engine dispatches and is required.
engine.attachHost({
  host: layoutHostElement,
  sourceCe: "my-custom-layout",
  frameworkErrorBus: bus,
  coordinator: toolkitCoordinator,
});

// 2. Publish the engine reference on the layout CE host so any
//    wrapped <pie-assessment-toolkit> consumes it instead of
//    constructing its own (single-engine invariant).
const engineProvider = new ContextProvider(layoutHostElement, {
  context: sectionRuntimeEngineHostContext,
  initialValue: { engine },
});
engineProvider.connect();

// 3. (Optional) Subscribe to the structured output stream — same set
//    of outputs the DOM-event bridge fans out to the host element.
engine.subscribe((output) => {
  // tap stage transitions, readiness updates, framework errors,
  // instrumentation events
});

// 4. Drive the engine. Use real `SectionEngineInput` shapes:
const cohort = makeCohort({ sectionId, attemptId });
engine.dispatchInput({
  kind: "initialize",
  cohort,
  effectiveRuntime,
  effectiveToolsConfig,
  itemCount,
});

// On loading-progress / readiness signal updates:
engine.dispatchInput({
  kind: "update-readiness-signals",
  signals: {
    sectionReady,
    interactionReady,
    allLoadingComplete,
    runtimeError,
  },
  loadedCount,
  itemCount,
  mode: "progressive",
});

// On unmount:
engineProvider.disconnect();
engine.dispose();
```

The DOM events `pie-stage-change`, `pie-loading-complete`, and
`framework-error` are dispatched on `host` automatically by the
adapter's `dom-event-bridge`. The canonical `onFrameworkError` callback
prop and the package-internal `FrameworkErrorBus` deliver each error
exactly once regardless of wrapper depth. The `framework-error` DOM
event itself is currently dual-emitted on the layout CE host when a
toolkit is nested (the toolkit's inner emit bubbles up alongside the
engine's bridge emit); the dual-emit is pinned by the contract test
`tests/section-player-framework-error-dual-emit.test.ts` and will be
collapsed in a future release. The deprecated readiness aliases
(`readiness-change`, `interaction-ready`, `ready`) are dual-emitted by
the `legacy-event-bridge` through the current 0.x line.

## State Separation: Tool State vs Session Data

The toolkit enforces a clear separation between ephemeral tool state and persistent session data:

### Tool State (Ephemeral - ElementToolStateStore)

**Client-only**, never sent to server for scoring:

```typescript
{
  "demo-assessment:section-1:question-1:mc1": {
    "answerEliminator": {
      "eliminatedChoices": ["choice-b", "choice-d"]
    },
    "highlighter": {
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
  IToolkitCoordinator,
  IElementToolStateStore,
  ToolkitCoordinatorConfig,
  ToolkitServiceBundle
} from '@pie-players/pie-assessment-toolkit';
```

## Content trust boundary

The toolkit embeds item content via the underlying `pie-item-player`
custom element and renders tool icons / SSML fragments that originate
from tool configuration. Two sanitization layers apply:

- **Item / passage markup** - sanitized by default in
  `pie-item-player`. See
  [pie-item-player README](./README.md#content-trust-boundary)
  for the `trust-markup` opt-out and the `sanitizeMarkup` override.
  As a post-sanitization step, every authored `<img>` outside a `pie-*`
  custom element is wrapped in `<span class="pie-image-scroll">` so
  overwide images surface a horizontal scrollbar instead of being
  clipped by the section layout's `overflow-x: hidden` ancestors
  (PIE-94 / WCAG 1.4.10 Reflow at 400% zoom). The wrapper is
  keyboard-scrollable (`tabindex="0"`, `role="region"`) and carries
  the image's `alt` text in its `aria-label`; matching CSS lives in
  `@pie-players/pie-theme` (`components.css`).
- **Tool icons and SSML** - tool-registered icon markup is parsed and
  DOMPurified inside the toolbar at render time; SSML payloads are
  restricted to an allow-listed subset of SSML tags/attributes before
  being forwarded to TTS providers. Do not ship tools that rely on raw
  `<script>` or event-handler attributes in their icon strings.

## Related Documentation

- **[Tool Registry Architecture](docs/TOOL_REGISTRY.md)** - ⭐ NEW - Registry-based tool management and QTI 3.0 PNP support
- **[PNP Configuration Guide](docs/PNP_CONFIGURATION.md)** - ⭐ NEW - How to configure student profiles, district policies, and governance rules
- [ToolkitCoordinator Architecture](../../docs/architecture/TOOLKIT_COORDINATOR.md) - Design decisions and patterns
- [Section Player README](../section-player/README.md) - Section player integration
- [Section Player Architecture](../section-player/ARCHITECTURE.md#layered-runtime-engine-post-m7) - Layered runtime engine, kernel/toolkit wiring, single-engine invariant
- [Framework-Owned Error Handling](../../docs/tools-and-accomodations/framework-owned-error-handling.md) - Canonical framework error model/events and fallback behavior
- [Safe Custom Tool Configuration](../../docs/tools-and-accomodations/safe-custom-tool-config.md) - Host-side config patterns and validation guidance
- [Architecture Overview](../../docs/architecture/architecture.md) - Complete system architecture

## License

MIT
