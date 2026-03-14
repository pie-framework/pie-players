# Section Player & Assessment Toolkit — Client Integration Guide

This guide is for development teams integrating the section player into production systems. It covers the architectural model, both CE-first and full JS API integration patterns, tool configuration, and the complete lifecycle around content loading and session persistence. It is not a getting-started guide — it assumes you understand web components, TypeScript, and async patterns in browser environments.

---

## 1. Architectural Model

The system is built around three distinct layers with well-defined responsibilities. Getting these boundaries right is the most important architectural decision your integration has to make.

![Section Player Three-Layer Architecture](../img/sp-three-layer-architecture.png)

**Section Player custom element** (`pie-section-player-splitpane` / `pie-section-player-vertical`)
Renders the section composition — items, passages, toolbars — and bridges between the host runtime contracts and the internal rendering engine. It dispatches public lifecycle events and exposes a `SectionControllerHandle` for programmatic session access. The element is framework-agnostic; it works as a plain HTML custom element.

**Assessment Toolkit (`ToolkitCoordinator`)**
Orchestrates all toolkit services: tool availability, TTS, highlight coordination, accessibility catalogs, and section controller lifecycle. It is the single authoritative service hub for an assessment context. It does not own navigation state, timing, or progress — those live in your host.

**Host Application**
Owns everything with business meaning: the `attemptId`, navigation continuity across page loads, backend persistence, reset policy, and telemetry. The host wires the player and coordinator together, registers persistence strategies, and reacts to controller events. The host may itself be a larger assessment runtime — an outer player that manages routing, auth context, inter-section navigation, and result submission — with the section player embedded as a subsystem. The boundary still applies in that case: the section player and toolkit handle the section-level runtime mechanics; the outer layer handles all durable state and policy above that boundary.

The rule is: player/toolkit handle runtime mechanics, the host handles durable data and policy. Violations of this — for instance, storing `getRuntimeState()` blobs to your backend, or letting the player control navigation without host involvement — lead to brittle integrations.

---

## 2. Integration Modes

There are two ways to integrate the section player. They produce identical runtime behaviour; the difference is where the `ToolkitCoordinator` is constructed.

![CE-First vs JS API Integration Modes](../img/sp-integration-modes.png)

### CE-First (simple)

In CE-first mode, you pass tool and section configuration directly as element attributes/properties. The player creates the `ToolkitCoordinator` internally and hands you a reference via the `toolkit-ready` event. This is the right starting point for most integrations and is sufficient for many production use cases.

```html
<pie-section-player-splitpane
  assessment-id="my-assessment-001"
  section-id="section-a"
  attempt-id="attempt-xyz"
  show-toolbar="true"
  toolbar-position="right"
  enabled-tools="theme,graph,periodicTable,lineReader"
></pie-section-player-splitpane>
```

Key props you'll set via attributes:

| Attribute | Type | Purpose |
| --- | --- | --- |
| `assessment-id` | `string` | Scopes tool state across sections |
| `section-id` | `string` | Identifies this section |
| `attempt-id` | `string` | Identifies the attempt (host-owned) |
| `section` | `object` | Section content/composition model |
| `env` | `object` | `{ mode: 'gather'/'view'/'evaluate', role: 'student'/'instructor' }` |
| `tools` | `object` | Tool placement/provider config (see §4) |
| `show-toolbar` | `boolean` | Whether to render the section toolbar |
| `enabled-tools` | `string` | Comma-separated list of tool IDs for the toolbar |
| `player-type` | `string` | `'iife'` (default) or `'esm'` |
| `lazy-init` | `boolean` | Defer internal initialization until visible |

To obtain the coordinator and attach any hooks:

```ts
playerEl.addEventListener('toolkit-ready', (e: CustomEvent) => {
  const coordinator = e.detail.coordinator;
  coordinator.setHooks({
    onError: (error, context) => console.error('[toolkit]', context, error),
  });
});
```

### JS API (full control)

For any production system with its own session infrastructure, construct `ToolkitCoordinator` yourself and pass it to the element. This is the baseline integration path when your host already owns auth context, a session API, and an event model — CE-first is a shortcut for standalone deployments, not the starting point for embedded integrations.

