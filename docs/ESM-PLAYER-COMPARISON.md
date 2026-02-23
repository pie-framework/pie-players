# ESM Player Comparison: pie-elements-ng vs pie-players

## Executive Summary

The pie-elements-ng ESM player implementation demonstrates several architectural patterns and error handling strategies that could enhance the pie-players ESM implementation. This document analyzes both implementations and provides actionable recommendations.

## Architecture Comparison

### pie-elements-ng: Element-Centric Architecture

**Primary Components:**
- `PieElementPlayer.svelte` - Main orchestrator for individual element demos
- `EsmElementPlayer.svelte` - Lightweight ESM-specific player
- `element-loader.ts` - Direct element loading and registration

**Key Characteristics:**
- **Single element focus**: Loads and renders one element at a time
- **Direct DOM manipulation**: Creates element instances directly
- **Two-tier system**: Separate components for full demo vs. simple element rendering
- **Explicit lifecycle management**: Manual element instance creation, reuse, and cleanup

**File Locations:**
- `/pie-elements-ng/packages/element-player/src/PieElementPlayer.svelte`
- `/pie-elements-ng/packages/element-player/src/EsmElementPlayer.svelte`
- `/pie-elements-ng/packages/element-player/src/lib/element-loader.ts`

---

### pie-players: Item-Centric Architecture

**Primary Components:**
- `PieEsmPlayer.svelte` - Custom element wrapper
- `PieItemPlayer.svelte` - Shared item renderer (used by multiple player types)
- `EsmPieLoader` - Batch element loading with import map management

**Key Characteristics:**
- **Assessment item focus**: Loads and renders complete items with multiple elements
- **Component delegation**: Delegates to shared `PieItemPlayer` component
- **Unified player pattern**: Same rendering logic across fixed, inline, and ESM players
- **Import map optimization**: Creates import maps for efficient module resolution

**File Locations:**
- `/pie-players/packages/esm-player/src/PieEsmPlayer.svelte`
- `/pie-players/packages/players-shared/src/components/PieItemPlayer.svelte`
- `/pie-players/packages/players-shared/src/pie/esm-loader.ts`

---

## Detailed Feature Comparison

### 1. Element Loading Strategy

#### pie-elements-ng Approach

```typescript
// element-loader.ts:39-62
export async function loadElement(
  packagePath: string,
  tagName: string,
  cdnUrl: string,
  debug: boolean = false,
  optional: boolean = false  // 🔑 Key feature
): Promise<void> {
  // Check if already registered (prevents duplicate registration)
  if (customElements.get(tagName)) {
    if (debug) console.log(`[element-loader] Already registered: ${tagName}`);
    return;
  }

  // Dual-mode loading
  if (!cdnUrl || cdnUrl === '') {
    // Local development: static imports via $lib/element-imports
    module = await staticImports.getElementModule(packagePath);
  } else {
    // Production: dynamic import from CDN
    const modulePath = `${cdnUrl}/${packagePath}`;
    module = await import(/* @vite-ignore */ modulePath);
  }

  // Flexible export handling
  const ElementClass = module.default || module.Element;

  // Register custom element
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ElementClass);
  }

  // ✅ Wait for definition to complete
  await customElements.whenDefined(tagName);
}
```

**Strengths:**
- ✅ **Optional component support**: Configure/print components marked as optional
- ✅ **Registration check**: Prevents duplicate definitions
- ✅ **Dual-mode loading**: Static imports for dev, CDN for production
- ✅ **Flexible export resolution**: Tries `default` then `Element`
- ✅ **Definition wait**: Uses `customElements.whenDefined()` before proceeding

---

#### pie-players Approach

```typescript
// esm-loader.ts:85-172
private async loadElement(
  tag: string,
  packageVersion: string,
  needsController: boolean,
): Promise<void> {
  const registry = pieRegistry();

  try {
    const packageName = this.extractPackageName(packageVersion);

    // Dynamic import using package name (resolved via import map)
    const module = await import(/* @vite-ignore */ packageName);

    // Extract element class
    const ElementClass = module.default || module.Element;

    // Load controller if needed
    let controller = null;
    if (needsController) {
      const controllerModule = await import(`${packageName}/controller`);
      controller = controllerModule.default || controllerModule;
    }

    // Register in PIE registry (global state)
    registry[tag] = {
      package: packageVersion,
      status: Status.loading,
      tagName: tag,
      element: ElementClass,
      controller: controller,
      config: null,
      bundleType: "esm",
    };

    // Register custom element
    if (!customElements.get(tag)) {
      customElements.define(tag, class extends ElementClass {});
      registry[tag].status = Status.loaded;
    }
  } catch (err) {
    logger.error(`Failed to load element ${tag}:`, err);
    throw err; // ⚠️ All elements are required
  }
}
```

