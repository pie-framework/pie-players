# Tool Provider System

**Status**: ✅ Complete - Core system and toolbar implemented

This guide covers the unified Tool Provider System for managing assessment tools with authentication, configuration, and lifecycle management.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Usage Examples](#usage-examples)
- [Implemented Providers](#implemented-providers)
- [Backend Integration](#backend-integration)
- [Configuration Guide](#configuration-guide)
- [Section Tools Toolbar](#section-tools-toolbar)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### What We Built

A unified framework for managing assessment tools with authentication:

- ✅ **DesmosToolProvider** - Desmos calculators with secure API key handling
- ✅ **TIToolProvider** - TI calculator emulators (TI-84, TI-108, TI-34 MV)
- ✅ **TTSToolProvider** - Text-to-speech (Browser, AWS Polly, Google Cloud)
- ✅ **ToolProviderRegistry** - Centralized provider management with lazy loading
- ✅ **ToolkitCoordinator integration** - Seamless integration with existing toolkit
- ✅ **Section Tools Toolbar** - Visual toolbar for section player with 7 tools

### Quick Examples

#### Example 1: Browser TTS (No Auth)

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo',
  tools: {
    providers: {
      tts: {
        enabled: true,
        backend: 'browser', // Uses Web Speech API - no auth needed!
      },
    }
  },
});
```

#### Example 2: Desmos Calculator (With Auth)

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo',
  tools: {
    providers: {
      calculator: {
        provider: 'desmos',
        authFetcher: async () => {
          // Fetch API key securely from your backend
          const res = await fetch('/api/tools/desmos/token');
          return res.json(); // { apiKey: '...' }
        },
      },
    },
    placement: {
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
    }
  },
});
```

#### Example 3: Google TTS (With Auth)

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo',
  tools: {
    providers: {
      tts: {
        backend: 'google',
        apiEndpoint: '/api/tts/synthesize',
        authFetcher: async () => {
          const res = await fetch('/api/tools/tts/google/token');
          return res.json(); // { authToken: '...' }
        },
      },
    }
  },
});
```

### Backend Setup

Create API endpoints to provide auth credentials:

```typescript
// Express.js example
app.get('/api/tools/desmos/token', requireAuth, (req, res) => {
  res.json({
    apiKey: process.env.DESMOS_API_KEY,
    expiresIn: 3600,
  });
});

app.get('/api/tools/tts/google/token', requireAuth, (req, res) => {
  res.json({
    authToken: generateGoogleToken(), // Your implementation
    apiEndpoint: process.env.GOOGLE_TTS_ENDPOINT,
  });
});
```

---

## Overview

The Tool Provider System provides a unified framework for managing assessment tools that require:

- **Authentication/API keys** (Desmos, AWS Polly, Google TTS)
- **External services** (TTS, calculators, translation APIs)
- **Lifecycle management** (initialization, lazy loading, cleanup)
- **Configuration** (per-provider settings)

### Key Benefits

✅ **Secure by default** - API keys fetched from backend, never exposed client-side
✅ **Lazy initialization** - Providers only load when needed
✅ **Unified pattern** - Consistent interface for all tools
✅ **Production-ready** - Clear separation between dev and prod modes
✅ **Pluggable** - Easy to add new providers

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ToolkitCoordinator                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │           ToolProviderRegistry                    │  │
│  │  - Manages all tool providers                     │  │
│  │  - Handles auth/config                            │  │
│  │  - Lazy initialization                            │  │
│  └───────────────────────────────────────────────────┘  │
│                        │                                 │
│         ┌──────────────┼──────────────┐                 │
│         │              │               │                 │
│    ┌────▼────┐   ┌────▼────┐    ┌────▼────┐           │
│    │  TTS    │   │Calculator│    │  Other  │           │
│    │Provider │   │ Provider │    │Providers│           │
│    └─────────┘   └──────────┘    └─────────┘           │
│         │              │               │                 │
│    ┌────▼────┐   ┌────▼────┐    ┌────▼────┐           │
│    │Browser  │   │ Desmos  │    │ Google  │           │
│    │ Polly   │   │   TI    │    │   ...   │           │
│    │ Google  │   │ Math.js │    │         │           │
│    └─────────┘   └─────────┘    └─────────┘           │
└─────────────────────────────────────────────────────────┘
```

### Flow Diagram

```
User Configuration
       │
       ▼
ToolkitCoordinator
       │
       ├─→ ToolProviderRegistry.register()
       │   ├─→ Store provider + config
       │   └─→ Mark as lazy (or initialize immediately)
       │
       ▼
First Tool Use
       │
       ├─→ ToolProviderRegistry.getProvider()
       │   ├─→ Check if initialized
       │   ├─→ If not: call authFetcher() [if needed]
       │   ├─→ provider.initialize(config)
       │   └─→ Mark as initialized
       │
       ▼
provider.createInstance()
       │
       ▼
Tool Ready for Use
```

---

## Core Components

### 1. IToolProvider Interface

**Location**: `packages/assessment-toolkit/src/services/tool-providers/IToolProvider.ts`

Base interface for all tool providers:

```typescript
interface IToolProvider<TConfig, TInstance> {
  readonly providerId: string;
  readonly providerName: string;
  readonly category: ToolCategory;
  readonly version: string;
  readonly requiresAuth: boolean;

  initialize(config: TConfig): Promise<void>;
  createInstance(config?: Partial<TConfig>): Promise<TInstance>;
  getCapabilities(): ToolProviderCapabilities;
  isReady(): boolean;
  destroy(): void;
}
```

**Key Features**:
- Generic types for config and instance
- Auth flag for secure credential handling
- Lifecycle methods (initialize, destroy)
- Capabilities descriptor

### 2. ToolProviderRegistry

**Location**: `packages/assessment-toolkit/src/services/tool-providers/ToolProviderRegistry.ts`

Centralized registry for managing providers:

```typescript
class ToolProviderRegistry {
  register(providerId: string, config: ToolProviderConfig): void;
  async getProvider<T>(providerId: string): Promise<T>;
  has(providerId: string): boolean;
  isInitialized(providerId: string): boolean;
  async destroy(): Promise<void>;
}
```

**Key Features**:
- Lazy initialization
- Auth fetching via `authFetcher` callback
- Concurrent initialization protection
- Category-based lookup

### 3. ToolkitCoordinator Integration

**Location**: `packages/assessment-toolkit/src/services/ToolkitCoordinator.ts`

The coordinator now includes `ToolProviderRegistry` in its service bundle:

```typescript
interface ToolkitServiceBundle {
  ttsService: TTSService;
  toolCoordinator: ToolCoordinator;
  highlightCoordinator: HighlightCoordinator;
  elementToolStateStore: ElementToolStateStore;
  catalogResolver: AccessibilityCatalogResolver;
  toolProviderRegistry: ToolProviderRegistry; // NEW
}
```

---

## Usage Examples

### Basic Setup (Browser TTS - No Auth)

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    providers: {
      tts: {
        enabled: true,
        backend: 'browser', // No auth needed
      },
    }
  },
});
```

### Advanced Setup (Google TTS with Auth)

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    providers: {
      tts: {
        enabled: true,
        backend: 'google',
        apiEndpoint: '/api/tts/synthesize',
        authFetcher: async () => {
          // Fetch credentials from backend
          const response = await fetch('/api/tools/tts/google/token');
          return response.json(); // { authToken: '...' }
        },
      },
    }
  },
});
```