```ts
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment-001',
  tools: {
    placement: {
      section: ['theme', 'graph', 'periodicTable'],
      item: ['calculator', 'textToSpeech', 'annotationToolbar'],
      passage: ['textToSpeech', 'annotationToolbar'],
    },
    providers: {
      calculator: { authFetcher: fetchDesmosCredentials },
    },
  },
  hooks: {
    onError: (error, context) => reportError(error, context),
    async createSectionSessionPersistence(context) {
      // See §6 for full treatment
      return buildPersistenceStrategy(context);
    },
  },
});

// Pass to the element — no ontoolkit-ready handler needed
playerEl.coordinator = coordinator;
```

The `coordinator` prop takes precedence over CE-generated coordinators. When you pass one, the `ontoolkit-ready` event still fires, but it carries the same coordinator reference you provided — use it for identity checks rather than initialization.

---

## 3. Content Loading

The section player expects a `section` object describing the composition — items, passages, and their relationships. You set this as the `section` property on the element.

Content items are rendered via `<pie-item-player>` elements. The `player-type` attribute on the section player maps directly to the item player's `strategy` and controls how PIE element bundles are fetched and registered.

- **`iife`** (default): Elements are loaded by injecting `<script>` tags that fetch IIFE bundles from a bundle host (default: `https://proxy.pie-api.com/bundles`). PIE was built during an era when IIFE was the most reliable cross-environment delivery format, and this remains the most widely deployed strategy. It is the safe default for any production system today.

- **`esm`**: Elements are loaded via dynamic `import()` from an ESM CDN (default: `https://cdn.jsdelivr.net/npm`). This is the intended future default — the PIE team is targeting ESM as the primary strategy by end of 2026. Compared to IIFE, ESM loading offers genuine architectural advantages: modules are fetched concurrently and cached by the browser's native module cache across loads (unlike IIFE script tags, which are re-executed every time), shared dependencies between elements can be deduplicated at the module graph level rather than being bundled redundantly into each IIFE, and the format supports standard toolchain features like tree-shaking and source maps. ESM also produces a better local development experience since modules integrate naturally with browser DevTools and bundlers. The PIE elements library is still being migrated to full ESM compatibility; the team is targeting full ESM support by end of 2026.

- **`preloaded`**: All required PIE custom elements are assumed to be already registered in the browser — no loading occurs at runtime. This strategy is used with the `@pie-players/pie-preloaded-player` package, which is a pre-built project dependency containing a fixed set of elements bundled at build time. Because the element set and versions are locked to your application's CI/CD cycle, this trades flexibility for zero-network-request rendering: useful for offline environments, strict performance budgets, or controlled test harnesses. The downside is that updating an element version or adding a new element requires a redeployment — you lose the ability to hot-swap element versions dynamically without a full release cycle.

For `loaderOptions` (custom bundle host URL, ESM CDN URL, import-map mode, etc.) see [docs/item-player/loading-strategies.md](../item-player/loading-strategies.md).

The player tracks loading through `totalRegistered` and `totalLoaded` counters (accessible via `getRuntimeState()`) and emits `section-loading-complete` when all registered items have loaded. The `readiness-change` event gives you the current phase (`bootstrapping` → `interaction-ready` → `loading` → `ready`).

---

## 4. Tool Configuration

Tool configuration flows through the `tools` property on `ToolkitCoordinator` (or directly on the element in CE-first mode). The structure normalizes to a `CanonicalToolsConfig` with three top-level keys:

```ts
tools: {
  // Which tools appear where
  placement: {
    section: string[];   // Section-level toolbar tools
    item: string[];      // Per-item toolbar tools
    passage: string[];   // Per-passage toolbar tools
  };

  // Per-tool provider config (auth, settings, feature flags)
  providers: {
    [toolId: string]: {
      enabled?: boolean;
      settings?: Record<string, unknown>;
      authFetcher?: () => Promise<Record<string, unknown>>;
      // ...tool-specific keys
    };
  };

  // Allow/block overrides (optional)
  policy: {
    allowed?: string[];
    blocked?: string[];
  };
}
```

Tool IDs (canonical aliases): `theme`, `graph`, `periodicTable`, `protractor`, `lineReader`, `ruler`, `calculator`, `textToSpeech`, `annotationToolbar`, `answerEliminator`, `colorScheme`.

