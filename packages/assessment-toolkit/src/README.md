# PIE Assessment Toolkit

**Independent, composable services** for coordinating tools, accommodations, and item players in assessment applications.

This is not an opinionated framework or monolithic "player" - it's a toolkit that solves specific problems.

## What Does It Solve?

- **Tool coordination**: z-index management, visibility state
- **Accommodation support**: IEP/504 tool configuration logic
- **TTS + annotation coordination**: Prevent conflicts between highlights
- **Event communication**: Standard contracts between components
- **Accessibility theming**: Consistent high-contrast, font sizing

## Architecture Overview

See [Tools & Accommodations Architecture](../../../docs/tools-and-accomodations/architecture.md) for complete design documentation.

### Primary Interface: Section Player

The **PIE Section Player** (`@pie-players/pie-section-player`) is the primary interface for integrating toolkit services. Pass services as JavaScript properties, and the player handles SSML extraction, catalog lifecycle, and TTS tool rendering automatically.

### Core Principles

1. **Composable Services**: Import only what you need
2. **No Framework Lock-in**: Works with any JavaScript framework
3. **Product Control**: Products control navigation, persistence, layout, backend
4. **Standard Contracts**: Well-defined event types for component communication
5. **Section Player Integration**: Seamless integration with the section player for automatic service coordination

## Implementation Status

### ✅ Core Infrastructure

- **TypedEventBus**: Type-safe event bus built on native EventTarget
- **Event Types**: Complete event definitions (player, tools, navigation, state, interaction)

### ✅ Toolkit Services

- **ToolCoordinator**: Manages z-index layering and visibility for floating tools
- **HighlightCoordinator**: Separate highlight layers for TTS (temporary) and annotations (persistent)
- **TTSService**: Singleton service providing text-to-speech across multiple entry points with QTI 3.0 catalog support
- **AccessibilityCatalogResolver**: QTI 3.0 accessibility catalog management for SSML, sign language, braille, etc.
- **SSMLExtractor**: Automatic extraction of embedded `<speak>` tags from content into accessibility catalogs
- **ThemeProvider**: Consistent accessibility theming across items and tools
- **ToolConfigResolver**: 3-tier hierarchy for IEP/504 tool configuration

### ✅ Section Player Integration

The toolkit integrates seamlessly with the **PIE Section Player**:

- **Primary Interface**: Section player is the main integration point
- **Automatic SSML Extraction**: Extracts embedded `<speak>` tags from passages and items
- **Catalog Lifecycle**: Manages item-level catalogs automatically (add on load, clear on navigation)
- **TTS Tool Rendering**: Shows inline TTS buttons in passage/item headers
- **Service Coordination**: All toolkit services work together automatically

**Integration Pattern**:

```javascript
import {
  TTSService,
  AccessibilityCatalogResolver,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const catalogResolver = new AccessibilityCatalogResolver([], 'en-US');
// ... initialize other services

// Pass to section player
sectionPlayer.ttsService = ttsService;
sectionPlayer.catalogResolver = catalogResolver;
sectionPlayer.section = section;
```

### ✅ Runtime Integration

Use this toolkit package for shared services, section-player orchestration, and host-app integrations.

## Project Structure

```text
assessment-toolkit/
├── core/
│   └── TypedEventBus.ts                    # Event system
├── services/
│   ├── ToolCoordinator.ts                  # Z-index, visibility
│   ├── HighlightCoordinator.ts             # TTS + annotation highlights
│   ├── TTSService.ts                       # Text-to-speech with catalog support
│   ├── AccessibilityCatalogResolver.ts     # QTI 3.0 catalog management
│   ├── SSMLExtractor.ts                    # Automatic SSML extraction
│   ├── ThemeProvider.ts                    # Accessibility theming
│   └── ToolConfigResolver.ts               # IEP/504 configuration
├── types/
│   └── events.ts                           # Event definitions
├── player/
│   ├── README.md                           # Optional reference patterns
│   └── navigation-types.ts                 # Navigation abstractions
└── index.ts                                # Public exports
```

## Usage Examples

### Minimal Integration (Just Events + Tools)