### Desmos Calculator with Proxy

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    providers: {
      calculator: {
        enabled: true,
        provider: 'desmos',
        authFetcher: async () => {
          const response = await fetch('/api/tools/desmos/token');
          return response.json(); // { apiKey: '...' }
        },
      },
    },
    placement: {
      section: ['calculator', 'graph', 'periodicTable'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
    }
  },
});
```

### Accessing Providers Directly

```typescript
// Get TTS provider
const ttsProvider = await coordinator.getToolProvider('tts');
const ttsInstance = await ttsProvider.createInstance();

// Get Desmos calculator provider
const desmosProvider = await coordinator.getToolProvider('calculator-desmos');
const calculatorProvider = await desmosProvider.createInstance();

// Create a calculator
const container = document.getElementById('calculator-container');
const calculator = await calculatorProvider.createCalculator(
  'scientific',
  container
);
```

---

## Implemented Providers

### 1. TTSToolProvider

**Category**: `tts`
**Requires Auth**: Browser=No, Polly/Google=Yes
**Location**: `packages/assessment-toolkit/src/services/tool-providers/TTSToolProvider.ts`

**Supported Backends**:
- `browser` - Web Speech API (no auth)
- `polly` - AWS Polly (requires auth)
- `google` - Google Cloud TTS (requires auth)
- `server` - Generic server backend

**Configuration**:
```typescript
interface TTSToolProviderConfig {
  backend: 'browser' | 'polly' | 'google' | 'server';
  apiEndpoint?: string; // For server backends
  authToken?: string; // Fetched via authFetcher
  voice?: string;
  rate?: number; // 0.25 to 4.0
  pitch?: number; // 0 to 2 (browser only)
}
```

**Example**:
```typescript
tools: {
  providers: {
    tts: {
      enabled: true,
      backend: 'google',
      apiEndpoint: '/api/tts/synthesize',
      defaultVoice: 'en-US-Neural2-A',
      rate: 1.0,
      authFetcher: async () => {
        const res = await fetch('/api/tools/tts/google/token');
        return res.json();
      },
    },
  }
}
```

### 2. DesmosToolProvider

**Category**: `calculator`
**Requires Auth**: Yes
**Location**: `packages/assessment-toolkit/src/services/tool-providers/DesmosToolProvider.ts`

**Supported Calculators**:
- Basic (four-function)
- Scientific
- Graphing

**Configuration**:
```typescript
interface DesmosToolProviderConfig {
  apiKey?: string; // DEVELOPMENT ONLY - never expose in production!
  proxyEndpoint?: string; // PRODUCTION - backend handles API key
  defaultConfig?: DesmosCalculatorConfig;
}
```

**Example (Development)**:
```typescript
tools: {
  providers: {
    calculator: {
      provider: 'desmos',
      authFetcher: async () => ({
        apiKey: 'your-dev-api-key', // Only for local testing!
      }),
    },
  }
}
```

**Example (Production)**:
```typescript
tools: {
  providers: {
    calculator: {
      provider: 'desmos',
      authFetcher: async () => {
        const res = await fetch('/api/tools/desmos/token');
        return res.json(); // { apiKey: '...' }
      },
    },
  }
}
```

### 3. TIToolProvider

**Category**: `calculator`
**Requires Auth**: No (but requires licensed TI emulator libraries)
**Location**: `packages/assessment-toolkit/src/services/tool-providers/TIToolProvider.ts`

**Supported Calculators**:
- TI-84 Plus CE
- TI-108
- TI-34 MultiView

**Configuration**:
```typescript
interface TIToolProviderConfig {
  libraryBaseUrl?: string; // Default: '/lib/ti'
  version?: string; // Default: 'v2.8.0'
  restrictedMode?: boolean; // Test mode
}
```

**Example**:
```typescript
tools: {
  providers: {
    calculator: {
      provider: 'ti',
      // No authFetcher needed - uses local libraries
    },
  }
}
```

**Note**: TI calculators require licensed emulator libraries hosted at `/lib/ti/{version}/`. Contact Texas Instruments for licensing.

---

## Backend Integration

The tool provider system requires backend API endpoints to securely provide authentication credentials.

### API Endpoint Structure

```
/api/tools/
  ├── desmos/token       # Desmos API key
  ├── tts/
  │   ├── polly/token    # AWS Polly credentials
  │   └── google/token   # Google TTS credentials
  └── ...