**Strengths:**
- ✅ **Import map optimization**: Uses import maps for version resolution
- ✅ **Batch loading**: Loads all elements in parallel
- ✅ **Controller integration**: Automatically loads controllers when needed
- ✅ **Global registry**: Integrates with existing PIE infrastructure
- ✅ **Version wrapping**: `class extends ElementClass` allows multiple versions

**Gaps:**
- ❌ No optional component support (all elements required)
- ❌ No timeout protection
- ❌ Single-mode loading (CDN only, no dev mode optimization)

---

### 2. Timeout Protection

#### pie-elements-ng Implementation

```typescript
// EsmElementPlayer.svelte:91-102
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(
    () => reject(new Error(
      `Timeout loading ${packageName} (>10s). ` +
      `Check /@pie- routes, Vite server, and network.`
    )),
    10000  // 10 second timeout
  )
);

await Promise.race([
  loadElementFromCdn(packageName, tagName, cdnUrl),
  timeoutPromise
]);
```

**Benefits:**
- Prevents indefinite hangs on network issues
- Provides actionable error message
- User gets feedback within 10 seconds

---

#### pie-players Implementation

**No timeout protection currently implemented.**

**Recommendation:** Add timeout wrapper in `EsmPieLoader.loadElement()`:

```typescript
private async loadElementWithTimeout(
  tag: string,
  packageVersion: string,
  needsController: boolean,
  timeoutMs: number = 10000
): Promise<void> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(
        `Timeout loading ${tag} (>${timeoutMs}ms). ` +
        `Check CDN availability and network connection.`
      )),
      timeoutMs
    )
  );

  return Promise.race([
    this.loadElement(tag, packageVersion, needsController),
    timeoutPromise
  ]);
}
```

---

### 3. Optional vs Required Components

#### pie-elements-ng Pattern

```typescript
// element-loader.ts:82-90
try {
  await loadElement(packagePath, tagName, cdnUrl, debug, optional);
} catch (error) {
  if (!optional) {
    console.error(`Failed to load element ${packagePath}:`, error);
    throw new Error(`Failed to load element: ${error.message}`);
  }
  if (debug) {
    console.log(`Optional element ${packagePath} not available`);
  }
}
```

**Usage in PieElementPlayer:**

```typescript
// Load delivery element (REQUIRED)
await loadElement(`${packageName}`, deliveryTag, cdnUrl, debug, false);

// Load configure element (OPTIONAL)
try {
  await loadElement(`${packageName}/configure`, configureTag, cdnUrl, debug, true);
  if (customElements.get(configureTag)) {
    hasConfigure = true;
  } else {
    configureWarning = `Configure component not available`;
  }
} catch (e) {
  configureWarning = `Configure component not available`;
}

// Load print element (OPTIONAL)
try {
  await loadElement(`${packageName}/print`, printTag, cdnUrl, debug, true);
  if (customElements.get(printTag)) {
    hasPrint = true;
  }
} catch (e) {
  // Silently handle - print is optional
}
```

**Benefits:**
- App doesn't crash if optional components are missing
- User gets clear warnings about missing functionality
- Graceful degradation

---

#### pie-players Pattern

**Current implementation treats all elements as required.** All loading errors propagate and halt initialization.

**Recommendation:** Add optional element support for configure/print/author variants:

```typescript
interface LoadOptions {
  optional?: boolean;
  timeout?: number;
}

public async loadElement(
  tag: string,
  packageVersion: string,
  needsController: boolean,
  options: LoadOptions = {}
): Promise<void> {
  try {
    // ... loading logic ...
  } catch (err) {
    if (!options.optional) {
      logger.error(`Failed to load required element ${tag}:`, err);
      throw err;
    } else {
      logger.warn(`Failed to load optional element ${tag}:`, err);
    }
  }
}
```

---

### 4. Session & Model Synchronization

#### pie-elements-ng: Sophisticated Reference Tracking

