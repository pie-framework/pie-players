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

See [assessment-player-architecture.md](../../../../../docs/tools-and-accomodations/assessment-player-architecture.md) for complete design documentation.

### Core Principles

1. **Composable Services**: Import only what you need
2. **No Framework Lock-in**: Works with any JavaScript framework
3. **Product Control**: Products control navigation, persistence, layout, backend
4. **Standard Contracts**: Well-defined event types for component communication

## Implementation Status

### ✅ Core Infrastructure

- **TypedEventBus**: Type-safe event bus built on native EventTarget
- **Event Types**: Complete event definitions (player, tools, navigation, state, interaction)

### ✅ Toolkit Services

- **ToolCoordinator**: Manages z-index layering and visibility for floating tools
- **HighlightCoordinator**: Separate highlight layers for TTS (temporary) and annotations (persistent)
- **TTSService**: Singleton service providing text-to-speech across multiple entry points
- **ThemeProvider**: Consistent accessibility theming across items and tools
- **ToolConfigResolver**: 3-tier hierarchy for IEP/504 tool configuration

### ✅ Reference Implementation

- **AssessmentPlayer**: Complete working player showing how to wire toolkit services together
- Linear navigation through assessment items
- Event-driven architecture with TypedEventBus
- Session state management with subscriptions
- TTS integration via TTSService
- Theme support via ThemeProvider
- ToolCoordinator and HighlightCoordinator integration
- Product-specific callbacks for customization

### ✅ Live Integration

Features implemented:
- Accessibility settings UI (high contrast toggle, font size selector)
- TTS controls integrated with TTSService
- Navigation using AssessmentPlayer
- Theme changes applied dynamically via ThemeProvider

## Project Structure

```
assessment-toolkit/
├── core/
│   └── TypedEventBus.ts              # Event system
├── services/
│   ├── ToolCoordinator.ts            # Z-index, visibility
│   ├── HighlightCoordinator.ts       # TTS + annotation highlights
│   ├── TTSService.ts                 # Text-to-speech
│   ├── ThemeProvider.ts              # Accessibility theming
│   └── ToolConfigResolver.ts         # IEP/504 configuration
├── types/
│   └── events.ts                     # Event definitions
├── player/
│   ├── README.md                     # Optional reference patterns
│   └── navigation-types.ts           # Navigation abstractions
└── index.ts                          # Public exports
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

// Test blocks dictionary but allows calculator
const rosterConfig: RosterToolConfig = {
  calculator: "1",
  dictionary: "0"
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
// - dictionary: disabled (blocked by roster)
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

Singleton text-to-speech service.

```typescript
const ttsService = TTSService.getInstance();

// Initialize
await ttsService.initialize('browser');

// Playback
await ttsService.speak('Read this text');
await ttsService.speakRange(selectedRange);

// Controls
ttsService.pause();
ttsService.resume();
ttsService.stop();

// State
const isPlaying = ttsService.isPlaying();
```

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
import { AssessmentPlayer, PNPToolResolver } from '@pie-players/pie-assessment-toolkit';

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

// Simple initialization - tools automatically resolved
const player = new AssessmentPlayer({ assessment, loadItem });

// Or use PNPToolResolver directly
const resolver = new PNPToolResolver();
const tools = resolver.resolveTools(assessment, currentItemRef);
// Returns: [{ id: 'pie-tool-text-to-speech', enabled: true, ... }, ...]
```

**Standard PNP Support IDs:**

```typescript
'textToSpeech'    → 'pie-tool-text-to-speech'
'calculator'      → 'pie-tool-calculator'
'ruler'           → 'pie-tool-ruler'
'protractor'      → 'pie-tool-protractor'
'highlighter'     → 'pie-tool-annotation-toolbar'
'lineReader'      → 'pie-tool-line-reader'
'magnifier'       → 'pie-tool-magnifier'
'colorContrast'   → 'pie-theme-contrast'
'answerMasking'   → 'pie-tool-answer-eliminator'
```

### Context Declarations

Global variables shared across assessment items:

```typescript
import { AssessmentPlayer, ContextVariableStore } from '@pie-players/pie-assessment-toolkit';

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

// Use with AssessmentPlayer
const player = new AssessmentPlayer({ assessment, loadItem });

const seed = player.getContextVariable('RANDOM_SEED');
player.setContextVariable('DIFFICULTY_LEVEL', 'hard');

// Pass to PIE elements
const context = player.getContextVariables();
await renderItem(item, session, context);

// Or use ContextVariableStore directly
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

```
1. District Block (absolute veto)
2. Test Administration Override
3. Item Restriction (per-item block)
4. Item Requirement (forces enable)
5. District Requirement
6. PNP Supports (student accommodations)
```

## Related Documentation

- [Architecture Overview](../../../docs/ARCHITECTURE.md) - Complete system architecture
- [Assessment Toolkit Architecture](../../../docs/tools-and-accomodations/assessment-player-architecture.md) - Toolkit design
- [Tools Architecture](../../../docs/tools-and-accomodations/tools-high-level-architecture.md) - Tool coordination