A typical multi-tool configuration:

```ts
const tools = {
  placement: {
    section: ['theme', 'graph', 'periodicTable', 'lineReader', 'ruler'],
    item: ['calculator', 'textToSpeech', 'answerEliminator', 'annotationToolbar'],
    passage: ['textToSpeech', 'annotationToolbar'],
  },
  providers: {
    textToSpeech: {
      backend: 'browser',        // 'browser' | 'polly' | 'google' | 'server'
      defaultVoice: 'en-US',
    },
    calculator: {
      authFetcher: async () => {
        const r = await fetch('/api/tools/desmos/auth');
        const { apiKey } = await r.json();
        return { apiKey };
      },
    },
    annotationToolbar: { enabled: true },
  },
};
```

Tools are placed at the level specified in `placement`. A tool in `item` gets a toolbar button rendered inside each item card; a tool in `section` goes to the shared section toolbar. Tools not listed in any placement array are not visible but may still be registered internally if they have providers.

The `ToolkitCoordinator` also exposes its managed services directly for host code that needs to interact with them outside the player (e.g., wiring a standalone TTS control panel or annotation toolbar):

```ts
coordinator.ttsService           // TTSService instance
coordinator.highlightCoordinator // HighlightCoordinator
coordinator.elementToolStateStore // ephemeral per-element tool state
coordinator.catalogResolver      // QTI 3.0 accessibility catalog resolution
```

**`TTSService`** manages text-to-speech playback across the section. It uses a pluggable provider architecture — the default is the browser's Web Speech API, with AWS Polly and Google TTS available as built-in server-backed alternatives. You can also implement the `ITTSProvider` interface to wire in your own backend. The service handles full playback lifecycle (play, pause, resume, stop), prevents conflicts when multiple regions try to speak simultaneously, and drives word- and sentence-level highlight tracking as audio plays. It also supports QTI 3.0 accessibility catalogs: if an item contains pre-authored spoken-content entries (SSML or plain text), the service reads those rather than synthesizing from visible DOM text.

**`HighlightCoordinator`** manages two independent highlight layers using the browser's [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) — zero DOM mutation, so the accessibility tree and screen readers always see the original text. The TTS layer marks the word or sentence currently being spoken and is cleared automatically when playback stops or advances. The annotation layer holds student-created highlights from the annotation toolbar, persisting independently so they are never cleared by TTS activity. Annotations support multiple colors (yellow, green, blue, pink, orange, underline) and their ranges are serializable via `RangeSerializer` for backend persistence.

---

## 5. The SectionController Handle

The `SectionControllerHandle` is the primary programmatic interface between your host and the section runtime. It lives inside the coordinator and is accessible once the player has bootstrapped.

### Accessing the controller

Never assume the controller is synchronously available after mounting. Two patterns are available:

**Event callback** — listen for `section-controller-ready` and call `coordinator.getSectionController()` inside the handler. This fits naturally with the rest of the event wiring, requires no timeout management, and is the more idiomatic choice when your integration is already event-driven.

```ts
playerEl.addEventListener('section-controller-ready', () => {
  const controller = coordinator.getSectionController({ sectionId, attemptId });
});
```

**Async/await** — `waitForSectionController` resolves once the controller is ready, or returns `null` after the timeout. Useful for imperative contexts (test harnesses, programmatic code running after mount) where attaching an event listener retroactively is awkward, but requires you to handle the timeout case explicitly.

```ts
const controller = await playerEl.waitForSectionController(5000);
if (!controller) throw new Error('Section controller did not become ready');
```

### Reading state

```ts
// Serialization-safe snapshot — suitable as the persistence payload
// (use via the persistence strategy described in §6, not direct saves)
const session = controller.getSession();
// { currentItemIndex, visitedItemIdentifiers, itemSessions: Record<string, unknown> }

// Ephemeral runtime state — for diagnostics/observability only, do not persist
const runtime = controller.getRuntimeState();
// { loadingComplete, totalRegistered, totalLoaded, currentItemIndex,
//   itemIdentifiers, itemSessions, itemsComplete, completedCount, totalItems, ... }
```