```typescript
// PieElementPlayer.svelte:86-90
let lastSessionRef = $state<any>(null);
let lastElementModelRef = $state<any>(null);
let lastElementSessionRef = $state<any>(null);

// Track session changes by reference
$effect(() => {
  if (!session) return;

  // Only process if session reference actually changed
  if (session === lastSessionRef) return;

  const normalized = normalizeSession(session);
  lastSessionRef = normalized;

  // If normalization changed the object, update bindable prop
  if (normalized !== session) {
    session = normalized;
    return; // Exit early to avoid double-processing
  }

  sessionVersion += 1;
  logConsole('session:prop', normalized);
});
```

**Benefits:**
- Reference equality prevents redundant processing
- Normalization ensures consistent structure
- Version tracking enables dependency tracking
- Avoids infinite loops

---

#### pie-players: Direct Props

```typescript
// PieEsmPlayer.svelte:371-374
session={(() => {
  const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
  return parsedSession.data || [];
})()}
```

**Current approach:**
- Simple inline parsing
- Delegates to `PieItemPlayer` for handling
- No normalization or reference tracking

**Gap:** No protection against infinite update loops if parent component repeatedly passes new session objects with identical content.

---

### 5. Element Instance Lifecycle

#### pie-elements-ng: Explicit Instance Management

```typescript
// EsmElementPlayer.svelte:104-117
// Reuse existing element instance when possible
if (elementInstance && currentTagName === tagName) {
  console.log(`[esm-player] Reusing element instance: ${tagName}`);
} else {
  // Clean up old instance
  if (elementInstance) {
    elementInstance.remove();
  }

  // Create new instance
  console.log(`[esm-player] Creating element instance: ${tagName}`);
  elementInstance = document.createElement(tagName);
  currentTagName = tagName;
}

// Update props
(elementInstance as any).model = model;
(elementInstance as any).session = session;
(elementInstance as any).mode = mode;

// Append to DOM
elementContainer.innerHTML = '';
elementContainer.appendChild(elementInstance);
```

**Benefits:**
- Instance reuse preserves component state
- Explicit cleanup prevents memory leaks
- Direct prop updates for reactivity
- Controlled DOM manipulation

---

#### pie-players: Declarative Rendering

```typescript
// PieItemPlayer.svelte (delegated rendering)
{#each itemModels as model (model.id)}
  <div class="pie-element-container">
    {@html markup}  <!-- Contains custom element tags -->
  </div>
{/each}
```

**Current approach:**
- Svelte handles element lifecycle
- Markup contains element tags rendered via `{@html}`
- Elements initialize automatically when added to DOM

**Gap:** No explicit instance reuse logic. Elements are recreated on config changes.

---

### 6. Error Handling & Observability

#### pie-elements-ng: Comprehensive Error Capture

```typescript
// PieElementPlayer.svelte:228-239, 373-375
const handleWindowError = (event: ErrorEvent) => {
  console.error('[pie-element-player] window:error',
    event.message || event.error || 'Unknown error');
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('[pie-element-player] window:unhandledrejection',
    event.reason || 'Unknown rejection');
};

onMount(async () => {
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
});

onDestroy(() => {
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
});
```

**Also includes:**

```typescript
// Consistent logging pattern
const logConsole = (label: string, data?: any) => {
  console.log('[pie-element-player]', label, data ?? '');
};

// Used throughout:
logConsole('model:build:request', { requestId, modelVersion, sessionVersion });
logConsole('model:build:success', { responseCorrect, mode, role });
logConsole('model:build:error', error);
logConsole('session:changed', detail);
```

**Benefits:**
- Catches errors from elements or async operations
- Proper cleanup on component destroy
- Structured logging for debugging
- Easy to trace flow with label prefixes

---

#### pie-players: Basic Try-Catch

```typescript
// PieEsmPlayer.svelte:214-237
try {
  // ... loading logic ...
} catch (err: any) {
  const errorMsg = `Error loading ESM elements: ${err.message}`;
  logger.error('ESM loading error:', err);
  error = errorMsg;
  loading = false;

  // Track error with New Relic if enabled
  if (isBrowser && loaderConfig?.trackPageActions) {
    try {
      const newrelic = (window as any)?.newrelic;
      if (newrelic && typeof newrelic.noticeError === 'function') {
        newrelic.noticeError(err, {
          component: 'pie-esm-player',
          errorType: 'EsmLoadingError',
          itemIds: itemIds.join(','),
          cdnBaseUrl: esmCdnUrl
        });
      }
    } catch (e) {
      logger.debug('New Relic tracking skipped');
    }
  }
}
```

**Current approach:**
- Try-catch around loading logic
- New Relic integration
- Logger integration

**Gap:** No global error handlers for catching element runtime errors.

---

