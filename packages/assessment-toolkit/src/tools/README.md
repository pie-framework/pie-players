# Assessment Tools System

This directory contains the core infrastructure for the assessment tools system, including type definitions, store management, and coordination logic.

## Architecture

### Core Components

1. **`types.ts`** - Type definitions for tools, tool state, and configuration
2. **`toolCoordinator.ts`** - Central store for managing tool visibility, z-index, and coordination
3. **`index.ts`** - Public API exports

### Tool Lifecycle

```typescript
// 1. Register tool (typically in onMount)
toolCoordinator.registerTool('my-tool', 'My Tool', element);

// 2. Show/hide tool
toolCoordinator.showTool('my-tool');
toolCoordinator.hideTool('my-tool');
toolCoordinator.toggleTool('my-tool');

// 3. Bring tool to front (when clicked)
toolCoordinator.bringToFront('my-tool');

// 4. Unregister (typically in onDestroy)
toolCoordinator.unregisterTool('my-tool');
```

## Tool Coordinator Store

The `toolCoordinator` manages:

- **Tool Registration**: Track all active tools
- **Visibility Management**: Show/hide tools
- **Z-Index Coordination**: Automatically manage layering
- **Active Tool Tracking**: Know which tool is currently in focus

### API Reference

#### `registerTool(id, name, element?)`
Register a new tool with the coordinator.

**Parameters:**
- `id: ToolId` - Unique identifier
- `name: string` - Display name
- `element?: HTMLElement` - DOM element reference (optional)

#### `unregisterTool(id)`
Remove a tool from the coordinator.

#### `showTool(id)`
Show a tool and bring it to the front.

#### `hideTool(id)`
Hide a tool.

#### `toggleTool(id)`
Toggle tool visibility.

#### `bringToFront(id)`
Bring a visible tool to the front (highest z-index).

#### `updateToolElement(id, element)`
Update the DOM element reference for a tool.

#### `hideAllTools()`
Hide all registered tools.

#### `getToolState(id)`
Get the current state of a tool.

**Returns:** `ToolState | undefined`

#### `isToolVisible(id)`
Check if a tool is currently visible.

**Returns:** `boolean`

### Derived Stores

- **`visibleTools`** - Array of all currently visible tools
- **`activeTool`** - The currently active (focused) tool

## Creating a New Tool

Tools are packaged as Svelte components in `src/lib/tags/tool-{name}/`:

### Directory Structure

```
src/lib/tags/tool-{name}/
├── package.json          # NPM package configuration
├── tool-{name}.svelte    # Main tool component
├── index.ts              # Exports
└── README.md             # Tool-specific documentation (optional)
```

### Example Tool Implementation

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  import type { Tool } from '$lib/assessment-toolkit/tools';

  export let visible: boolean = false;
  export let toolId: string = 'my-tool';

  let containerEl: HTMLDivElement;

  // Implement Tool interface
  const tool: Tool = {
    id: toolId,
    name: 'My Tool',
    show: () => { visible = true; },
    hide: () => { visible = false; },
    toggle: () => { visible = !visible; }
  };

  function handleClose() {
    toolCoordinator.hideTool(toolId);
  }

  onMount(() => {
    toolCoordinator.registerTool(toolId, 'My Tool', containerEl);
  });

  onDestroy(() => {
    toolCoordinator.unregisterTool(toolId);
  });

  $: if (containerEl) {
    toolCoordinator.updateToolElement(toolId, containerEl);
  }
</script>