```typescript
import {
  TypedEventBus,
  ToolCoordinator,
  type AssessmentToolkitEvents
} from '$lib/assessment-toolkit';

const eventBus = new TypedEventBus<AssessmentToolkitEvents>();
const toolCoordinator = new ToolCoordinator();

// Register tools
toolCoordinator.registerTool('calculator', 'Calculator', calcElement);

// Wire up events
eventBus.on('player:session-changed', async (e) => {
  await myBackend.save(e.detail.session);
});

eventBus.on('tool:activated', (e) => {
  toolCoordinator.bringToFront(e.target);
});
```

### Advanced Integration (All Services)

```typescript
import {
  TypedEventBus,
  ToolCoordinator,
  HighlightCoordinator,
  TTSService,
  ThemeProvider,
  ToolConfigResolver,
  type AssessmentToolkitEvents
} from '$lib/assessment-toolkit';

// Initialize services
const eventBus = new TypedEventBus<AssessmentToolkitEvents>();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const ttsService = TTSService.getInstance();
const themeProvider = new ThemeProvider();
const toolResolver = new ToolConfigResolver();

// Initialize TTS
await ttsService.initialize('browser');
ttsService.setHighlightCoordinator(highlightCoordinator);

// Apply accessibility theme
themeProvider.applyTheme({
  highContrast: true,
  fontSize: 'large'
});

// Resolve tool configuration
const toolConfig = toolResolver.resolveTool(
  'calculator',
  itemConfig.tools,        // Item level
  rosterConfig.allowances, // Roster level
  studentProfile.accommodations // Student level
);

// Wire up events
eventBus.on('player:session-changed', async (e) => {
  await myBackend.saveSession(e.detail);
  myAnalytics.track('response', e.detail);
});

eventBus.on('tool:activated', (e) => {
  toolCoordinator.bringToFront(e.target);
  myAnalytics.track('tool-usage', e.detail);
});
```

### Tool Configuration Example

```typescript
import {
  ToolConfigResolver,
  type ItemToolConfig,
  type RosterToolConfig,
  type StudentAccommodations
} from '$lib/assessment-toolkit';

const resolver = new ToolConfigResolver();

// Scenario: Student with IEP requiring TTS and calculator
const studentProfile: StudentAccommodations = {
  accommodations: ['tts', 'calculator', 'extended-time']
};

// Test blocks lineReader but allows calculator
const rosterConfig: RosterToolConfig = {
  calculator: "1",
  lineReader: "0"
};

// Current item requires scientific calculator
const itemConfig: ItemToolConfig = {
  calculator: {
    type: 'scientific',
    required: true
  }
};

// Resolve all tools
const resolved = resolver.resolveAll({
  itemConfig,
  rosterConfig,
  studentProfile
});

// Result:
// - calculator: enabled (scientific, required by item)
// - tts: enabled (student accommodation)
// - lineReader: disabled (blocked by roster)
```

## Integration Patterns

### Pattern 1: Quiz Engine (Advanced - DIY Wiring)

Quiz Engine imports services and wires their own way.

```typescript
class QuizEngineAssessmentPlayer {
  private eventBus = new TypedEventBus<AssessmentToolkitEvents>();
  private toolCoordinator = new ToolCoordinator();

  constructor() {
    this.setupEventHandlers();
    this.setupQENavigation();
    this.setupQEPersistence();
  }

  private setupEventHandlers() {
    this.eventBus.on('player:session-changed', async (e) => {
      await this.qeBackend.saveSession(e.detail);
      this.qeAnalytics.track('response', e.detail);
    });
  }
}
```

### Pattern 2: Reference Implementation (Pre-fab)

Use the reference implementation with custom navigation.

```typescript
// Coming soon - reference implementation
```

## API Documentation

### TypedEventBus

Type-safe event bus built on native EventTarget.

```typescript
const eventBus = new TypedEventBus<AssessmentToolkitEvents>();

// Emit events
eventBus.emit('player:session-changed', { /* ... */ });

// Listen to events
eventBus.on('player:session-changed', (e) => {
  console.log('Session changed:', e.detail);
});

// One-time listeners
eventBus.once('player:load-complete', (e) => { /* ... */ });

// Remove listeners
eventBus.off('player:session-changed', handler);
```