### 7. Model Building with Race Condition Prevention

#### pie-elements-ng: Request ID Pattern

```typescript
// PieElementPlayer.svelte:385-401, 479-491
let modelRequestId = 0;

const buildModel = async (
  requestId: number,
  currentSessionVersion: number,
  currentModelVersion: number
) => {
  const model = elementModel;
  const sess = elementSession;
  const ctrl = controller;

  if (!ctrl) {
    modelError = 'No controller available';
    return;
  }

  logConsole('model:build:request', { requestId, modelVersion, sessionVersion });

  try {
    const normalizedModel = await ctrl.model(model, sess, mode, role);

    // ✅ Only update if this is still the latest request
    if (requestId === modelRequestId) {
      elementModel = { ...normalizedModel };
      modelError = null;
      logConsole('model:build:success', { requestId });
    } else {
      logConsole('model:build:stale', { requestId, current: modelRequestId });
    }
  } catch (err) {
    if (requestId === modelRequestId) {
      modelError = err.message;
      logConsole('model:build:error', { requestId, error: err });
    }
  }
};

// Trigger model build when dependencies change
$effect(() => {
  modelRequestId += 1;  // Increment for each new request
  const requestId = modelRequestId;
  const currentSessionVersion = sessionVersion;
  const currentModelVersion = modelVersion;

  buildModel(requestId, currentSessionVersion, currentModelVersion);
});
```

**Benefits:**
- Each build request gets unique ID
- Only accepts updates from latest request
- Prevents stale model from overwriting fresh data
- Works correctly with async operations
- Logs make it easy to debug race conditions

---

#### pie-players: Delegated to PieItemPlayer

The ESM player delegates model building to `PieItemPlayer`, which handles it synchronously during rendering. No explicit race condition handling.

**Gap:** If rapid config changes occur, could potentially have race conditions in async model building.

---

### 8. Capabilities Metadata Optimization

#### pie-elements-ng: Metadata-Driven Loading

```typescript
// PieElementPlayer.svelte:280-291
// Check capabilities metadata (if provided)
if (capabilities) {
  // Use metadata to avoid unnecessary loading attempts
  hasConfigure = capabilities.includes('author');
  hasPrint = capabilities.includes('print');

  if (debug) {
    console.log(`[pie-element-player] Using capabilities metadata:`, {
      hasConfigure,
      hasPrint,
    });
  }
} else {
  // Fallback: try to load configure/print components
  // ...
}
```

**Benefits:**
- Avoids unnecessary network requests
- Faster initialization when metadata is available
- Graceful fallback when metadata is missing

---

#### pie-players: No Metadata Support

**Current implementation:** Always attempts to load all elements, no capability pre-checking.

**Recommendation:** Add optional capabilities metadata to element config:

```typescript
interface ElementMetadata {
  tag: string;
  packageVersion: string;
  capabilities?: ('delivery' | 'configure' | 'print' | 'author')[];
}

// In config:
{
  elements: {
    'pie-multiple-choice': '@pie-element/multiple-choice@11.0.1',
  },
  elementMetadata?: {
    'pie-multiple-choice': {
      capabilities: ['delivery', 'configure', 'print']
    }
  }
}
```

---

### 9. Math Rendering Integration

Both projects now use the **unified provider pattern** we just implemented:

```typescript
// Both projects use identical approach
import { mathRendererProvider, createMathjaxRenderer } from '@pie-.../math-renderer-...';

$effect(() => {
  if (elementPlayer && !loading) {
    const renderer = mathRendererProvider.getRendererOrDefault(
      createMathjaxRenderer()
    );
    renderer(elementPlayer);
  }
});
```

**Status:** ✅ **Both implementations are aligned and working well.**

---

## Key Recommendations for pie-players

### Priority 1: High Impact, Low Complexity

1. **Add timeout protection to element loading** (10 seconds)
   - Prevents indefinite hangs on network issues
   - Implementation: Wrap `loadElement()` with `Promise.race()`

2. **Add window error event handlers**
   - Catches unhandled element errors
   - Implementation: `onMount` / `onDestroy` with event listeners

3. **Improve logging consistency**
   - Use prefixed labels for easier debugging
   - Implementation: Standardize on `logger.debug('label', data)` pattern

### Priority 2: Moderate Impact, Moderate Complexity

4. **Add optional component support**
   - Allows graceful degradation for configure/print components
   - Implementation: Add `optional` flag to `loadElement()` method

5. **Implement capabilities metadata**
   - Avoid unnecessary loading attempts
   - Implementation: Add optional metadata field to config