{#if visible}
  <div 
    bind:this={containerEl}
    class="pie-tool-my-tool"
    on:mousedown={() => toolCoordinator.bringToFront(toolId)}
  >
    <div class="pie-tool-my-tool__header">
      <span>My Tool</span>
      <button on:click={handleClose}>×</button>
    </div>
    
    <!-- Tool content here -->
  </div>
{/if}

<style>
  .pie-tool-my-tool {
    position: fixed;
    /* Tool-specific styles */
  }
</style>
```

### Package.json Template

```json
{
  "name": "@pie-framework/pie-tool-{name}",
  "version": "1.0.0",
  "type": "module",
  "description": "{Tool Name} for PIE assessment player",
  "keywords": [
    "pie",
    "assessment",
    "tool"
  ],
  "svelte": "./tool-{name}.svelte",
  "main": "./index.ts",
  "exports": {
    ".": {
      "svelte": "./tool-{name}.svelte",
      "import": "./index.ts"
    }
  },
  "files": [
    "tool-{name}.svelte",
    "index.ts",
    "README.md"
  ],
  "peerDependencies": {
    "svelte": "^4.0.0"
  },
  "license": "MIT"
}
```

## Integration with Assessment Player

In the assessment player component:

```svelte
<script lang="ts">
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  import { ToolProtractor } from '$lib/tags/tool-protractor';
  // Or using full package name: import ToolProtractor from '@pie-framework/pie-tool-protractor';
  
  let showProtractor = false;
  
  // Subscribe to tool state
  $: {
    const state = toolCoordinator.getToolState('protractor');
    showProtractor = state?.isVisible ?? false;
  }
</script>

<!-- Tool button -->
<button 
  on:click={() => toolCoordinator.toggleTool('protractor')}
  class:active={showProtractor}
>
  Protractor
</button>

<!-- Tool component -->
<ToolProtractor visible={showProtractor} toolId="protractor" />
```

## Tool Categories

### Standalone Tools
Tools that don't interact with assessment content:
- Protractor
- Ruler
- Calculator
- Character Picker
- Graph Tool
- Periodic Table

### Content-Interactive Tools
Tools that need to access/manipulate question content:
- Annotation Toolbar (highlights, underlines)
- Text Magnifier
- Color Overlay

### Service-Dependent Tools
Tools that require external API integration:
- Dictionary
- Translation
- Text-to-Speech
- Picture Dictionary

## Best Practices

1. **Always register/unregister** tools in `onMount`/`onDestroy`
2. **Use the coordinator** for all visibility changes (don't manipulate `visible` prop directly)
3. **Bring to front** on user interaction (mousedown)
4. **Update element reference** when container changes
5. **Handle cleanup** properly to prevent memory leaks
6. **Make tools draggable** for better UX
7. **Add close buttons** to all tools
8. **Use consistent styling** (header, body, controls)
9. **Use namespaced classes** (`pie-tool-{name}` and `pie-tool-{name}__*`)

## Architectural Enhancement Services

The following services implement architectural enhancements based on analysis of production assessment platforms:

### 1. Library Loader Service

Dynamically loads external JavaScript libraries with retry logic and fallback URLs.

```typescript
import { libraryLoader, COMMON_LIBRARIES } from '$lib/assessment-toolkit/tools';

// Load Desmos calculator library
await libraryLoader.loadScript(COMMON_LIBRARIES.desmos);

// Check if loaded
if (libraryLoader.isLoaded('desmos')) {
  // Use Desmos API
  const calculator = Desmos.GraphingCalculator(element);
}

// Get loader statistics
const stats = libraryLoader.getStats();
console.log(`Loaded: ${stats.loaded.length}, Failed: ${stats.failed.length}`);
```

**Features:**
- Retry logic with exponential backoff
- Multiple fallback URLs (CDN → backup CDN → local)
- Timeout handling
- SRI (Subresource Integrity) support
- Statistics tracking

**Common Libraries:**
- `desmos` - Desmos calculator API
- `mathjax` - Math rendering
- `katex` - Fast math typesetting
- `ti84`, `ti108`, `ti34mv` - TI calculator emulators (placeholders)

### 2. Accommodation Resolver Service

Resolves final tool configuration by merging roster, student, and item configs.

```typescript
import { accommodationResolver } from '$lib/assessment-toolkit/tools';
import type { AccommodationProfile, RosterToolConfiguration, ItemToolConfig } from '$lib/assessment-toolkit/tools';

// Define configurations
const student: AccommodationProfile = {
  studentId: 'student-123',
  accommodations: {
    calculator: true,
    highlighter: true,
  },
};

const roster: RosterToolConfiguration = {
  rosterId: 'roster-456',
  toolAllowances: {
    calculator: '1', // allowed
    dictionary: '0', // blocked
  },
};

const item: ItemToolConfig = {
  itemId: 'item-789',
  requiredTools: ['protractor'], // required for this item
  restrictedTools: ['graphing-calculator'], // not allowed for this item
};

// Resolve final tools
const resolved = accommodationResolver.resolveToolsForItem(student, roster, item);
// Returns: [calculator, highlighter, protractor] (graphing-calculator blocked, dictionary blocked)

// Check specific tool
const result = accommodationResolver.isToolAllowed('calculator', student, roster, item);
console.log(result); // { allowed: true, reason: '...', source: 'student-accommodation' }

// Debug resolution
const trace = accommodationResolver.getResolutionTrace('calculator', student, roster, item);
```

**Precedence (highest to lowest):**
1. Roster block (`"0"` = blocked)
2. Item restriction
3. Item requirement
4. Student accommodation
5. Roster default (`"1"` = allowed)
6. System default (not allowed)

### 3. Variant Resolver Service

Resolves item configuration considering variants for A/B testing and scaffolding.

```typescript
import { variantResolver } from '$lib/assessment-toolkit/tools';
import type { ItemToolConfig, VariantContext } from '$lib/assessment-toolkit/tools';

const itemConfig: ItemToolConfig = {
  itemId: 'item-001',
  requiredTools: ['calculator'],
  variantConfig: {
    variantId: 'scaffolding-2',
    toolOverrides: {
      calculator: {
        parameters: {
          showHints: true,
          stepByStepMode: true,
        },
      },
    },
    adaptations: [
      {
        type: 'scaffolding',
        level: 2,
        affectedTools: ['calculator'],
      },
    ],
  },
};

const context: VariantContext = {
  studentId: 'student-123',
  sessionId: 'session-456',
  scaffoldingLevel: 2,
};

// Resolve variant
const resolved = variantResolver.resolveVariant(itemConfig, context);
console.log(resolved.appliedVariant); // 'scaffolding-2'
console.log(resolved.toolParameters.calculator.finalConfig); // Merged config with hints enabled
```

**Use Cases:**
- A/B testing different tool configurations
- Scaffolding for struggling students
- Difficulty adaptations
- Language-specific tool variants

### 4. Response Discovery Service

Finds and manages PIE response components for tool-to-response integration.

```typescript
import { responseDiscovery } from '$lib/assessment-toolkit/tools';

// Setup (in player initialization)
responseDiscovery.setupFocusTracking(); // Auto-track active response
responseDiscovery.autoDiscoverResponses(); // Find all response elements

// In calculator tool
async function insertIntoResponse() {
  const activeResponse = responseDiscovery.getActiveResponse();

  if (!activeResponse) {
    console.warn('No active response');
    return;
  }

  const result = calculator.getValue();
  const capabilities = activeResponse.getCapabilities();

  if (capabilities.acceptsNumeric) {
    await activeResponse.insertContent(result, {
      mode: 'insert',
      format: 'numeric',
      focus: true,
      source: {
        toolId: 'calculator',
        toolType: 'scientific',
        timestamp: Date.now(),
      },
    });
  }
}

// Listen for active response changes
responseDiscovery.onActiveResponseChanged((response) => {
  if (response) {
    console.log(`Active response: ${response.responseId}`);
  }
});
```

**Features:**
- Automatic response discovery from DOM
- Active response tracking (based on focus)
- Capability-based content insertion
- Format validation
- Event notifications

### 5. Calculator Provider System

Multi-provider calculator architecture supporting Desmos, Math.js, and TI emulators.

```typescript
import { desmosProvider, mathjsProvider, tiProvider } from '$lib/assessment-toolkit/tools';
import type { CalculatorType } from '$lib/assessment-toolkit/tools';

// Option 1: Math.js (Open Source - Apache 2.0)
// Perfect for testing without licensing requirements
await mathjsProvider.initialize();
const basicCalc = await mathjsProvider.createCalculator('basic', container);
const scientificCalc = await mathjsProvider.createCalculator('scientific', container);

// Option 2: Desmos (Requires License & API Key)
// Professional graphing calculator
// Obtain API key from https://www.desmos.com/api
await desmosProvider.initialize({
  apiKey: 'your_desmos_api_key_here'
});
const graphingCalc = await desmosProvider.createCalculator('graphing', container, {
  theme: 'light',
  restrictedMode: false,
});

// Use calculator
graphingCalc.setValue('y = x^2');
const value = graphingCalc.getValue();

// Export state for persistence
const state = graphingCalc.exportState();
localStorage.setItem('calculator-state', JSON.stringify(state));

// Restore state
const savedState = JSON.parse(localStorage.getItem('calculator-state'));
graphingCalc.importState(savedState);

// Switch providers
const tiCalculator = await tiProvider.createCalculator('ti-84', container);

// Cleanup
graphingCalc.destroy();
```

**Supported Calculator Types by Provider:**

| Provider | Basic | Scientific | Graphing | License | Status |
|----------|-------|------------|----------|---------|--------|
| **Math.js** | ✅ | ✅ | ❌ | Apache 2.0 (Free) | ✅ Production Ready |
| **Desmos** | ✅ | ✅ | ✅ | Proprietary | ✅ Production Ready |
| **TI** | ❌ | ❌ | ✅ (TI-84) | Proprietary | ⚠️ Stub Only |

**Math.js Provider Features:**
- ✅ **No licensing fees** - Apache 2.0 open source
- ✅ **Full calculator UI** - Button-based interface included
- ✅ **Scientific functions** - Trigonometry, logarithms, constants (π, e)
- ✅ **Angle modes** - Degrees and radians
- ✅ **History** - Calculation history tracking
- ✅ **Keyboard support** - Full keyboard navigation
- ✅ **State persistence** - Export/import calculator state
- ✅ **Perfect for testing** - Works out of the box without external dependencies

**When to Use Each Provider:**
- **Math.js**: Testing, basic/scientific calculators, cost-effective solution
- **Desmos**: Professional graphing, when graphing is required (requires API key for production)
- **TI**: Future - when TI emulator licensing is available

**Desmos API Key Configuration:**

Production usage of Desmos calculators requires an API key. There are three ways to provide it:

```typescript
// Method 1: Initialize with API key (recommended)
await desmosProvider.initialize({
  apiKey: 'your_desmos_api_key_here'
});

// Method 2: Per-calculator configuration
const calculator = await desmosProvider.createCalculator('graphing', container, {
  desmos: {
    apiKey: 'your_desmos_api_key_here'
  }
});

// Method 3: Global configuration (set before initialization)
window.PIE_DESMOS_API_KEY = 'your_desmos_api_key_here';
await desmosProvider.initialize();
```

To obtain a Desmos API key:
- Visit: <https://www.desmos.com/api>
- Contact: partnerships@desmos.com

**Note:** Development and testing work without an API key, but production deployments require a valid Desmos license.

**Provider Interface:**
All providers implement the same interface, allowing seamless switching between providers without code changes.

## Service Integration Example

Complete example showing all services working together:

```typescript
import {
  libraryLoader,
  accommodationResolver,
  variantResolver,
  responseDiscovery,
  desmosProvider,
  type AccommodationProfile,
  type RosterToolConfiguration,
  type ItemToolConfig,
} from '$lib/assessment-toolkit/tools';

// 1. Load required library
await libraryLoader.loadScript(COMMON_LIBRARIES.desmos);

// 2. Resolve tool configuration
const resolvedTools = accommodationResolver.resolveToolsForItem(
  studentProfile,
  rosterConfig,
  itemConfig
);

// 3. Resolve item variant
const resolvedItem = variantResolver.resolveVariant(itemConfig, variantContext);

// 4. Initialize calculator if allowed
const calculatorAllowed = resolvedTools.some((t) => t.id === 'calculator');
if (calculatorAllowed) {
  const calculator = await desmosProvider.createCalculator(
    'scientific',
    calculatorContainer,
    resolvedItem.toolParameters.calculator?.finalConfig
  );

  // 5. Setup response integration
  responseDiscovery.setupFocusTracking();

  // Insert calculator result into active response
  calculator.insertIntoResponse = async () => {
    const response = responseDiscovery.getActiveResponse();
    if (response) {
      await response.insertContent(calculator.getValue(), {
        mode: 'insert',
        format: 'numeric',
      });
    }
  };
}
```

## Future Enhancements

- [ ] Tool configuration persistence (save position, settings)
- [ ] Tool presets per assessment
- [ ] Keyboard shortcuts for tool activation
- [ ] Tool usage analytics
- [ ] Multi-tool interactions
- [x] Tool state serialization/restoration (via calculator providers)
- [x] Library loading with fallbacks (via LibraryLoader)
- [x] Multi-provider calculator support (Desmos + TI)
- [x] Tool-to-response integration (via ResponseDiscovery)
- [x] Configuration merge resolution (via AccommodationResolver)
- [x] Item variant support (via VariantResolver)

