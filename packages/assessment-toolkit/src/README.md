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

## Next Steps

1. ✅ Complete core services implementation
2. 🚧 Build reference implementation (linear navigation, state management)
3. 🚧 Create demo with reference layout
4. 🚧 Add unit tests for all services
5. 🚧 Write integration guides (Quiz Engine, reference implementation)

## Related Documentation

- [Assessment Toolkit Architecture](../../../../../docs/tools-and-accomodations/assessment-player-architecture.md) - Complete design
- [Tools High-Level Architecture](../../../../../docs/tools-and-accomodations/tools-high-level-architecture.md) - Tool coordination
- [TTS Architecture](../../../../../docs/tools-and-accomodations/tts-architecture.md) - Text-to-speech design
