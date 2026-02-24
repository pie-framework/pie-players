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
    tts: { enabled: true },
    answerEliminator: { enabled: true }
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

## Quick Start

### Option 1: Use ToolkitCoordinator (Recommended)

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

// Create coordinator with configuration
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    tts: { enabled: true, defaultVoice: 'en-US' },
    answerEliminator: { enabled: true }
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

## Tool Architecture: Item-Level vs Floating Tools

The toolkit distinguishes between two fundamentally different categories of tools based on their scope and lifecycle:

### Item-Level Tools (`tools` configuration)

Tools that operate **within the context of a specific question/item**:

```typescript
tools: {
  tts: { enabled: true },           // Reads this question's text
  answerEliminator: { enabled: true } // Strikes through this item's choices
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

### Section-Level Floating Tools (`floatingTools` configuration)

Tools that **float above the entire assessment** and persist across questions:

```typescript
floatingTools: {
  calculator: {
    enabled: true,
    provider: 'desmos',
    authFetcher: async () => { /* ... */ }
  },
  graph: { enabled: true },
  periodicTable: { enabled: true },
  protractor: { enabled: true },
  ruler: { enabled: true },
  lineReader: { enabled: true },
  magnifier: { enabled: true },
  colorScheme: { enabled: true }
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
    // Item-level: Different for each question
    tts: { enabled: true },
    answerEliminator: { enabled: true }
  },
  floatingTools: {
    // Section-level: Shared across all questions
    calculator: {
      enabled: true,
      provider: 'desmos',
      authFetcher: async () => {
        const response = await fetch('/api/tools/desmos/auth');
        return response.json();
      }
    },
    graph: { enabled: true },
    periodicTable: { enabled: true },
    protractor: { enabled: true },
    ruler: { enabled: true },
    lineReader: { enabled: true },
    magnifier: { enabled: true },
    colorScheme: { enabled: true }
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
    tts: { enabled: true },
    answerEliminator: { enabled: true }
  },
  floatingTools: {
    calculator: { enabled: true, provider: 'desmos' },
    graph: { enabled: true },
    periodicTable: { enabled: true },
    protractor: { enabled: true },
    ruler: { enabled: true },
    lineReader: { enabled: true },
    magnifier: { enabled: true },
    colorScheme: { enabled: true }
  }
});
```

The ToolkitCoordinator handles all internal complexity (service initialization, provider management, state coordination). The only special configuration is `authFetcher` for Desmos calculator (optional - falls back to local calculator if not provided).

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

## Implementation Status

### ✅ Core Infrastructure

- **TypedEventBus**: Type-safe event bus built on native EventTarget
- **Event Types**: Complete event definitions (player, tools, navigation, state, interaction)

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
    tts?: {
      enabled?: boolean;
      defaultVoice?: string;
      rate?: number;
      provider?: 'browser' | 'server';
    };
    answerEliminator?: {
      enabled?: boolean;
      strategy?: 'strikethrough' | 'hide';
    };
    highlighter?: { enabled?: boolean };
    // ... other tools
  };
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
coordinator.isToolEnabled('tts');  // Check if tool is enabled
coordinator.getToolConfig('tts');  // Get tool-specific config
coordinator.updateToolConfig('tts', { rate: 1.5 });  // Update tool config
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
    tools: { tts: { enabled: true } }
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
//   tools: { tts: { enabled: true }, answerEliminator: { enabled: true } }
// })
```

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

## Related Documentation

- **[Tool Registry Architecture](docs/TOOL_REGISTRY.md)** - ⭐ NEW - Registry-based tool management and QTI 3.0 PNP support
- **[PNP Configuration Guide](docs/PNP_CONFIGURATION.md)** - ⭐ NEW - How to configure student profiles, district policies, and governance rules
- [ToolkitCoordinator Architecture](../../docs/architecture/TOOLKIT_COORDINATOR.md) - Design decisions and patterns
- [Section Player README](../section-player/README.md) - Section player integration
- [Architecture Overview](../../docs/ARCHITECTURE.md) - Complete system architecture

## License

MIT