### ToolCoordinator

Manages z-index layering and visibility.

```typescript
const toolCoordinator = new ToolCoordinator();

// Register tools
toolCoordinator.registerTool('calculator', 'Calculator', element);

// Manage visibility
toolCoordinator.showTool('calculator');
toolCoordinator.hideTool('calculator');
toolCoordinator.toggleTool('calculator');

// Bring to front
toolCoordinator.bringToFront(element);

// Check state
const isVisible = toolCoordinator.isToolVisible('calculator');
```

### HighlightCoordinator

Manages TTS and annotation highlights.

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

### TTSService

Singleton text-to-speech service with QTI 3.0 accessibility catalog support.

```typescript
import {
  TTSService,
  BrowserTTSProvider,
  AccessibilityCatalogResolver
} from '@pie-players/pie-assessment-toolkit';

const ttsService = new TTSService();

// Initialize with provider
await ttsService.initialize(new BrowserTTSProvider());

// Set up catalog resolver for SSML support
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US'
);
ttsService.setCatalogResolver(catalogResolver);

// Playback with catalog support
await ttsService.speak('Read this text', {
  catalogId: 'prompt-001',  // Uses pre-authored SSML if available
  language: 'en-US'
});

// Plain text fallback (no catalog)
await ttsService.speak('Read this text');

// Controls
ttsService.pause();
ttsService.resume();
ttsService.stop();

// State
const isPlaying = ttsService.isPlaying();

// Dynamic settings updates (for preview/live changes)
await ttsService.updateSettings({
  rate: 1.5,
  pitch: 1.2,
  voice: 'Matthew'
});
```

### AccessibilityCatalogResolver

Manages QTI 3.0 accessibility catalogs (SSML, sign language, braille, simplified language, etc.).

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

// Initialize with assessment-level catalogs
const resolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US'  // default language
);

// Add item-level catalogs (higher priority)
resolver.addItemCatalogs(item.accessibilityCatalogs);

// Get alternative representation
const alternative = resolver.getAlternative('prompt-001', {
  type: 'spoken',
  language: 'en-US',
  useFallback: true
});

// Clear item catalogs when navigating away
resolver.clearItemCatalogs();

// Get all alternatives for an identifier
const alternatives = resolver.getAllAlternatives('prompt-001');

// Check availability
const hasSpoken = resolver.hasCatalog('prompt-001');
```

### SSMLExtractor

Automatically extracts embedded `<speak>` tags from PIE content and generates QTI 3.0 accessibility catalogs.

```typescript
import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

const extractor = new SSMLExtractor();

// Extract from item config
const result = extractor.extractFromItemConfig(item.config);

// Result contains:
// - cleanedConfig: Config with SSML removed, catalog IDs added
// - catalogs: Generated accessibility catalogs

// Update item with cleaned config
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;

// Register with catalog resolver
catalogResolver.addItemCatalogs(result.catalogs);
```

**Example Input:**

```typescript
{
  prompt: `<div>
    <speak>Solve <prosody rate="slow">x squared</prosody>.</speak>
    <p>Solve x² = 0</p>
  </div>`
}
```

**Example Output:**

```typescript
{
  // Cleaned config
  prompt: `<div data-catalog-id="auto-prompt-q1-0">
    <p>Solve x² = 0</p>
  </div>`,

  // Generated catalogs
  extractedCatalogs: [{
    identifier: 'auto-prompt-q1-0',
    cards: [{
      catalog: 'spoken',
      language: 'en-US',
      content: '<speak>Solve <prosody rate="slow">x squared</prosody>.</speak>'
    }]
  }]
}
```

**Integration:** Used automatically by section player's ItemRenderer and PassageRenderer components.

### ThemeProvider

Accessibility theming.

```typescript
const themeProvider = new ThemeProvider();

// Apply theme
themeProvider.applyTheme({
  highContrast: true,
  fontSize: 'large',
  backgroundColor: '#000',
  foregroundColor: '#fff'
});

