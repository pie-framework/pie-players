# PIE Players - High-Level Architecture

**Version**: 1.0
**Date**: 2026-01-09
**Status**: Architecture Specification

---

## Executive Summary

The **PIE Players** project provides a comprehensive, modern architecture for rendering and delivering Platform for Interactive Education (PIE) assessment content. The system consists of multiple **item players** (for rendering individual questions) and an **assessment toolkit** (for coordinating full test experiences with tools, accommodations, and navigation).

Built with Bun, TypeScript, and Svelte 5, the architecture leverages modern web standards (Web Components, CSS Custom Highlight API) while maintaining framework independence and backwards compatibility with existing PIE content.

### Key Capabilities

- **Multiple Player Types**: IIFE (legacy compatible), ESM (modern), and Fixed (pre-bundled) players
- **Unified Authoring & Delivery**: Single players support both student/teacher delivery views and authoring/configuration modes
- **Assessment Toolkit**: Reference implementation for full test delivery with navigation, tools, and accommodations
- **Accessibility First**: WCAG 2.2 AA compliance, IEP/504 accommodation support
- **Framework Agnostic**: Web Components work with any JavaScript framework

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Item Players](#item-players)
3. [Assessment Toolkit](#assessment-toolkit)
4. [Tools & Accommodations](#tools--accommodations)
5. [Question Layout Engine](#question-layout-engine)
6. [Math Rendering](#math-rendering)
7. [Technology Stack](#technology-stack)
8. [Integration Patterns](#integration-patterns)
9. [References](#references)

---

## System Overview

### Architectural Layers

The PIE Players architecture consists of three major areas organized into logical layers:

![Architectural Layers](img/architectural-layers.png)

### Component Organization

![Component Organization](img/component-organization.png)

---

## Item Players

Item players are Web Components that render individual PIE assessment items. They handle element loading, model transformation, and session management.

### Player Types

The system includes both **interactive players** (for student/teacher interaction) and a **print player** (for static print views).

#### Interactive Players

##### 1. IIFE Player (`<pie-iife-player>`)

**Purpose**: Load PIE elements dynamically from IIFE bundles (legacy format).

**Use Cases**:

- Drop-in replacement for `@pie-framework/pie-player-components`
- Backwards compatibility with existing PIE deployments
- Dynamic element loading from PIE build service or CDN

**Loading Strategy**:

![IIFE Player Loading Strategy](img/iife-player-loading.png)

1. Receive item config → extract element versions
2. Fetch IIFE bundle from PIE build service
3. Execute IIFE to register elements globally
4. Render item markup with registered elements
5. Initialize models via controllers

**Key Features**:

- Dynamic bundle loading from PITS (PIE build service)
- CDN support with bundle hash
- Multiple environment support (prod, stage, dev)
- Hosted mode (server-side vs client-side controllers)

**Attributes**:

- `config` - Item configuration
- `env` - Environment (mode: gather/evaluate, role: student/instructor)
- `session` - Session data for responses
- `bundle-host` - PITS environment (prod/stage/dev)
- `use-cdn` - Use CDN instead of build service

See: [packages/iife-player/src/README.md](../packages/iife-player/src/README.md)

---

#### 2. ESM Player (`<pie-esm-player>`)

**Purpose**: Load PIE elements from modern ESM packages with view-based architecture.

**Use Cases**:

- Modern browsers with native ESM support
- Smaller bundle sizes (~85% reduction vs IIFE)
- Faster loading with import maps
- UI variant selection (mobile, accessibility, branding)

**Loading Strategy**:

![ESM Player Loading Strategy](img/esm-player-loading.png)

1. Receive item config → extract element packages
2. Generate import map for all PIE packages and requested views
3. Inject import map into document
4. Dynamic import() each package from the specified view subpath
5. Register custom elements with view-appropriate tag names
6. Render item markup with fallback support

**Key Features**:

- Pure ESM (no IIFE fallback)
- Import maps for dependency resolution
- Configurable CDN (esm.sh, jsDelivr)
- Smaller bundle size
- Modern browsers only (Chrome 89+, Firefox 108+, Safari 16.4+)
- **View-based loading**: Load different UI implementations (delivery, author, print, custom variants)
- **Automatic fallback**: Falls back to standard view if custom view unavailable
- **UI variant support**: Enable mobile-optimized, accessibility-focused, or branded UIs without duplicating elements

**View System**:

The ESM player supports loading different views/variants of elements:

```typescript
// Load standard delivery view
await esmLoader.load(config, document, {
  view: 'delivery',
  loadControllers: true
});

// Load author/configuration view
await esmLoader.load(config, document, {
  view: 'author',
  loadControllers: false
});

// Load custom mobile-optimized view with fallback
await esmLoader.load(config, document, {
  view: 'delivery-mobile',
  viewConfig: {
    subpath: '/delivery-mobile',
    tagSuffix: '',
    fallback: 'delivery'
  },
  loadControllers: true
});
```

**Built-in views**:

- `delivery` - Standard student/teacher interaction (root export, no suffix)
- `author` - Configuration UI (`/author` export, `-config` suffix)
- `print` - Print views (`/print` export, `-print` suffix)

**Custom views** (enabled by ESM subpath exports):

- `delivery-mobile` - Touch-optimized UI for tablets/phones
- `delivery-a11y` - Accessibility-optimized (screen readers, high contrast)
- `delivery-simple` - Simplified UI for younger students
- `delivery-branded` - Custom district branding
- Any subpath defined in element's package.json exports

**Benefits of view system**:

✅ **Shared controller logic** - All UI variants use the same scoring/validation
✅ **Consistent behavior** - Assessment results identical across all views
✅ **Easy maintenance** - Single codebase for business logic
✅ **Flexible deployment** - Users choose preferred UI without forking
✅ **Graceful degradation** - Automatic fallback to standard view

**Attributes**:

- `config` - Item configuration
- `env` - Environment
- `session` - Session data
- `mode` - View mode ('view' or 'author') - determines which view to load
- `esm-cdn-url` - ESM CDN base URL
- `esm-probe-timeout` - Package probe timeout

See: [packages/esm-player/src/README.md](../packages/esm-player/src/README.md)

---

##### 3. Fixed Player (`<pie-fixed-player>`)

**Purpose**: Ultra-portable player with all dependencies pre-bundled.

**Purpose**: Pre-bundled player with fixed element combinations (performance optimized).

**Use Cases**:

- Performance-critical deployments
- Fixed question type sets
- Reduced runtime overhead

**Loading Strategy**:

![Fixed Player Loading Strategy](img/fixed-player-loading.png)

1. Install npm package with pre-bundled elements
2. Import player (elements already bundled)
3. Render item with pre-registered elements
4. No runtime bundle fetching

**Key Features**:

- Zero runtime bundle loading
- Hash-based versioning (deterministic builds)
- Smaller API payload (data only, no bundles)
- Build-time element combination
- CI/CD publishing from in-repo configs

**Bundle Hash Format**:

```
@pie-framework/pie-fixed-player-static@{loader-version}-{element-hash}.{iteration}
Example: @pie-framework/pie-fixed-player-static@1.0.1-a3f8b2c.1
```

**Attributes**:

- `item-id` - Item identifier
- `api-base-url` - API endpoint for data-only response
- `token` - JWT authentication
- `env` - Environment

See: [packages/fixed-player/src/README.md](../packages/fixed-player/src/README.md)

---

#### Print Player

##### `<pie-print>` - Item-Level Print Rendering

**Purpose**: Render complete assessment items for print (paper tests, answer keys, PDF export).

**Package**: `@pie-player/print`

**Use Cases**:

- Paper-based assessments
- Teacher answer keys with rationales
- PDF exports for archival/compliance
- Print previews in content authoring systems

**Loading Strategy**:

1. Receive item config (markup + models + element map)
2. Parse markup to identify element types
3. Dynamically load print modules from CDN
4. Register print elements with hash-based unique names
5. Transform markup (replace interactive tags with print tags)
6. Apply model data to all elements
7. Render static print view

**Key Features**:

- Multi-element support (passage + questions + rubrics)
- Role-based rendering (student worksheets vs instructor answer keys)
- Markup transformation and floater handling
- Hash-based element naming (avoid conflicts)
- Graceful degradation for missing modules
- CDN verification before loading

**API Example**:

```html
<pie-print id="player"></pie-print>
<script>
  player.config = {
    item: {
      markup: '<passage id="p1"></passage><multiple-choice id="q1"></multiple-choice>',
      elements: {
        'passage': '@pie-element/passage@5.0.0',
        'multiple-choice': '@pie-element/multiple-choice@12.0.0'
      },
      models: [
        { id: 'p1', element: 'passage', text: '...' },
        { id: 'q1', element: 'multiple-choice', prompt: '...', choices: [...] }
      ]
    },
    options: { role: 'student' } // or 'instructor' for answer key
  };
</script>
```

**Architecture Note**: Print components are self-contained. Each element's print export handles its own transformations (`preparePrintModel`), role-based visibility, and rendering. The print player simply loads and orchestrates them.

See: [packages/print-player/README.md](../packages/print-player/README.md)

---

### Player Comparison

| Feature             | IIFE Player   | ESM Player  | Fixed Player | Print Player |
| ------------------- | ------------- | ----------- | ------------ | ------------ |
| **Bundle Format**   | IIFE          | ESM         | Pre-bundled  | ESM          |
| **Loading**         | Dynamic       | Dynamic     | Static       | Dynamic      |
| **Browser Support** | All           | Modern      | All          | Modern       |
| **Bundle Size**     | Large         | Small       | Smallest     | Small        |
| **Performance**     | Medium        | Medium      | Fast         | Fast         |
| **Interactivity**   | Yes           | Yes         | Yes          | No (static)  |
| **Use Case**        | Legacy compat | Modern apps | Performance  | Print/PDF    |

---

### Unified Authoring & Delivery

**New in this generation**: All players support both **delivery** (student/teacher views) and **authoring** (configuration) modes in a single package.

**Legacy**: Separate packages (`pie-player` for delivery, `pie-author` for authoring).

**Mode Switching**:

```html
<!-- Delivery Mode (Student View) -->
<pie-iife-player
  config={itemConfig}
  env={{ mode: 'gather', role: 'student' }}
></pie-iife-player>

<!-- Authoring Mode (Configure) -->
<pie-iife-player
  config={itemConfig}
  mode="author"
  configuration={configurationOptions}
  onmodel-updated={(e) => console.log('Model updated:', e.detail)}
></pie-iife-player>
```

**Benefits**:

- Single package to install and maintain
- Consistent API across modes
- Easier version management
- Reduced bundle duplication

See: [docs/AUTHORING_MODE.md](AUTHORING_MODE.md)

---

## Assessment Toolkit

The **Assessment Toolkit** provides composable services for coordinating tools, accommodations, and full test delivery. It's designed as a **toolkit, not a framework** — products use only what they need.

### Core Principles

1. **Composable Services** - Import only what you need
2. **No Framework Lock-in** - Works with any JavaScript framework
3. **Product Control** - Products control navigation, persistence, layout, backend
4. **Standard Contracts** - Well-defined event types for component communication
5. **QTI 3.0 Native** - Uses QTI 3.0 Personal Needs Profile (PNP) directly for accessibility accommodations

### QTI 3.0 Support

The toolkit natively supports **QTI 3.0** features for industry-standard assessment delivery:

#### Implemented Features

**1. Personal Needs Profile (PNP)** - Student accommodations and IEP/504 support

- Maps QTI 3.0 PNP support IDs to PIE tools (`textToSpeech` → `pie-tool-text-to-speech`)
- Resolves tool availability with precedence hierarchy (district block > item requirement > PNP)
- Supports district policies, test administration overrides, item-level requirements

```typescript
const assessment = {
  personalNeedsProfile: {
    supports: ['textToSpeech', 'calculator'],
    activateAtInit: ['textToSpeech']
  },
  settings: {
    districtPolicy: { blockedTools: [], requiredTools: ['ruler'] },
    toolConfigs: { calculator: { type: 'scientific', provider: 'desmos' } }
  }
};

const player = new AssessmentPlayer({ assessment, loadItem });
// Tools automatically resolved and configured
```

**2. Context Declarations** - Global variables shared across items

- Cross-item randomization (shared random seeds)
- Adaptive testing (difficulty adjustment based on performance)
- Shared configuration (currency symbols, measurement units)
- Item dependencies

```typescript
const assessment = {
  contextDeclarations: [
    { identifier: 'RANDOM_SEED', baseType: 'integer', defaultValue: 42 },
    { identifier: 'DIFFICULTY_LEVEL', baseType: 'string', defaultValue: 'medium' }
  ]
};

const player = new AssessmentPlayer({ assessment, loadItem });

// Access context variables
const seed = player.getContextVariable('RANDOM_SEED');
player.setContextVariable('DIFFICULTY_LEVEL', 'hard');

// Pass to PIE elements
const context = player.getContextVariables();
await renderItem(item, session, context);
```

#### Planned Features

**3. Accessibility Catalogs** (Phase 2) - Alternative content representations

- Pre-recorded TTS audio files
- Sign language videos
- Braille representations
- Simplified language versions

**4. Stimulus References** (Phase 3) - Shared passages/stimuli

- Reading comprehension passages
- Shared diagrams/images
- Split-view layouts
- Common scenarios

#### Benefits

- **Standards Compliant**: Uses QTI 3.0 directly (no custom abstractions)
- **Simpler Code**: 72% reduction in abstraction complexity
- **Easy Integration**: One-line initialization for full QTI 3.0 support
- **Third-Party Friendly**: All services work independently of AssessmentPlayer

### Toolkit Services

#### 1. ToolCoordinator

**Purpose**: Central service managing tool visibility and z-index layering.

**Key Methods**:

```typescript
toolCoordinator.registerTool(id, name, element);
toolCoordinator.showTool(id);
toolCoordinator.hideTool(id);
toolCoordinator.bringToFront(element);
toolCoordinator.isToolVisible(id);
```

**Z-Index Layers**:

![Z-Index Layers](img/z-index-layers.png)

```
0-999:     PIE content and player chrome
1000-1999: Non-modal tools (ruler, protractor, line reader)
2000-2999: Modal tools (calculator, dictionary)
3000-3999: Tool control handles (drag, resize)
4000-4999: Highlight infrastructure (TTS, annotations)
5000+:     Critical overlays (errors, notifications)
```

---

#### 2. HighlightCoordinator

**Purpose**: Manages text highlighting for TTS and annotations using CSS Custom Highlight API.

**The Problem**: Both TTS (temporary word highlighting) and student annotations (persistent highlighting) need to highlight text simultaneously without interfering.

**Technology**: CSS Custom Highlight API (Chrome 105+, Safari 17.2+, Firefox 128+)

**Key Methods**:

```typescript
// TTS highlights (temporary)
highlightCoordinator.highlightTTSWord(textNode, start, end);
highlightCoordinator.highlightTTSSentence(ranges);
highlightCoordinator.clearTTS();

// Annotation highlights (persistent)
highlightCoordinator.addAnnotation(range, color); // returns ID
highlightCoordinator.removeAnnotation(id);
```

**Benefits vs Traditional Approach**:

- Zero DOM mutation (preserves framework virtual DOM)
- Framework-compatible
- Screen reader friendly
- Multiple highlights overlap gracefully
- Better performance

---

#### 3. TTSService

**Purpose**: Singleton text-to-speech service with word highlighting synchronization.

**Key Features**:

- Read full question or selected text
- Pause, resume, stop playback
- Word-level highlighting synchronized with audio
- Voice selection and speed control
- State management (playing, paused, stopped)

**Provider Architecture**:

- **BrowserTTSProvider** - Web Speech API (implemented)
- **AWS Polly Provider** - Cloud-based neural voices (interface defined)

**Integration**:

```typescript
const ttsService = TTSService.getInstance();
await ttsService.initialize("browser");
ttsService.setHighlightCoordinator(highlightCoordinator);

await ttsService.speak("Read this text");
await ttsService.speakRange(selectedRange);

ttsService.pause();
ttsService.resume();
ttsService.stop();
```

---

#### 4. ThemeProvider

**Purpose**: Accessibility theming (color schemes, font sizes).

**Key Features**:

- High contrast modes
- Font size scaling
- Color scheme support
- CSS custom properties

**API**:

```typescript
themeProvider.applyTheme({
  highContrast: true,
  fontSize: "large",
  backgroundColor: "#000",
  foregroundColor: "#fff",
});

themeProvider.setHighContrast(true);
themeProvider.setFontSize("xlarge");
```

---

#### 5. ContextVariableStore

**Purpose**: QTI 3.0 Context Declarations for global variables shared across assessment items.

**Standalone Service**: Manages QTI 3.0 context variables independently of AssessmentPlayer.

**Key Features**:

- Global assessment-level variables
- Cross-item randomization (shared random seeds)
- Adaptive testing patterns (difficulty adjustment)
- Shared configuration values (currency symbols, units)
- Session persistence
- Type validation for QTI 3.0 base types

**API**:

```typescript
const store = new ContextVariableStore(declarations);

// Get/set variables
const seed = store.get('RANDOM_SEED');
store.set('DIFFICULTY_LEVEL', 'hard');

// Serialize for session persistence
const state = store.toObject();
store.fromObject(savedState);

// Reset to defaults
store.reset();
```

**Integration Example**:

```typescript
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

// Initialize store
const contextStore = new ContextVariableStore(assessment.contextDeclarations);

// Use in adaptive testing
function onItemCompleted(isCorrect: boolean) {
  if (isCorrect) {
    contextStore.set('DIFFICULTY_LEVEL', 'hard');
  } else {
    contextStore.set('DIFFICULTY_LEVEL', 'easy');
  }
}

// Pass to next item
const context = contextStore.toObject();
await renderItem(nextItem, session, context);
```

See: [QTI 3.0 Context Declarations Plan](qti-3-context-declarations-plan.md)

---

#### 6. PNPToolResolver

**Purpose**: QTI 3.0 Personal Needs Profile (PNP) tool resolution with precedence hierarchy.

**Native QTI 3.0 Support**: The toolkit uses QTI 3.0 PNP directly instead of custom profile abstractions.

**Precedence Hierarchy**:

```
District Block (absolute veto):
  "District policy blocks calculator"
      ↓
Test Administration Override:
  "Practice mode enables all tools"
      ↓
Item Restriction (per-item):
  "This question blocks calculator"
      ↓
Item Requirement (forces enable):
  "This question requires protractor"
      ↓
District Requirement:
  "District requires ruler for all tests"
      ↓
PNP Supports (student accommodations):
  "Student has TTS and calculator per IEP"
      ↓
Final Configuration:
  Protractor (required) + TTS (enabled) + Ruler (required)
  Calculator blocked by item restriction
```

**Precedence Rules**:

1. District block (absolute veto) — highest priority
2. Test administration override
3. Item restriction (per-item block)
4. Item requirement (forces enable)
5. District requirement
6. PNP supports (student needs)

**API**:

```typescript
const resolver = new PNPToolResolver();

// Resolve all tools from QTI 3.0 assessment
const tools = resolver.resolveTools(assessment, currentItemRef);

// Check if specific tool is enabled
const isEnabled = resolver.isToolEnabled('pie-tool-calculator', assessment, itemRef);

// Get auto-activate tools
const autoActivate = resolver.getAutoActivateTools(assessment);

// Get enabled tools
const enabled = resolver.getEnabledTools(assessment, itemRef);
```

**Resolved Tool Configuration**:

```typescript
interface ResolvedToolConfig {
  id: string;                     // PIE tool ID
  enabled: boolean;
  required?: boolean;             // Must be available
  alwaysAvailable?: boolean;      // PNP support (can't be toggled)
  settings?: any;                 // Tool-specific config
  source: 'district' | 'item' | 'pnp' | 'settings';
}
```

---

### Assessment Player (Reference Implementation)

The **Assessment Player** is a reference implementation showing how to wire toolkit services together for full test delivery.

![Assessment Player Example](img/schoolcity-1.png)

**Features**:

- Linear navigation through assessment items
- Event-driven architecture with TypedEventBus
- Session state management with subscriptions
- TTS integration via TTSService
- Theme support via ThemeProvider
- ToolCoordinator and HighlightCoordinator integration
- Product-specific callbacks for customization

**Integration Pattern**:

```typescript
import {
  TypedEventBus,
  ToolCoordinator,
  HighlightCoordinator,
  TTSService,
  ThemeProvider,
  PNPToolResolver,
} from "@pie-framework/assessment-toolkit";

// Initialize services
const eventBus = new TypedEventBus();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const ttsService = TTSService.getInstance();
const themeProvider = new ThemeProvider();
const pnpResolver = new PNPToolResolver();

// Resolve tools from QTI 3.0 assessment
const tools = pnpResolver.resolveTools(assessment, currentItemRef);

// Register tools with coordinator
tools.forEach(tool => {
  if (tool.enabled) {
    toolCoordinator.registerTool(tool.id, humanizeName(tool.id));
  }
});

// Wire up events
eventBus.on("player:session-changed", async (e) => {
  await myBackend.saveSession(e.detail);
});

eventBus.on("tool:activated", (e) => {
  toolCoordinator.bringToFront(e.target);
});
```

See: [packages/assessment-toolkit/src/README.md](../packages/assessment-toolkit/src/README.md)

---

## Tools & Accommodations

The toolkit includes a set of **accessibility accommodations** and **assessment tools** (calculator, ruler, protractor, line reader, magnifier, TTS, highlighting, etc.) implemented as Web Components and coordinated via shared services (ToolCoordinator, HighlightCoordinator, TTSService, ThemeProvider).

**Canonical docs:**

- [Tools & Accommodations Architecture](tools-and-accomodations/architecture.md)
- [Tool development & integration](../packages/assessment-toolkit/src/tools/README.md)
- [Calculator providers](../packages/assessment-toolkit/src/tools/calculators/README.md)

---

## Question Layout Engine

The Question Layout Engine defines how assessment UI is composed (template selection, responsive layout, slots for passage/item/tools) while keeping navigation/state/persistence in a separate session layer.

**Canonical doc:**

- [Question Layout Engine Architecture](question-layout-engine-architecture.md)

---

## Math Rendering

PIE players use a **pluggable, programmatic math rendering system** that allows switching between MathJax, KaTeX, or custom renderers without code changes.

### Architecture

- **Provider pattern**: Global `mathRendererProvider` manages the active renderer
- **Unified interface**: `MathRenderer = (element: HTMLElement) => void | Promise<void>`
- **Factory functions**: `createMathjaxRenderer()`, `createKatexRenderer()`
- **Type-safe**: No string-based configuration, compile-time checking

### Usage

```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

// Set renderer before loading PIE elements
const renderer = await createKatexRenderer();
setMathRenderer(renderer);

// PIE elements now use KaTeX for math rendering
```

### Available Renderers

| Renderer | Bundle Size | Speed | Use Case |
|----------|-------------|-------|----------|
| **MathJax** (default) | ~2.7MB | Slower | Full LaTeX/MathML, accessibility |
| **KaTeX** | ~100KB | ~100x faster | Performance, smaller bundles |
| **Custom** | Varies | Varies | Specialized rendering needs |

### Packages

- `@pie-players/math-renderer-core` - Core types and provider
- `@pie-players/math-renderer-mathjax` - MathJax adapter
- `@pie-players/math-renderer-katex` - KaTeX adapter

**Canonical doc:**

- [Math Renderer Architecture](../MATH-RENDERER-ARCHITECTURE.md)

---

## Technology Stack

### Core Technologies

**Bun**

- Fast all-in-one toolkit
- Package manager, bundler, runtime
- TypeScript support out of the box

**TypeScript**

- Type-safe development
- Enhanced IDE support
- Better refactoring

**Svelte 5**

- Reactive UI framework with runes
- Compiles to efficient vanilla JavaScript
- Small bundle size (~3KB per component)
- Runes: `$state`, `$derived`, `$effect`

**Turbo**

- High-performance build system
- Monorepo task orchestration
- Caching and parallelization

**Vite**

- Lightning-fast dev server
- Modern bundler
- HMR (Hot Module Replacement)

### Web Standards

**Web Components (Custom Elements)**

- Framework-agnostic standard
- Native browser support
- Encapsulation with shadow DOM (optional)

**CSS Custom Highlight API**

- Native highlighting without DOM mutation
- Multiple overlapping highlights
- Screen reader compatible
- Chrome 105+, Safari 17.2+, Firefox 128+

**Web Speech API**

- Browser-native text-to-speech
- Voice selection and rate control
- Word boundary events for highlighting

**CSS Container Queries**

- Responsive tool layouts
- Component-level responsive design
- Chrome 105+, Safari 16+, Firefox 110+

### Supporting Libraries

**Moveable.js**

- Drag, rotate, resize functionality
- Used by ruler and protractor tools
- Keyboard navigation support

**Desmos API**

- Graphing calculator integration
- Scientific calculator modes
- LaTeX math expression support

**Math.js**

- Open source calculator engine
- Apache 2.0 license (free)
- Scientific functions

### Browser Support

**Target**: Modern evergreen browsers

**Coverage**: ~85% global browser market (2025)

**Fallback Strategy**: Graceful degradation for advanced features

---

## Integration Patterns

### Pattern 1: Standalone Item Player

Use a single item player for rendering individual questions:

```html
<script type="module">
  import '@pie-framework/pie-iife-player'
</script>

<pie-iife-player
  config={itemConfig}
  env={{ mode: 'gather', role: 'student' }}
  session={{ id: 'session-123', data: [] }}
></pie-iife-player>
```

### Pattern 2: Item Player + Tools

Add assessment tools to item player:

```typescript
import { ToolCoordinator } from "@pie-framework/assessment-toolkit";
import "@pie-framework/pie-tool-calculator";

const toolCoordinator = new ToolCoordinator();

// Register calculator
toolCoordinator.registerTool("calculator", "Calculator", calcElement);

// Show calculator
toolCoordinator.showTool("calculator");
```

### Pattern 3: Full Assessment (Toolkit)

Use assessment toolkit for complete test delivery with QTI 3.0 support:

```typescript
import {
  AssessmentPlayer,
  PNPToolResolver,
  ContextVariableStore,
  TypedEventBus,
  ToolCoordinator,
  HighlightCoordinator,
  TTSService,
  ThemeProvider,
} from "@pie-framework/assessment-toolkit";

// QTI 3.0 assessment with PNP and Context Declarations
const assessment = {
  id: 'test-assessment',
  personalNeedsProfile: {
    supports: ['calculator', 'textToSpeech'],
    activateAtInit: ['textToSpeech']
  },
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
  ],
  settings: {
    districtPolicy: {
      blockedTools: [],
      requiredTools: []
    },
    toolConfigs: {
      calculator: { type: 'scientific', provider: 'desmos' }
    }
  }
};

// Simple initialization - framework handles everything
const player = new AssessmentPlayer({
  assessment,
  loadItem: async (itemId) => {
    const item = await fetchItem(itemId);
    return item;
  }
});

// Access QTI 3.0 features
const tools = player.getAvailableTools();
const context = player.getContextVariables();
player.setContextVariable('DIFFICULTY_LEVEL', 'hard');

// Or use services directly for custom players
const eventBus = new TypedEventBus();
const pnpResolver = new PNPToolResolver();
const contextStore = new ContextVariableStore(assessment.contextDeclarations);

const tools = pnpResolver.resolveTools(assessment);
const seed = contextStore.get('RANDOM_SEED');

// Wire up events
eventBus.on("player:session-changed", async (e) => {
  await backend.saveSession(e.detail);
});
```

**See complete examples:** [QTI 3.0 Features Client Guide](qti-3-features-client-guide.md)

### Pattern 4: Custom Assessment Player

Build your own assessment player using toolkit services:

```typescript
class CustomAssessmentPlayer {
  private eventBus = new TypedEventBus();
  private toolCoordinator = new ToolCoordinator();

  constructor() {
    this.setupEventHandlers();
    this.setupNavigation();
    this.setupPersistence();
  }

  private setupEventHandlers() {
    this.eventBus.on("player:session-changed", async (e) => {
      await this.saveToBackend(e.detail);
    });
  }

  private setupNavigation() {
    // Custom navigation logic
  }

  private setupPersistence() {
    // Custom persistence logic
  }
}
```

---

## References

### Documentation

- [Authoring Mode Guide](AUTHORING_MODE.md) - Complete authoring documentation
- [Question Layout Engine Architecture](question-layout-engine-architecture.md) - Layout system design
- [Tools & Accommodations Architecture](tools-and-accomodations/architecture.md) - Tools system design
- [Assessment Toolkit README](../packages/assessment-toolkit/src/README.md) - Toolkit usage and QTI 3.0 examples
- [Tools README](../packages/assessment-toolkit/src/tools/README.md) - Tool development guide

### Standards & Specifications

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [QTI Specification](http://www.imsglobal.org/question/index.html)

### PIE Framework

- [PIE Documentation](https://pie-api.readme.io/)
- [PIE Elements](https://github.com/pie-framework/pie-elements)
- [PIE Examples](https://github.com/pie-framework/pie-examples)

---

## Conclusion

The **PIE Players** architecture provides a comprehensive, modern foundation for rendering PIE assessment content. The system is organized into three major areas:

1. **Item Players** - Multiple player types (IIFE, ESM, Fixed) for different deployment scenarios
2. **Assessment Toolkit** - Composable services for full test delivery with tools and accommodations
3. **Tools & Accommodations** - 15+ assessment tools with WCAG 2.2 AA compliance

By leveraging modern web standards (Web Components, CSS Custom Highlight API) and maintaining framework independence, the architecture ensures long-term maintainability, excellent performance, and broad compatibility.

The toolkit approach (vs framework) gives products maximum flexibility while providing battle-tested reference implementations for common scenarios.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-09
**Maintainers**: PIE Framework Team