**Critical distinction**: `getSession()` produces the only serialization-safe snapshot — it is what the persistence strategy (§6) passes to your backend. `getRuntimeState()` contains derived and ephemeral fields and is not a stability-guaranteed payload; use it only for diagnostics and observability.

### Mutating session state

```ts
// Restore a full snapshot from your backend (e.g., on page load)
await controller.applySession(snapshotFromBackend, { mode: 'replace' });

// Apply a partial overlay without overwriting unrelated items
await controller.applySession(partialSnapshot, { mode: 'merge' });

// Write a single item's session directly (e.g., from a custom event handler)
await controller.updateItemSession('item-q1', {
  session: { id: 'item-q1-session', data: [{ id: 'choice', value: 'b' }] },
  complete: true,
});
```

### Persistence lifecycle

```ts
// Load session from configured persistence strategy and apply it
await controller.hydrate();

// Save current getSession() snapshot via configured persistence strategy
await controller.persist();

// Dispose the controller, with optional save/clear behavior
await coordinator.disposeSectionController({
  sectionId,
  attemptId,
  persistBeforeDispose: true,   // call persist() before teardown
  clearPersistence: false,       // call clearSession() (for resets)
});
```

---

## 6. Session Persistence

Session persistence is wired through the `createSectionSessionPersistence` hook on `ToolkitCoordinator`. This hook is called once per `(assessmentId, sectionId, attemptId)` tuple — the return value is cached for the lifetime of that controller.

![Session Persistence Read and Write Paths](../img/sp-persistence-data-flow.png)

### Wiring the persistence strategy

```ts
const coordinator = new ToolkitCoordinator({
  assessmentId,
  tools,
  hooks: {
    async createSectionSessionPersistence(context) {
      const { assessmentId, sectionId, attemptId } = context.key;

      return {
        async loadSession() {
          const snapshot = await api.sessions.load({ assessmentId, sectionId, attemptId });
          return snapshot ?? null;
        },

        async saveSession(_ctx, session) {
          await api.sessions.save({
            assessmentId,
            sectionId,
            attemptId,
            snapshot: session ?? { itemSessions: {} },
          });
        },

        async clearSession() {
          await api.sessions.delete({ assessmentId, sectionId, attemptId });
        },
      };
    },
  },
});
```

The default strategy (when the hook is not provided) uses `localStorage` keyed as `pie:section-controller:v1:{assessmentId}:{sectionId}:{attemptId}`. For production, always supply your own strategy backed by a real backend.

If your host uses different session identifiers than `assessmentId`/`sectionId`/`attemptId`, close over your own IDs from the surrounding scope rather than relying solely on `context.key`. The hook is called with the coordinator's view of the key, but your persistence implementation can use whatever identifiers your backend expects — the two don't need to match. The session snapshot itself (`getSession()` output) is what you store; the key is just how you address the storage slot.

### Triggering persistence

The preferred pattern is to trigger `controller.persist()` via the coordinator subscription API, with deduplication to avoid backend thrash:

```ts
let lastFingerprint: string | null = null;

coordinator.subscribeItemEvents({
  sectionId,
  attemptId,
  eventTypes: ['item-session-data-changed'],
  listener: () => {
    const controller = coordinator.getSectionController({ sectionId, attemptId });
    if (!controller?.persist) return;

    const snapshot = controller.getSession();
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === lastFingerprint) return;  // no change, skip

    lastFingerprint = fingerprint;
    void controller.persist();
  },
});
```

You can also subscribe directly on the controller handle (see §7) and react to `item-session-data-changed` events — the approach is equivalent, but the coordinator helper handles scoping automatically.

### The hydration sequence

![Controller Readiness and Session Hydration Flow](../img/sp-hydration-sequence.png)

The typical page-load sequence is:

1. Mount the player element with `assessmentId`, `sectionId`, `attemptId`, and `coordinator`.
2. Player bootstraps, registers the section controller with the coordinator.
3. `toolkit-ready` event fires — by this point the coordinator is active.
4. `section-controller-ready` event fires — controller is now available.
5. The coordinator calls `createSectionSessionPersistence` to resolve the strategy.
6. On `controller.hydrate()`, the strategy's `loadSession` is called and the snapshot is applied via `applySession`.
7. Item elements register and load, emitting `section-loading-complete` when done.
8. After loading completes, the player **replays** `applySession` with `replay: true` to ensure all loaded items reflect the restored state.