6. **Add session reference tracking**
   - Prevent redundant processing on identical session updates
   - Implementation: Track `lastSessionRef` with equality checks

### Priority 3: Nice to Have, Higher Complexity

7. **Add model building race condition protection**
   - Use request ID pattern for async model builds
   - Implementation: Add `requestId` counter and validation

8. **Add element instance reuse logic**
   - Preserve state when possible
   - Implementation: Track `currentTagName` and reuse instances

9. **Add dual-mode loading (dev vs production)**
   - Use static imports in development for faster reload
   - Implementation: Check for empty CDN URL and use static imports

---

## Implementation Examples

### Example 1: Timeout Protection

```typescript
// In esm-loader.ts
private async loadElementWithTimeout(
  tag: string,
  packageVersion: string,
  needsController: boolean,
  timeoutMs: number = 10000
): Promise<void> {
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error(
        `Timeout loading ${tag} (>${timeoutMs}ms). ` +
        `Check CDN (${this.cdnBaseUrl}) availability and network connection.`
      ));
    }, timeoutMs);
  });

  return Promise.race([
    this.loadElement(tag, packageVersion, needsController),
    timeoutPromise
  ]);
}

// Update load() method
await Promise.all(
  elementTags.map((tag) =>
    this.loadElementWithTimeout(
      tag,
      contentConfig.elements[tag],
      needsControllers
    )
  )
);
```

### Example 2: Window Error Handlers

```typescript
// In PieEsmPlayer.svelte
import { onMount, onDestroy } from 'svelte';

const handleWindowError = (event: ErrorEvent) => {
  logger.error('window:error', {
    message: event.message || 'Unknown error',
    error: event.error,
    filename: event.filename,
    lineno: event.lineno
  });
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  logger.error('window:unhandledrejection', {
    reason: event.reason || 'Unknown rejection'
  });
};

onMount(() => {
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  logger.debug('Error handlers registered');
});

onDestroy(() => {
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  logger.debug('Error handlers removed');
});
```

### Example 3: Optional Component Support

```typescript
// In esm-loader.ts
interface LoadElementOptions {
  optional?: boolean;
  timeout?: number;
}

private async loadElement(
  tag: string,
  packageVersion: string,
  needsController: boolean,
  options: LoadElementOptions = {}
): Promise<void> {
  try {
    // ... existing loading logic ...
  } catch (err) {
    const errorMsg = `Failed to load element ${tag}: ${err.message}`;

    if (!options.optional) {
      // Required element - propagate error
      logger.error(errorMsg);
      throw new Error(errorMsg);
    } else {
      // Optional element - log warning and continue
      logger.warn(`${errorMsg} (optional)`);
    }
  }
}

// Usage:
await this.loadElement(tag, version, true, { optional: false }); // delivery
await this.loadElement(`${tag}-configure`, version, true, { optional: true }); // configure
await this.loadElement(`${tag}-print`, version, false, { optional: true }); // print
```

---

## Architectural Philosophy

### pie-elements-ng Philosophy
**"Element First"** - Optimized for individual element rendering, testing, and demos. Explicit control over lifecycle, maximum visibility into element behavior.

**Best for:**
- Element development and testing
- Element demos and documentation
- Single-element integration scenarios

### pie-players Philosophy
**"Assessment First"** - Optimized for complete assessment item rendering with multiple elements. Unified rendering logic across player types, emphasis on consistency.

**Best for:**
- Assessment delivery platforms
- Multi-element assessment items
- Consistent player behavior across deployment modes

---

## Conclusion

Both implementations are well-designed for their respective use cases. The pie-elements-ng implementation demonstrates several defensive programming patterns (timeouts, optional components, error handlers) that would enhance the robustness of pie-players without compromising its architecture.

The **Priority 1 recommendations** (timeout protection, error handlers, logging) can be implemented quickly and will significantly improve resilience in production environments.

The math renderer provider pattern is now consistent between both projects, providing a solid foundation for programmatic renderer switching.

---

## Document Metadata

- **Created:** 2026-02-02
- **pie-elements-ng analyzed:** `/pie-elements-ng/packages/element-player/`
- **pie-players analyzed:** `/pie-players/packages/esm-player/`, `/pie-players/packages/players-shared/`
- **Related:** [MATH-RENDERER-ARCHITECTURE.md](MATH-RENDERER-ARCHITECTURE.md), [ARCHITECTURE.md](ARCHITECTURE.md)
