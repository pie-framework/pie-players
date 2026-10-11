# PIE Utilities Module

Utilities for loading PIE elements and binding them to their models and
sessions, exported as `@pie-players/pie-players-shared/pie`. PIE stands for
Portable Interactions and Elements. For maintainers of the player packages, and
for hosts that drive PIE elements without a player.

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
├── initialize-element.ts - Binding one element to its model and session
├── element-observer.ts   - Per-container binding of late-arriving elements
├── logger.ts         - Logging utility with debug/info/warn/error levels
├── index.ts          - Barrel re-export
└── README.md         - This file
```

## Imports

Other packages import the barrel, `@pie-players/pie-players-shared/pie`; the
only other `pie/*` path the package exports is `pie/tag-names`. The barrel is
tree-shakeable, because the package declares no side effects outside its
vendored icon button bundle:

```typescript
import {
  BundleType,
  makeUniqueTags,
  initializePiesFromLoadedBundle,
} from "@pie-players/pie-players-shared/pie";
```

Code inside `@pie-players/pie-players-shared` imports the module that defines a
name, which keeps the dependency graph below explicit:

```typescript
import { BundleType } from "./types.js";
import type { LoadPieElementsOptions } from "./types.js";
import { makeUniqueTags } from "./config.js";
import { initializePiesFromLoadedBundle } from "./initialization.js";
import { updatePieElements } from "./updates.js";
```

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
      ├─ initialize-element.ts ← registry.ts, utils.ts, scoring.ts
      ├─ element-observer.ts ← registry.ts, initialize-element.ts
      └─ initialization.ts ← registry.ts, utils.ts, updates.ts, initialize-element.ts
```

Dependencies run one way, and no module imports another in a cycle.

## Key Concepts

### Bundle Types

```typescript
enum BundleType {
  player = 'player.js',           // Elements only (no controllers)
  clientPlayer = 'client-player.js',  // Elements + controllers
  editor = 'editor.js',           // Editor UI
  esm = 'esm'                     // Browser ESM modules; controllers when the loader loaded them
}
```

- **`player.js`**: elements only. The host's server runs the controllers and
  sends processed models; the item player loads it when hosted.
- **`client-player.js`**: elements and controllers, so the controllers run in
  the browser. The item player's default in `mode="view"`.
- **`editor.js`**: configure (authoring) elements and controllers, for
  `mode="author"`.
- **`esm`**: registry entries the ESM adapter writes; it loads each element's
  browser modules directly, with no bundle file.

### Registry

The PIE registry (`window.PIE_REGISTRY`) tracks all loaded PIE elements:

```typescript
interface Entry {
  package: string;        // e.g., "@pie-element/multiple-choice@14.0.3"
  status: Status;         // 'loading' | 'loaded'
  tagName: string;        // e.g., "multiple-choice--version-14-0-3"
  controller?: PieController;  // Absent for player.js bundles
  config?: any;           // Constructor or metadata, depending on the adapter
  element?: any;
  bundleType?: BundleType;
}
```

### Unique Tags

PIE uses versioned tag names to allow multiple versions side-by-side:

```typescript
// Input: <multiple-choice id="1"></multiple-choice>
// Output: <multiple-choice--version-14-0-3 id="1"></multiple-choice--version-14-0-3>
```

A custom element cannot be redefined once registered, so each version gets a
tag of its own. `parseVersionedTagName` from `pie/tag-names` splits a runtime
tag back into its base name and encoded version, so code that matches an
element by tag compares `baseName`.

## Custom Element Tag Validation

Dynamic registration paths validate a custom element name before calling
`customElements.define(...)`. A valid name:

- contains at least one hyphen (`-`)
- is lowercase
- starts with a letter and holds only letters, digits, `.`, `_` and `-`
- is not a reserved HTML name

The reserved names:

- `annotation-xml`
- `color-profile`
- `font-face`
- `font-face-src`
- `font-face-uri`
- `font-face-format`
- `font-face-name`
- `missing-glyph`

These are the names the HTML specification disallows for autonomous custom
elements.

The helpers are in `pie/tag-names`, and the barrel re-exports them:

```typescript
import { validateCustomElementTag, toViewTag } from "@pie-players/pie-players-shared/pie/tag-names";

const baseTag = validateCustomElementTag("multiple-choice");
const authorTag = toViewTag(baseTag, "author"); // multiple-choice-config
```

## Logging

`createPieLogger(namespace, debugEnabled)` prefixes each line with the namespace.
`debugEnabled` is a function, read on every `debug` call; `info`, `warn` and
`error` always log:

```typescript
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";

const logger = createPieLogger("my-component", isGlobalDebugEnabled);

logger.debug("Detailed info", data); // Only while the debug flag is on
logger.info("Loaded");
logger.warn("Retrying");
logger.error("Load failed", error);
```

`isGlobalDebugEnabled()` reads `window.PIE_DEBUG`. The shared modules, the
section player and the assessment toolkit log debug output while it is `true`,
so setting it in the browser console turns them on:

```javascript
window.PIE_DEBUG = true;
```

`<pie-item-player>` logs debug output when its `debug` attribute holds any value
other than `false`, `0` or the empty string. It writes the result to
`window.PIE_DEBUG`, so one player's `debug` attribute turns the page's other PIE
loggers on or off:

```html
<pie-item-player strategy="preloaded" debug="true"></pie-item-player>
```

## Common Tasks

### Load PIE Bundle from URL

```typescript
import { loadPieModule } from './initialization';

await loadPieModule(config, session, {
  bundleType: BundleType.player,
  env: { mode: 'gather', role: 'student' },
  // Optional. Deadline for the bundle `<script>` load; defaults to
  // DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs. 0 disables it.
  loadTimeoutMs: 120000
});
```

The returned promise rejects, naming the bundle URL, when the script fails to
load, when the deadline elapses, when the script runs without populating
`window.pie`, or when element registration throws. The rejection is the only
signal that the elements will never arrive, so the caller handles it.

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

### Bind Elements That Arrive Later

The loaders bind what is in the container when they run. An element inserted
afterwards — host markup appended into the container, or a PIE element painting
nested PIE tags — is bound by an observer the container's owner holds and
releases:

```typescript
import { observePieElements } from './element-observer';

const release = observePieElements(container, () => ({ config, session, env }));
// on teardown
release();
```

The callback is read when an element arrives, so a caller that recomputes its
session or env on render binds a late element against current state. Several
registrations may share one container (an item player registers its item config
and its passage config), and each gets its own release.

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

const controller = findPieController('multiple-choice--version-14-0-3');
if (controller) {
  const outcome = await controller.outcome(model, session, env);
}
```