```

### Example: Desmos Token Endpoint

```typescript
// Express.js example
app.get('/api/tools/desmos/token', requireAuth, async (req, res) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.DESMOS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Desmos API key not configured'
      });
    }

    res.json({
      apiKey,
      expiresIn: 3600, // Optional: token expiration in seconds
    });
  } catch (error) {
    console.error('Failed to generate Desmos token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});
```

### Example: Google TTS Token Endpoint

```typescript
app.get('/api/tools/tts/google/token', requireAuth, async (req, res) => {
  try {
    // Generate temporary credentials or signed URL
    const authToken = await generateGoogleTTSToken();

    res.json({
      authToken,
      apiEndpoint: process.env.GOOGLE_TTS_ENDPOINT,
      expiresIn: 3600,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate TTS token' });
  }
});
```

### Security Best Practices

1. **Never expose API keys in client code**
   - Use `authFetcher` to retrieve from backend
   - Store keys in environment variables or secrets manager

2. **Require authentication**
   - Only authenticated users should access token endpoints
   - Implement rate limiting

3. **Use short-lived tokens**
   - Return `expiresIn` with token
   - Implement token refresh logic

4. **Log access**
   - Track which users request which tools
   - Monitor for abuse

---

## Configuration Guide

### Full Configuration Example

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',

  tools: {
    providers: {
      // TTS Configuration
      tts: {
        enabled: true,
        backend: 'google', // 'browser' | 'polly' | 'google' | 'server'
        apiEndpoint: '/api/tts/synthesize',
        defaultVoice: 'en-US-Neural2-C',
        rate: 1.0,
        pitch: 1.0,
        authFetcher: async () => {
          const res = await fetch('/api/tools/tts/google/token');
          return res.json();
        },
      },

      // Calculator provider
      calculator: {
        enabled: true,
        provider: 'desmos', // 'desmos' | 'ti' | 'mathjs'
        authFetcher: async () => {
          const res = await fetch('/api/tools/desmos/token');
          return res.json();
        },
      },
    },
    placement: {
      section: [
        'calculator',
        'graph',
        'periodicTable',
        'protractor',
        'lineReader',
        'ruler',
      ],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
    },
    policy: {
      blocked: [],
    }
  },

  // Accessibility Configuration
  accessibility: {
    catalogs: [], // QTI 3.0 accessibility catalogs
    language: 'en-US',
  },
});

// Use in section player
sectionPlayer.toolkitCoordinator = coordinator;
```

### Environment Variables

Recommended environment variables for backend:

```bash
# Desmos Calculator
DESMOS_API_KEY=your-desmos-api-key

# AWS Polly TTS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Google Cloud TTS
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_TTS_ENDPOINT=https://texttospeech.googleapis.com/v1

# Application
NODE_ENV=production
```

---

## Section Tools Toolbar

The Section Tools Toolbar provides a SchoolCity-style visual interface for accessing assessment tools. It's implemented as a web component that integrates with the Tool Provider System.

### Features

- **7 Tools Available**:
  - Calculator (Math.js-based, simple calculator)
  - Graph (Interactive graphing tool with drawing)
  - Periodic Table (Full periodic table with element details)
  - Protractor (Angle measurement overlay)
  - Line Reader (Reading guide overlay)
  - Magnifier (Text magnification tool)
  - Ruler (Measurement ruler)

- **SchoolCity Pattern**: Bottom toolbar, independent of passage/question panels
- **Floating Overlays**: Tools appear as draggable floating windows
- **Z-Index Management**: ToolCoordinator manages layering (toolbar: 100, tools: 1000-1999, modals: 2000-2999)
- **State Management**: Integrated with assessment toolkit

### Setup

The toolbar is automatically included in section player layouts when tools are enabled:

```typescript
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    placement: {
      section: ['calculator', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech'],
    },
    providers: {
      calculator: { provider: 'desmos' },
      tts: { backend: 'browser' },
    },
  },
});

sectionPlayer.toolkitCoordinator = coordinator;
```

### Package Structure

- **`@pie-players/pie-toolbars`** - Main toolbar custom elements
- **Individual tool packages**:
  - `@pie-players/pie-tool-calculator`
  - `@pie-players/pie-tool-graph`
  - `@pie-players/pie-tool-periodic-table`
  - `@pie-players/pie-tool-protractor`
  - `@pie-players/pie-tool-line-reader`
  - `@pie-players/pie-tool-ruler`

### Implementation Files

- **Toolbar Component**: `packages/toolbars/section-toolbar.svelte`
- **Layout Integration**:
  - `packages/section-player/src/components/PieSectionPlayerSplitPaneElement.svelte`
- **Player Integration**: `packages/section-player/src/components/PieSectionPlayerSplitPaneElement.svelte`
- **Demo**: `apps/section-demos/src/routes/demo/[[id]]/+page.svelte`

### Implementation Status

- ✅ Core tool provider system
- ✅ DesmosToolProvider with auth
- ✅ TIToolProvider
- ✅ TTSToolProvider (Browser, Polly, Google)
- ✅ ToolProviderRegistry with lazy loading
- ✅ ToolkitCoordinator integration
- ✅ Section tools toolbar component
- ✅ Section splitpane layout updates
- ✅ Demo backend API
- ✅ Demo frontend implementation
- ✅ Documentation

---

## API Reference

### ToolkitCoordinator

```typescript
class ToolkitCoordinator {
  readonly toolProviderRegistry: ToolProviderRegistry;

  constructor(config: ToolkitCoordinatorConfig);

  getServiceBundle(): ToolkitServiceBundle;
  async getToolProvider(providerId: string): Promise<IToolProvider>;
  isToolEnabled(toolId: string): boolean;
}
```

### ToolProviderRegistry

```typescript
class ToolProviderRegistry {
  register(providerId: string, config: ToolProviderConfig): void;
  async getProvider<T>(providerId: string): Promise<T>;
  async initialize(providerId: string): Promise<void>;

  has(providerId: string): boolean;
  isInitialized(providerId: string): boolean;
  isInitializing(providerId: string): boolean;

  getProviderIds(): string[];
  getProvidersByCategory(category: ToolCategory): string[];

  async unregister(providerId: string): Promise<void>;
  async destroy(): Promise<void>;
}
```

### IToolProvider

```typescript
interface IToolProvider<TConfig, TInstance> {
  readonly providerId: string;
  readonly providerName: string;
  readonly category: ToolCategory;
  readonly version: string;
  readonly requiresAuth: boolean;

  initialize(config: TConfig): Promise<void>;
  createInstance(config?: Partial<TConfig>): Promise<TInstance>;
  getCapabilities(): ToolProviderCapabilities;
  isReady(): boolean;
  destroy(): void;
}
```

---

## Troubleshooting

### Provider Not Initializing

**Problem**: Provider remains uninitialized after calling `getProvider()`

**Solution**:
- Check that `authFetcher` is provided if `requiresAuth: true`
- Verify backend endpoint is accessible
- Check browser console for initialization errors

### API Key Errors

**Problem**: "API key not found" or "Unauthorized"

**Solution**:
- Verify environment variables are set on backend
- Check that backend endpoint returns correct JSON structure
- Ensure user is authenticated before calling token endpoints

### Type Errors

**Problem**: TypeScript errors about missing packages

**Solution**:
- Build all packages: `bun run build`
- Install missing dependencies
- Check package.json for correct versions

---

## Resources

- [PIE Assessment Toolkit](../packages/assessment-toolkit/)
- [Tool Packages](../packages/)
- [Desmos API Documentation](https://www.desmos.com/api)
- [TI Calculator Libraries](https://education.ti.com/en/software/details/en/6633925F99D811E99C250ED5F7C4A6AC/ti-smartview-ce-emulator-software-for-the-ti-84-plus-graphing-family)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

---

**Last Updated**: February 2026
**Version**: 1.0.0
**Status**: Complete
