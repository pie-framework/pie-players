# Section Player Integration Guide

A comprehensive guide for developers integrating the PIE section player into a host application. Covers installation, configuration, tools (TTS, calculator), the section controller, events, and state management.

For a quick-start walkthrough with data layout and theming, see [assessment-toolkit-section-player-getting-started.md](./assessment-toolkit-section-player-getting-started.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Custom Elements](#custom-elements)
4. [Basic Setup](#basic-setup)
5. [Runtime Configuration](#runtime-configuration)
6. [Tool Configuration](#tool-configuration)
   - [Tool Placement and Policy](#tool-placement-and-policy)
   - [TTS (Text-to-Speech)](#tts-text-to-speech)
   - [Calculator (Desmos)](#calculator-desmos)
   - [Other Tools](#other-tools)
7. [The Section Controller](#the-section-controller)
   - [What It Is](#what-it-is)
   - [Obtaining a Controller Handle](#obtaining-a-controller-handle)
   - [Subscribing to Events](#subscribing-to-events)
   - [Controller Event Types](#controller-event-types)
   - [Pulling State](#pulling-state)
8. [Custom Element Events](#custom-element-events)
9. [Navigation](#navigation)
10. [Session Persistence](#session-persistence)
11. [Lifecycle Hooks](#lifecycle-hooks)
12. [Angular Integration Example](#angular-integration-example)
13. [SvelteKit Integration Example](#sveltekit-integration-example)
14. [Vanilla JS / Framework-Agnostic Example](#vanilla-js--framework-agnostic-example)
15. [CSS / Layout Requirements](#css--layout-requirements)
16. [Troubleshooting](#troubleshooting)

---

## Overview

The PIE section player renders a QTI-aligned assessment section (passages + items) inside a web component. It orchestrates item rendering, tool services (TTS, calculators, highlighters, etc.), and session state through a central `ToolkitCoordinator` and per-section `SectionController`.

**Architecture at a glance:**

```
Host Application
  └─ <pie-section-player-splitpane>        ← custom element
       └─ pie-assessment-toolkit           ← orchestrates coordinator + controller
            ├─ ToolkitCoordinator           ← tool services, TTS, provider registry
            └─ SectionController            ← section state, session, events
                 └─ ItemShell → pie-item-player  ← renders individual items
```

The host app:
- Provides section content and configuration
- Listens for events (session changes, readiness, errors)
- Optionally pulls state snapshots from the controller
- Owns backend persistence (the framework does not auto-save to a server)

---

## Installation

Core packages:

```bash
npm install @pie-players/pie-assessment-toolkit @pie-players/pie-section-player
```

Optional tool packages (install only the tools you enable):

```bash
# Calculator (Desmos-powered)
npm install @pie-players/pie-tool-calculator-desmos @pie-players/pie-calculator-desmos

# Text-to-Speech
npm install @pie-players/pie-tool-text-to-speech

# Theming
npm install @pie-players/pie-theme

# DaisyUI theme bridge (if your app uses DaisyUI)
npm install @pie-players/pie-theme-daisyui

# Debug tools (development only)
npm install @pie-players/pie-section-player-tools-event-debugger
npm install @pie-players/pie-section-player-tools-session-debugger
```

---

## Custom Elements

Register the custom element you want in your application entry point:

```ts
// Split-pane layout (passage left, item right)
import '@pie-players/pie-section-player/components/section-player-splitpane-element';

// Vertical stacked layout
import '@pie-players/pie-section-player/components/section-player-vertical-element';
```

Both elements expose the same props, events, and JS API.

---

## Basic Setup

### HTML

```html
<pie-section-player-splitpane
  assessment-id="my-assessment"
  section-id="section-1"
  attempt-id="attempt-abc"
  player-type="iife"
  show-toolbar="true"
  toolbar-position="right"
></pie-section-player-splitpane>
```

### JavaScript

Set complex values as JS properties (not attributes):

```ts
const player = document.querySelector('pie-section-player-splitpane');

player.section = assessmentSectionObject;

player.env = {
  mode: 'gather',   // 'gather' | 'view' | 'evaluate'
  role: 'student'    // 'student' | 'instructor'
};

player.tools = {
  placement: {
    section: ['theme'],
    item: ['calculator', 'textToSpeech'],
    passage: ['textToSpeech']
  },
  providers: {
    calculator: {
      authFetcher: async () => {
        const res = await fetch('/api/tools/desmos/auth');
        return res.json();
      }
    },
    tts: { enabled: true, backend: 'browser' }
  }
};
```

---

## Runtime Configuration

All configuration can be passed as individual props **or** bundled into a single `runtime` object. When `runtime` is set, its fields take precedence over individual props.

### Individual props

| Attribute / Property | Type | Description |
|---|---|---|
| `assessment-id` | `string` | Assessment identifier (scopes tool state) |
| `section-id` | `string` | Section identifier |
| `attempt-id` | `string` | Attempt identifier (optional, enables multi-attempt isolation) |
| `section` | `object` | `AssessmentSection` payload (JS property) |
| `env` | `object` | `{ mode, role }` (JS property) |
| `tools` | `object` | Tool config (JS property, see below) |
| `player-type` | `string` | `"iife"` (default), `"esm"`, or `"preloaded"` |
| `lazy-init` | `boolean` | Defer async service init until needed (default `true`) |
| `show-toolbar` | `string` | `"true"` or `"false"` |
| `toolbar-position` | `string` | `"top"`, `"right"`, `"bottom"`, `"left"`, `"none"` |
| `enabled-tools` | `string` | Comma-separated section-level tool IDs |
| `item-toolbar-tools` | `string` | Comma-separated item-level tool IDs |
| `passage-toolbar-tools` | `string` | Comma-separated passage-level tool IDs |
| `coordinator` | `object` | Pre-created `ToolkitCoordinator` (advanced) |
| `isolation` | `string` | `"inherit"` (default) or `"force"` |

### Bundled `runtime` object

```ts
player.runtime = {
  assessmentId: 'my-assessment',
  playerType: 'iife',
  lazyInit: true,
  tools: { /* ... */ },
  accessibility: { catalogs: [], language: 'en-US' },
  env: { mode: 'gather', role: 'student' },
};
```

---

## Tool Configuration

### Tool Placement and Policy

Tools are organized by **placement level** and gated by **policy**:

```ts
tools: {
  // Where tools appear
  placement: {
    section: ['theme', 'graph', 'periodicTable', 'protractor', 'lineReader', 'ruler'],
    item: ['calculator', 'textToSpeech', 'answerEliminator', 'annotationToolbar'],
    passage: ['textToSpeech', 'annotationToolbar']
  },

  // Optional allow/block gates
  policy: {
    allowed: [],   // empty = all placement tools allowed
    blocked: []    // always removes listed tools
  },

  // Per-tool provider configuration
  providers: { /* ... */ }
}
```

**Resolution rules:**
- If `policy.allowed` is empty, all tools listed in `placement` are available.
- If `policy.allowed` is set, only placement tools also in `allowed` are used.
- `policy.blocked` always removes tools, regardless of other settings.

### Available Tool IDs

| Tool ID | Placement | Description |
|---|---|---|
| `calculator` | item | Desmos calculator (basic/scientific/graphing) |
| `textToSpeech` | section, item, passage | Text-to-speech read-aloud |
| `graph` | section | Graphing tool |
| `answerEliminator` | element | Strike through answer choices |
| `annotationToolbar` | item, passage | Highlighting and annotation |
| `lineReader` | passage | Reading mask / guide |
| `theme` | section | Color scheme and font size controls |
| `periodicTable` | section | Chemistry periodic table reference |
| `ruler` | element | On-screen ruler |
| `protractor` | element | On-screen protractor |

Aliases: `tts` → `textToSpeech`, `colorScheme` → `theme`.

### TTS (Text-to-Speech)

```ts
providers: {
  tts: {
    enabled: true,

    // Backend strategy
    backend: 'browser',     // 'browser' | 'polly' | 'google' | 'server'

    // Voice / speech settings
    defaultVoice: 'en-US',
    rate: 1.0,              // 0.25–4.0
    pitch: 1.0,             // 0–2

    // Server-backed TTS (Polly/Google)
    provider: 'polly',          // server-side provider
    engine: 'neural',           // 'standard' | 'neural' (Polly)
    apiEndpoint: '/api/tts/synthesize',
    language: 'en-US',

    // Auth for server providers
    authFetcher: async () => {
      const res = await fetch('/api/tools/tts/credentials');
      return res.json();
    }
  }
}
```

**Recommended approach:**
- Start with `backend: 'browser'` for development (zero setup, uses Web Speech API).
- Switch to `'polly'` or `'google'` in staging/production for higher quality voices.
- Keep AWS/Google credentials server-side; expose only a token endpoint via `authFetcher` or `apiEndpoint`.

### Calculator (Desmos)

```ts
providers: {
  calculator: {
    enabled: true,
    authFetcher: async () => {
      const res = await fetch('/api/tools/desmos/auth');
      if (!res.ok) throw new Error(`Desmos auth failed: ${res.status}`);
      return res.json(); // { apiKey: '...' }
    }
  }
}
```

Your backend endpoint should return a JSON object with the Desmos API key:

```ts
// Express example
app.get('/api/tools/desmos/auth', (req, res) => {
  res.json({ apiKey: process.env.DESMOS_API_KEY });
});
```

**Security:** Never embed API keys in frontend bundles. Use `authFetcher` to fetch keys from your backend at runtime. For development, a direct `apiKey` field exists but must not be used in production.

If no `authFetcher` is provided, the toolkit attempts `GET /api/tools/desmos/auth` by default.

### Other Tools

Most other tools (annotation toolbar, answer eliminator, line reader, ruler, protractor) work out of the box with just placement configuration — no provider config needed. Simply include them in the relevant `placement` array and install any required packages.

---

## The Section Controller

### What It Is

The `SectionController` is the authoritative owner of section-level state: item navigation, session data (student answers), completion tracking, and loading lifecycle. It is the **primary API surface** for host applications that need to react to student interactions or query section state.

Each section + attempt combination gets its own controller instance, managed by the `ToolkitCoordinator`.

### Obtaining a Controller Handle

There are three ways to get a `SectionControllerHandle`:

#### 1. From the custom element (recommended for most hosts)

```ts
const player = document.querySelector('pie-section-player-splitpane');

// Async — waits up to 5 seconds for the controller to be ready
const controller = await player.waitForSectionController(5000);

// Sync — returns null if not ready yet
const controller = player.getSectionController();
```

#### 2. From the `section-controller-ready` event

```ts
player.addEventListener('section-controller-ready', (e) => {
  const { sectionId, attemptId, controller } = e.detail;
  // controller is ready to use
});
```

#### 3. From the `ToolkitCoordinator` (when you capture it from `toolkit-ready`)

```ts
player.addEventListener('toolkit-ready', (e) => {
  const coordinator = e.detail.coordinator;

  const controller = coordinator.getSectionController({
    sectionId: 'section-1',
    attemptId: 'attempt-abc'
  });
});
```

### Subscribing to Events

The controller emits a typed event stream for all state changes. There are two subscription mechanisms:

#### Direct controller subscription

```ts
const controller = await player.waitForSectionController(5000);

const unsubscribe = controller.subscribe((event) => {
  switch (event.type) {
    case 'item-session-data-changed':
      // Student provided or changed an answer
      console.log('Answer changed:', event.itemId, event.session);
      persistAnswer(event.canonicalItemId, event.session);
      break;

    case 'item-complete-changed':
      console.log('Item completion:', event.itemId, event.complete);
      break;

    case 'section-items-complete-changed':
      console.log('All items complete:', event.complete,
        `${event.completedCount}/${event.totalItems}`);
      break;

    case 'item-selected':
      console.log('Navigated to:', event.currentItemId,
        `(${event.itemIndex + 1}/${event.totalItems})`);
      break;

    case 'section-loading-complete':
      console.log('Section fully loaded');
      break;
  }
});

// Clean up when done
unsubscribe();
```

#### Via ToolkitCoordinator (with optional filtering)

`subscribeSectionEvents` supports event type and item ID filtering and handles subscription replacement automatically:

```ts
player.addEventListener('toolkit-ready', (e) => {
  const coordinator = e.detail.coordinator;

  const unsubscribe = coordinator.subscribeSectionEvents({
    sectionId: 'section-1',
    attemptId: 'attempt-abc',

    // Only receive these event types (omit for all)
    eventTypes: [
      'item-session-data-changed',
      'section-items-complete-changed',
      'section-loading-complete'
    ],

    // Only events for these items (omit for all)
    itemIds: ['item-1', 'item-2'],

    listener: (event) => {
      handleControllerEvent(event);
    }
  });
});
```

### Controller Event Types

| Event type | When it fires | Key fields |
|---|---|---|
| `item-session-data-changed` | Student provides or changes an answer | `itemId`, `canonicalItemId`, `session`, `intent`, `complete`, `component` |
| `item-session-meta-changed` | Metadata-only session update (no answer data) | `itemId`, `canonicalItemId`, `complete`, `component` |
| `item-selected` | Navigation within the section (item changed) | `previousItemId`, `currentItemId`, `itemIndex`, `totalItems` |
| `item-complete-changed` | An item's completion state flipped | `itemId`, `canonicalItemId`, `complete`, `previousComplete` |
| `section-items-complete-changed` | Aggregate completion state changed (all items done or not) | `complete`, `completedCount`, `totalItems` |
| `content-loaded` | An item/passage finished loading | `contentKind`, `itemId`, `canonicalItemId` |
| `section-loading-complete` | All registered content finished loading | `totalRegistered`, `totalLoaded` |
| `section-navigation-change` | Section-level navigation (section switched) | `previousSectionId`, `currentSectionId`, `reason` |
| `item-player-error` | An item player reported an error | `itemId`, `error`, `contentKind` |
| `section-error` | Section-level error | `source`, `error`, `itemId?` |

All events include `type`, `timestamp`, and `currentItemIndex`.

### Pulling State

The controller offers several state-reading methods for on-demand snapshots:

#### Runtime state (live diagnostics)

```ts
const state = controller.getRuntimeState();
// {
//   sectionId: 'section-1',
//   currentItemIndex: 2,
//   currentItemId: 'item-3',
//   itemIdentifiers: ['item-1', 'item-2', 'item-3'],
//   visitedItemIdentifiers: ['item-1', 'item-2', 'item-3'],
//   itemSessions: { 'item-1': { ... }, 'item-2': { ... } },
//   loadingComplete: true,
//   totalRegistered: 3,
//   totalLoaded: 3,
//   itemsComplete: false,
//   completedCount: 1,
//   totalItems: 3
// }
```

#### Session state (for persistence)

```ts
const session = controller.getSessionState();
// {
//   currentItemIndex: 2,
//   visitedItemIdentifiers: ['item-1', 'item-2', 'item-3'],
//   itemSessions: { 'item-1': { ... }, 'item-2': { ... } }
// }
```

#### Navigation state

```ts
const nav = controller.getNavigationState();
// { currentIndex: 2, totalItems: 3, canNext: false, canPrevious: true, isLoading: false }
```

#### Item sessions by ID

```ts
const sessions = controller.getItemSessionsByItemId();
// { 'item-1': { id: '...', data: [...], complete: true }, ... }
```

---

## Custom Element Events

The section player custom element also emits DOM events that bubble. These are useful when you don't need the full controller API:

| Event | Detail | Description |
|---|---|---|
| `session-changed` | `{ itemId, canonicalItemId, session, timestamp, ... }` | Normalized session update from the runtime |
| `toolkit-ready` | `{ coordinator, runtimeId, assessmentId, sectionId }` | ToolkitCoordinator is initialized |
| `section-controller-ready` | `{ sectionId, attemptId, controller }` | SectionController is ready |
| `composition-changed` | `{ composition }` | Section composition model changed |
| `readiness-change` | `{ phase, interactionReady, allLoadingComplete, reason? }` | Player readiness phase changed |
| `interaction-ready` | (same as readiness-change) | First interaction-ready moment |
| `ready` | (same as readiness-change) | All loading complete |
| `runtime-error` | `{ runtimeId, error }` | Runtime error |
| `runtime-owned` | `{ runtimeId }` | This element owns its runtime |
| `runtime-inherited` | `{ runtimeId, parentRuntimeId }` | Runtime inherited from parent |

**`session-changed` vs. controller events:** The `session-changed` DOM event is a convenience surface — it contains the same answer data as `item-session-data-changed` from the controller. For fine-grained control, type filtering, and item-scoped subscriptions, prefer the controller event stream.

---

## Navigation

### From the custom element JS API

```ts
const player = document.querySelector('pie-section-player-splitpane');

// Navigate programmatically
player.navigateNext();
player.navigatePrevious();
player.navigateTo(0); // go to first item

// Read navigation state
const nav = player.selectNavigation();
// { currentIndex, totalItems, canNext, canPrevious, currentItemId }

// Full snapshot
const snapshot = player.getSnapshot();
// { readiness, composition: { itemsCount, passagesCount }, navigation }
```

### From the controller

```ts
const controller = await player.waitForSectionController(5000);

// navigateToItem returns a NavigationResult or null
controller.navigateToItem(2);
```

### Implementing gated navigation

Use controller events to implement "must complete before advancing" policies:

```ts
let sectionComplete = false;

const unsubscribe = controller.subscribe((event) => {
  if (event.type === 'section-items-complete-changed') {
    sectionComplete = event.complete === true;
  }
});

function canAdvance() {
  const nav = player.selectNavigation();
  return nav?.canNext && sectionComplete;
}
```

---

## Session Persistence

The framework provides local persistence (localStorage) by default for development. For production, supply your own persistence strategy:

### Option 1: Listen to events and persist in your backend

```ts
player.addEventListener('session-changed', (e) => {
  debouncedPersist(e.detail);
});
```

### Option 2: Custom persistence strategy via hooks

```ts
coordinator.setHooks({
  // Called when the toolkit needs to save section state
  createSectionPersistence: (context, defaults) => ({
    async load(ctx) {
      return await fetchSessionFromBackend(ctx.key);
    },
    async save(ctx, snapshot) {
      await saveSessionToBackend(ctx.key, snapshot);
    },
    async clear(ctx) {
      await clearSessionInBackend(ctx.key);
    }
  })
});
```

### Option 3: Imperative persist

```ts
// Trigger a persist to the active strategy
await controller.persist();
```

---

## Lifecycle Hooks

The `ToolkitCoordinator` supports hooks for runtime customization:

```ts
player.addEventListener('toolkit-ready', (e) => {
  const coordinator = e.detail.coordinator;

  coordinator.setHooks({
    // Error handling
    onError: (error, context) => {
      reportToMonitoring(error, context.phase);
    },

    // Controller lifecycle
    onSectionControllerReady: (context, controller) => {
      console.log('Controller ready for', context.key.sectionId);
    },
    onSectionControllerDispose: (context, controller) => {
      console.log('Controller disposed for', context.key.sectionId);
    },

    // Custom controller factory (advanced)
    createSectionController: (context, defaults) => {
      // Return a custom controller or use the default
      return defaults.createDefaultController();
    },

    // Telemetry
    onTelemetry: (eventName, payload) => {
      analytics.track(eventName, payload);
    },

    // Tool state persistence
    loadToolState: async () => {
      return await loadToolStateFromBackend();
    },
    saveToolState: async (state) => {
      await saveToolStateToBackend(state);
    }
  });
});
```

---

## Angular Integration Example

Based on real-world usage in Angular applications:

### Module setup

```ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

### Component

```ts
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import { Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-assessment-page',
  template: `
    <pie-section-player-splitpane
      [runtime]="sectionPlayerRuntime"
      [section]="section"
      [attr.section-id]="sectionId"
      [attr.attempt-id]="attemptId"
      show-toolbar="true"
      toolbar-position="right"
      (toolkit-ready)="handleToolkitReady($event)"
      (session-changed)="handleSessionChanged($event)"
    ></pie-section-player-splitpane>
  `,
  styles: [`
    pie-section-player-splitpane {
      display: flex;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
  `]
})
export class AssessmentPageComponent implements OnDestroy {
  readonly assessmentId = 'my-assessment';
  readonly sectionId = 'section-1';
  readonly attemptId = 'attempt-abc';

  section = loadSection(); // your section data

  private controllerUnsubscribe?: () => void;

  readonly sectionPlayerRuntime = {
    assessmentId: this.assessmentId,
    tools: {
      providers: {
        calculator: {
          authFetcher: async () => {
            const res = await fetch('/api/tools/desmos/auth');
            return res.json();
          }
        },
        tts: { backend: 'browser' }
      },
      placement: {
        item: ['calculator', 'textToSpeech'],
        passage: ['textToSpeech']
      }
    }
  };

  handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;

    this.controllerUnsubscribe?.();
    this.controllerUnsubscribe = coordinator.subscribeSectionEvents({
      sectionId: this.sectionId,
      attemptId: this.attemptId,
      eventTypes: [
        'item-session-data-changed',
        'section-items-complete-changed',
        'section-loading-complete'
      ],
      listener: (event: unknown) => {
        const typed = event as { type?: string };
        console.log('[assessment] controller event:', typed.type, event);
      }
    }) || undefined;
  }

  handleSessionChanged(event: Event): void {
    const detail = (event as CustomEvent).detail;
    console.log('[assessment] session changed:', detail);
  }

  ngOnDestroy(): void {
    this.controllerUnsubscribe?.();
  }
}
```

---

## SvelteKit Integration Example

SvelteKit apps can bind to CE properties directly and use Svelte 5 reactivity for controller subscriptions. Since Svelte compiles custom element attributes to properties when the tag is unknown, complex objects (section, tools, env) work as props out of the box.

### Route page (`+page.svelte`)

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  import type { ToolkitCoordinatorHooks } from '@pie-players/pie-assessment-toolkit';
  import '@pie-players/pie-section-player/components/section-player-splitpane-element';

  // Section data — loaded from your API, CMS, or static content
  let { data }: { data: { section: any } } = $props();

  const ASSESSMENT_ID = 'my-assessment';
  const SECTION_ID = data.section?.identifier || 'section-1';
  const ATTEMPT_ID = `attempt-${Date.now().toString(36)}`;

  // Tool configuration
  const toolsConfig = {
    providers: {
      calculator: {
        authFetcher: async () => {
          const res = await fetch('/api/tools/desmos/auth');
          if (!res.ok) throw new Error(`Desmos auth failed: ${res.status}`);
          return res.json();
        }
      },
      tts: { enabled: true, backend: 'browser' }
    },
    placement: {
      section: ['theme'],
      item: ['calculator', 'textToSpeech', 'answerEliminator'],
      passage: ['textToSpeech']
    }
  };

  const env = $derived({
    mode: 'gather' as const,
    role: 'student' as const
  });

  // Coordinator and controller state
  let coordinator: any = $state(null);
  let controllerUnsubscribe: (() => void) | null = null;
  let sectionComplete = $state(false);
  let completionProgress = $state({ completed: 0, total: 0 });

  function handleToolkitReady(event: Event) {
    const detail = (event as CustomEvent).detail;
    coordinator = detail?.coordinator || null;

    coordinator?.setHooks?.({
      onError: (error: Error, context: { phase: string }) => {
        console.error('[Assessment] toolkit error:', context.phase, error);
      }
    } satisfies ToolkitCoordinatorHooks);

    // Subscribe to controller events via the coordinator
    controllerUnsubscribe?.();
    controllerUnsubscribe = coordinator?.subscribeSectionEvents?.({
      sectionId: SECTION_ID,
      attemptId: ATTEMPT_ID,
      eventTypes: [
        'item-session-data-changed',
        'section-items-complete-changed',
        'section-loading-complete'
      ],
      listener: (event: any) => {
        switch (event.type) {
          case 'item-session-data-changed':
            persistAnswer(event.canonicalItemId, event.session);
            break;
          case 'section-items-complete-changed':
            sectionComplete = event.complete === true;
            completionProgress = {
              completed: event.completedCount,
              total: event.totalItems
            };
            break;
          case 'section-loading-complete':
            console.log('Section loaded:', event.totalLoaded, 'items');
            break;
        }
      }
    }) ?? null;
  }

  async function persistAnswer(itemId: string, session: unknown) {
    try {
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, session })
      });
    } catch (err) {
      console.error('Failed to persist answer:', err);
    }
  }

  // Navigation helpers (bind to the CE element)
  let playerElement: HTMLElement | undefined = $state();

  function navigateNext() {
    (playerElement as any)?.navigateNext?.();
  }
  function navigatePrevious() {
    (playerElement as any)?.navigatePrevious?.();
  }

  onDestroy(() => {
    controllerUnsubscribe?.();
  });
</script>

<div class="assessment-page">
  <header class="assessment-header">
    <h1>Assessment</h1>
    <span>
      {completionProgress.completed}/{completionProgress.total} complete
    </span>
  </header>

  <pie-section-player-splitpane
    bind:this={playerElement}
    assessment-id={ASSESSMENT_ID}
    section-id={SECTION_ID}
    attempt-id={ATTEMPT_ID}
    player-type="iife"
    lazy-init={true}
    tools={toolsConfig}
    section={data.section}
    env={env}
    show-toolbar="true"
    toolbar-position="right"
    ontoolkit-ready={handleToolkitReady}
  ></pie-section-player-splitpane>

  <footer class="assessment-footer">
    <button onclick={navigatePrevious}>Previous</button>
    <button onclick={navigateNext} disabled={sectionComplete}>
      {sectionComplete ? 'Complete' : 'Next'}
    </button>
  </footer>
</div>

<style>
  .assessment-page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .assessment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
  }

  :global(pie-section-player-splitpane) {
    display: flex;
    flex: 1;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .assessment-footer {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 1rem;
  }
</style>
```

### Server route for Desmos auth (`+server.ts`)

```ts
// src/routes/api/tools/desmos/auth/+server.ts
import { json } from '@sveltejs/kit';
import { DESMOS_API_KEY } from '$env/static/private';

export function GET() {
  return json(DESMOS_API_KEY ? { apiKey: DESMOS_API_KEY } : {});
}
```

### Notes for SvelteKit

- **SSR:** The section player is a client-side custom element. Guard browser-only code with `import { browser } from '$app/environment'` and ensure CE imports happen at the top level of `<script>` (Svelte tree-shakes them to client-only automatically).
- **Event binding:** Svelte 5 supports `ontoolkit-ready={handler}` for custom element events directly. For Svelte 4, use `on:toolkit-ready={handler}`.
- **Property binding:** Complex objects (`section`, `tools`, `env`) are set as properties, not attributes. Svelte handles this automatically for custom elements.
- **`bind:this`:** Use it on the CE to call imperative methods like `navigateNext()`, `selectNavigation()`, and `waitForSectionController()`.

---

## Vanilla JS / Framework-Agnostic Example

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@pie-players/pie-section-player/components/section-player-splitpane-element';
  </script>
</head>
<body>
  <pie-section-player-splitpane
    id="player"
    assessment-id="demo"
    section-id="section-1"
    attempt-id="attempt-1"
    player-type="iife"
    show-toolbar="true"
    toolbar-position="right"
  ></pie-section-player-splitpane>

  <div id="status"></div>
  <button id="prev" disabled>Previous</button>
  <button id="next">Next</button>

  <script type="module">
    const player = document.getElementById('player');
    let coordinator = null;
    let controllerUnsub = null;

    // Set section content (your data)
    player.section = window.SECTION_DATA;
    player.env = { mode: 'gather', role: 'student' };
    player.tools = {
      placement: {
        item: ['calculator', 'textToSpeech'],
        passage: ['textToSpeech']
      },
      providers: {
        tts: { enabled: true, backend: 'browser' },
        calculator: {
          authFetcher: () => fetch('/api/tools/desmos/auth').then(r => r.json())
        }
      }
    };

    // Capture the coordinator
    player.addEventListener('toolkit-ready', (e) => {
      coordinator = e.detail.coordinator;
    });

    // Subscribe to controller events once ready
    player.addEventListener('section-controller-ready', (e) => {
      const controller = e.detail.controller;

      controllerUnsub?.();
      controllerUnsub = controller.subscribe((event) => {
        if (event.type === 'item-session-data-changed') {
          document.getElementById('status').textContent =
            `Answer updated: ${event.canonicalItemId}`;
          // Persist to your backend
          fetch('/api/sessions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: event.canonicalItemId,
              session: event.session
            })
          });
        }

        if (event.type === 'item-selected') {
          updateNavButtons();
        }
      });

      updateNavButtons();
    });

    function updateNavButtons() {
      const nav = player.selectNavigation();
      document.getElementById('prev').disabled = !nav?.canPrevious;
      document.getElementById('next').disabled = !nav?.canNext;
    }

    document.getElementById('prev').onclick = () => player.navigatePrevious();
    document.getElementById('next').onclick = () => player.navigateNext();
  </script>
</body>
</html>
```

---

## CSS / Layout Requirements

The section player needs a sized container. Without explicit height, the split pane will collapse:

```css
pie-section-player-splitpane,
pie-section-player-vertical {
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
```

For split-pane scrolling to work correctly:
- Parent containers must have `height: 100%` and `overflow: hidden`.
- Avoid broad responsive overrides that switch pane overflow to `visible`.
- See the [custom-elements-boundaries rule](../.cursor/rules/custom-elements-boundaries.mdc) for detailed constraints.

---

## Troubleshooting

### Tools don't appear

1. Verify the tool is listed in the correct `placement` level.
2. Check `policy.blocked` doesn't include it.
3. Ensure the tool's optional package is installed (e.g. `@pie-players/pie-tool-calculator-desmos`).
4. For calculator: ensure your `/api/tools/desmos/auth` endpoint returns a valid `{ apiKey }` response.

### Session events not firing

1. Make sure `env.mode` is `'gather'` (view/evaluate modes don't capture student input).
2. Check that `section-id` and `attempt-id` match between the player and your subscription call.
3. Use the debug tools during development:
   ```ts
   import '@pie-players/pie-section-player-tools-event-debugger';
   import '@pie-players/pie-section-player-tools-session-debugger';
   ```

### Controller is null

`waitForSectionController()` resolves once the toolkit has finished initializing. If it returns `null`:
1. Ensure `assessment-id` and `section-id` are set.
2. Ensure valid `section` data is provided.
3. Check for `runtime-error` events.

### Stale behavior after code changes

If you're developing against local package sources, remember that consumer apps import from `dist` output. Rebuild the package after source changes:

```bash
bun run --cwd packages/section-player build
bun run --cwd packages/assessment-toolkit build
```