// Quick settings
themeProvider.setHighContrast(true);
themeProvider.setFontSize('xlarge');
```

### ToolConfigResolver

IEP/504 tool configuration.

```typescript
const resolver = new ToolConfigResolver();

// Resolve single tool
const config = resolver.resolveTool('calculator', itemConfig, rosterConfig, studentProfile);

// Resolve all tools
const allTools = resolver.resolveAll({ itemConfig, rosterConfig, studentProfile });

// Helpers
const enabled = resolver.isToolEnabled('calculator', input);
const required = resolver.isToolRequired('calculator', input);
const enabledTools = resolver.getEnabledTools(input);
```

## QTI 3.0 Support

The toolkit natively supports QTI 3.0 features for standards-compliant assessment delivery.

### Personal Needs Profile (PNP)

Student accommodations and IEP/504 support with automatic tool resolution:

```typescript
import { PNPToolResolver } from '@pie-players/pie-assessment-toolkit';

// QTI 3.0 assessment with PNP
const assessment = {
  personalNeedsProfile: {
    supports: ['textToSpeech', 'calculator'],
    activateAtInit: ['textToSpeech']
  },
  settings: {
    districtPolicy: {
      blockedTools: [],              // District blocks (absolute veto)
      requiredTools: ['ruler']        // District requires
    },
    toolConfigs: {
      calculator: {
        type: 'scientific',
        provider: 'desmos'
      }
    }
  }
};

// Or use PNPToolResolver directly
const resolver = new PNPToolResolver();
const tools = resolver.resolveTools(assessment, currentItemRef);
// Returns: [{ id: 'textToSpeech', enabled: true, ... }, ...]
```

**Standard PNP Support IDs -> toolkit tool IDs (semantic):**

```typescript
'textToSpeech'    → 'textToSpeech'
'calculator'      → 'calculator'
'ruler'           → 'ruler'
'protractor'      → 'protractor'
'highlighter'     → 'highlighter'
'lineReader'      → 'lineReader'
'magnifier'       → 'magnifier'
'colorContrast'   → 'colorScheme'
'answerMasking'   → 'answerEliminator'
```

Toolkit tool IDs resolve to default web component tags through `DEFAULT_TOOL_TAG_MAP`
and can be overridden via `createDefaultToolRegistry(...)`:

```typescript
import { createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';
import { DEFAULT_TOOL_MODULE_LOADERS } from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createDefaultToolRegistry({
  // Lazy tool module loading (recommended)
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
  toolTagMap: {
    calculator: 'my-calculator-tool',
    textToSpeech: 'my-tts-tool'
  }
});
```

### Context Declarations

Global variables shared across assessment items:

```typescript
import { ContextVariableStore } from '@pie-players/pie-assessment-toolkit';

// Assessment with context declarations
const assessment = {
  contextDeclarations: [
    {
      identifier: 'RANDOM_SEED',
      baseType: 'integer',
      cardinality: 'single',
      defaultValue: 42
    },
    {
      identifier: 'DIFFICULTY_LEVEL',
      baseType: 'string',
      cardinality: 'single',
      defaultValue: 'medium'
    }
  ]
};

// Use ContextVariableStore directly
const store = new ContextVariableStore(assessment.contextDeclarations);
store.set('RANDOM_SEED', 12345);
const context = store.toObject();
```

**Use Cases:**

- Cross-item randomization (shared random seeds)
- Adaptive testing (difficulty adjustment based on performance)
- Shared configuration (currency symbols, measurement units)
- Item dependencies (later items react to earlier responses)

### QTI 3.0 Precedence Hierarchy

Tool resolution follows this precedence (highest to lowest):

```text
1. District Block (absolute veto)
2. Test Administration Override
3. Item Restriction (per-item block)
4. Item Requirement (forces enable)
5. District Requirement
6. PNP Supports (student accommodations)
```

## Related Documentation

- [Architecture Overview](../../../docs/ARCHITECTURE.md) - Complete system architecture
- [Assessment Toolkit Architecture](../../../docs/tools-and-accomodations/tools-high-level-architecture.md) - Toolkit design
- [Tools Architecture](../../../docs/tools-and-accomodations/tools-high-level-architecture.md) - Tool coordination