Step 8 exists because of a timing gap: hydration (step 6) typically runs before item elements have registered — the bundles haven't loaded yet. `applySession` writes the snapshot into the controller's internal model, but an item element can only receive session data once it exists and is registered. The replay runs after `section-loading-complete`, when all elements are present, and re-applies the same snapshot against the now-complete item set. Without it, items that registered after hydration would render with no prior responses.

**Empty session semantics.** When `loadSession` returns `null` or an empty `itemSessions` map, the player treats this as a clean-slate session — items render with no prior responses. However, some PIE item runtimes expect an explicit empty response shape (e.g., `{ id: 'item-id', data: [] }`) rather than the absence of a key to visibly clear their UI on hydration. If you observe items that fail to clear visually after a reset, supply an explicit empty session shape per item in your `loadSession` return value rather than deleting the row or returning `null`. The exact shape is item-runtime-specific; check the element's session schema.

As a consequence, `section-session-applied` fires twice in a normal hydrated flow. Any host logic that reacts to this event (analytics, autosave triggers) must guard for idempotency:

```ts
coordinator.subscribeSectionLifecycleEvents({
  sectionId,
  attemptId,
  listener: (event) => {
    if (event.type === 'section-session-applied' && event.replay) {
      return;  // suppress duplicate side effects on replay
    }
    // handle initial apply
  },
});
```

---

## 7. Events and Subscriptions

The coordinator exposes two focused subscription helpers that filter the underlying controller event stream.

### Item events

Item events are tied to individual response interactions:

```ts
const unsub = coordinator.subscribeItemEvents({
  sectionId,
  attemptId,
  listener: (event) => {
    switch (event.type) {
      case 'item-session-data-changed':
        // event.itemId, event.session, event.complete, event.currentItemIndex
        break;
      case 'item-complete-changed':
        // event.itemId, event.complete, event.previousComplete
        break;
      case 'item-selected':
        // event.currentItemId, event.previousItemId, event.itemIndex
        break;
      case 'content-loaded':
        // event.itemId, event.contentKind ('item'|'passage'|'rubric')
        break;
      case 'item-player-error':
        // event.itemId, event.error
        break;
    }
  },
});

// Clean up on route teardown
unsub();
```

You can also narrow by event type or specific item IDs:

```ts
coordinator.subscribeItemEvents({
  sectionId,
  attemptId,
  eventTypes: ['item-session-data-changed', 'item-complete-changed'],
  itemIds: ['item-q1', 'item-q2'],
  listener: handleSessionChange,
});
```

### Section lifecycle events

Section lifecycle events cover loading, completion state, and errors:

```ts
const unsub = coordinator.subscribeSectionLifecycleEvents({
  sectionId,
  attemptId,
  listener: (event) => {
    switch (event.type) {
      case 'section-loading-complete':
        // event.totalRegistered, event.totalLoaded
        break;
      case 'section-items-complete-changed':
        // event.complete, event.completedCount, event.totalItems
        break;
      case 'section-session-applied':
        // event.mode, event.replay, event.itemSessionCount
        break;
      case 'section-error':
        // event.source, event.error
        break;
    }
  },
});
```

### Raw controller subscription

You can also subscribe directly on the controller handle for finer control:

```ts
const controller = await playerEl.waitForSectionController(5000);
const unsub = controller.subscribe?.((event) => {
  // receives all SectionControllerEvent types
});
```

### Always include both `sectionId` and `attemptId`

In multi-attempt or multi-section layouts, subscriptions without an explicit `attemptId` are ambiguous and will be silently ignored if multiple controllers exist for the same `sectionId`. Always scope subscriptions with both identifiers.

---

## 8. Player Element Lifecycle Events

For session data, loading state, and completion tracking, use the coordinator subscription API (§7) — not DOM events. The coordinator gives you typed, scoped, properly filtered access to the controller event stream and is the recommended integration surface for anything involving session state.

The player element does dispatch a small set of DOM `CustomEvent`s that are genuinely host-facing, because they have no coordinator equivalent:

