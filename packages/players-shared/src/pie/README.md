# PIE Utilities Module

Modular, tree-shakeable utilities for PIE (Portable Item Editor) element loading and management.

## Module Structure

```text
pie/
├── types.ts          - Type definitions, interfaces, enums (pure types, no runtime code)
├── registry.ts       - Global PIE registry management
├── utils.ts          - URL building, package parsing, session utilities
├── config.ts         - Config manipulation (makeUniqueTags, addRubricIfNeeded, etc.)
├── scoring.ts        - Scoring and controller lookup
├── updates.ts        - Element update functions
├── initialization.ts - Bundle loading and element initialization
├── logger.ts         - Logging utility with debug/info/warn/error levels
├── index.ts          - Barrel export (backward compatibility)
└── README.md         - This file
```

## Usage

### For Maximum Tree-Shaking (Recommended)

Import directly from specific modules:

```typescript
// Only types (zero runtime code)
import { BundleType } from './types';
import type { LoadPieElementsOptions } from './types';

// Config utilities
import { makeUniqueTags } from './config';

// Initialization
import { initializePiesFromLoadedBundle } from './initialization';

// Updates
import { updatePieElements } from './updates';
```

**Benefits**:

- Bundler only includes the modules you actually use
- Better code splitting
- 15-20% smaller bundle sizes

### Backward Compatible (Convenience)

Import from barrel export:

```typescript
import { 
  BundleType, 
  makeUniqueTags, 
  initializePiesFromLoadedBundle 
} from './index';
```

**Trade-off**: May include slightly more code than necessary, but still tree-shakeable.

## Module Dependencies

```text
types.ts (no dependencies)
  ↑
  ├─ registry.ts
  ├─ utils.ts
  └─ config.ts ← utils.ts
      ↑
      ├─ scoring.ts ← registry.ts, utils.ts
      ├─ updates.ts ← utils.ts, scoring.ts
      └─ initialization.ts ← registry.ts, utils.ts, scoring.ts, updates.ts
```

**Design principle**: Unidirectional dependencies, no circular imports.

## Key Concepts

### Bundle Types

```typescript
enum BundleType {
  player = 'player.js',           // Elements only (no controllers)
  clientPlayer = 'client-player.js',  // Elements + controllers
  editor = 'editor.js'            // Editor UI
}
```

- **`player.js`**: Server-side controller processing, client receives pre-filtered models
- **`client-player.js`**: Client-side controller processing (legacy, used for development)
- **`editor.js`**: Authoring UI (not used by players)

### Registry

The PIE registry (`window.PIE_REGISTRY`) tracks all loaded PIE elements:

```typescript
interface Entry {
  package: string;        // e.g., "@pie-element/multiple-choice@9.9.1"
  status: Status;         // 'loading' | 'loaded'
  tagName: string;        // e.g., "multiple-choice--version-9-9-1"
  controller?: PieController;  // May be null for player.js bundles
  config?: Element;
  element?: Element;
  bundleType?: BundleType;
}
```

### Unique Tags

PIE uses versioned tag names to allow multiple versions side-by-side:

```typescript
// Input: <multiple-choice id="1"></multiple-choice>
// Output: <multiple-choice--version-9-9-1 id="1"></multiple-choice--version-9-9-1>
```

This is necessary because custom elements can't be redefined once registered.

## Logging

Simple logging with debug mode:

```typescript
import { createPieLogger } from './logger';

// Create logger
const logger = createPieLogger('my-component', debug);

// Use log levels (debug only shown if debug=true)
logger.debug('Detailed info', data);    // Debug only
logger.info('✅ Success message');       // Always shown
logger.warn('⚠️ Warning');               // Always shown
logger.error('❌ Error', error);         // Always shown
```

**Player tags** accept a `debug` prop:

```html
<pie-fixed-player debug={true} config={...} />
```

**Runtime debugging** via global flag:

```javascript
window.PIE_DEBUG = true;  // In browser console
```

## Common Tasks

### Load PIE Bundle from URL

```typescript
import { loadPieModule } from './initialization';

await loadPieModule(config, session, {
  bundleType: BundleType.player,
  env: { mode: 'gather', role: 'student' }
});
```

### Load PIE Bundle from String

```typescript
import { loadBundleFromString, initializePiesFromLoadedBundle } from './initialization';

// 1. Load bundle into window.pie
await loadBundleFromString(bundleJs);

// 2. Initialize elements
initializePiesFromLoadedBundle(config, session, {
  bundleType: BundleType.player,
  env: { mode: 'gather', role: 'student' }
});
```

### Update PIE Elements

```typescript
import { updatePieElements } from './updates';

updatePieElements(config, session, env);
```

### Make Tags Unique (Versioned)

```typescript
import { makeUniqueTags } from './config';

const transformedItem = makeUniqueTags({ config: item.config });
```

### Find Controller for Scoring

```typescript
import { findPieController } from './scoring';

const controller = findPieController('multiple-choice--version-9-9-1');
if (controller) {
  const outcome = await controller.outcome(session, env);
}
```