| Event name | Detail | When |
| --- | --- | --- |
| `toolkit-ready` | `{ coordinator }` | Coordinator initialized — **CE-first only**: this is how you obtain the coordinator reference when you haven't constructed one yourself |
| `section-controller-ready` | `{ sectionId, attemptId, controller }` | Controller instance available — use this or `waitForSectionController()` as your entry point into the controller API |
| `readiness-change` | `{ phase, interactionReady, allLoadingComplete }` | Player phase transitions — use to drive loading UI |
| `interaction-ready` | same as readiness-change | First item is interactive (fires before all items have loaded) |
| `ready` | same as readiness-change | All items loaded and ready |

`readiness-change` covers the full phase sequence: `bootstrapping` → `interaction-ready` → `loading` → `ready`. Gate "start test" UI on `interaction-ready`, not `ready` — the latter waits for all items to fully load, which may take noticeably longer in sections with many items.

Other DOM events the element dispatches (`session-changed`, `composition-changed`, `runtime-owned`, `runtime-inherited`, `runtime-error`) are internal plumbing used by the player's own rendering pipeline. Do not build host integrations against them.

---

## 9. Reset Flow

In most production deployments, attempt lifecycle is managed server-side. The host navigates the student to a new attempt URL with a backend-minted `attemptId`, and the player mounts fresh — no client-side reset needed.

Client-side reset is relevant in specific cases: demo and test apps, authoring/preview tools where an author wants to clear responses interactively, or proctoring tools that need to invalidate an in-progress attempt without a full page navigation.

In those cases, resetting requires explicit coordination between the coordinator, controller, and your host state:

```ts
async function resetAttempt(sectionId: string, currentAttemptId: string) {
  // 1. Dispose the active controller, clearing persisted data
  await coordinator.disposeSectionController({
    sectionId,
    attemptId: currentAttemptId,
    persistBeforeDispose: false,  // don't save current state
    clearPersistence: true,        // call clearSession() on the strategy
  });

  // 2. Generate a new attempt ID (host owns this)
  const nextAttemptId = generateAttemptId();

  // 3. Re-mount the player with the new attempt ID
  // (typically by updating a key/reactive prop that triggers remount)
  playerEl.attemptId = nextAttemptId;
}
```

Key rules:

- For full attempt resets where the student starts fresh, prefer a new `attemptId` — it is the clearest signal of intent to the coordinator, the backend, and any observability tooling. Re-using the same `attemptId` after clearing persistence is valid if your backend explicitly supports it (e.g., clearing and re-hydrating on the same attempt key), but requires your persistence strategy to handle the cleared state correctly on the next `loadSession` call.
- Always dispose before remounting; orphaned controllers leak event subscriptions.
- The `clearPersistence: true` flag invokes `clearSession()` on your backend strategy, so implement it.

---

## 10. Production Guardrails

**One coordinator per assessment context.** Create one `ToolkitCoordinator` per page/route, not one per section. Pass the same instance to all section player elements and debug/observability tools. Dual coordinator references drift in lifecycle timing and produce ambiguous event streams.

**Gate on readiness.** Use `waitForSectionController()` rather than polling. Never assume the controller is available synchronously after mounting the element.

**Persist `getSession()`, never `getRuntimeState()`.** The runtime state contains ephemeral fields and computed values. Only the session snapshot from `getSession()` is a stable persistence payload.

**Fingerprint before saving.** Use content-based deduplication before calling `persist()` on every event to avoid redundant backend writes. See the fingerprint pattern in §6.

**Handle the replay.** `section-session-applied` fires twice in a normal hydration flow. Any autosave, analytics, or derived state that triggers on this event must check `event.replay` to avoid double-firing.

**Dispose intentionally.** On route unmount, call `coordinator.disposeSectionController()` with explicit `persistBeforeDispose`/`clearPersistence` flags. Don't let controllers garbage-collect silently.

**`attemptId` is owned by the host.** In standalone deployments, reflect `attemptId` in the URL so page refresh and back-navigation restore the correct attempt context. In embedded integrations where an outer player manages routing, the outer layer owns `attemptId` persistence — the section player should receive it as a prop rather than derive or store it independently.

