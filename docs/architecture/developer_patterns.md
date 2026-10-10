# Developer Patterns

This guide captures code-style and implementation patterns that help keep PIE Players stable, predictable, and easy to evolve.

Use this as practical guidance when adding features or fixing bugs.

## Svelte 5 Reactivity Patterns

Effect and subscription rules live in [`AGENTS.md`](../../AGENTS.md#svelte-subscription-safety).

## Controller and Event Contract

- Treat controller events as a forward-only stream.
- Do not depend on event replay for baseline state.
- Read current truth from explicit controller APIs (`getRuntimeState`, `getSession`), then apply future events.
- Keep debugger tools as consumers of controller state/events, not alternate state owners.

## Custom Element Boundaries

Import, packaging and DOM-hook rules live in [`AGENTS.md`](../../AGENTS.md#custom-element-import-and-packaging-boundaries).
Apps and demos render the published custom-element tags so packaging and runtime
issues surface during normal development.

## CE Communication Patterns

- Default to `@pie-players/pie-context` (Lit-style context-request protocol) for CE runtime dependency sharing.
- Use Svelte `setContext/getContext` only for strictly local component-tree coordination that does not cross CE/runtime boundaries.
- Use explicit controller/toolkit APIs for section-level runtime state and event streams (`getRuntimeState`, `getSession`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents`).
- Use custom DOM events for host integration boundaries, not as a primary internal state bus.
- Keep event direction explicit:
  - child-to-parent intent via component callbacks/context methods
  - section-runtime updates via controller events
  - host-facing integration via documented custom events
- Prefer typed payload contracts over ad-hoc event detail shapes.
- Avoid document-wide broadcast listeners for internal synchronization when a scoped context or controller stream exists.
- Do not mirror the same state across context + DOM events + local component state unless there is a clear boundary reason.

### Composition Context

A fact about *where* content renders — heading depth, media arbitration, region
scope, available width — is published by the container and resolved by whichever
descendant needs it. The container never enumerates its consumers. Every such
context needs three things declared together: a resolution order, a graceful
default for when no publisher is present, and a change signal. Omitting the
change signal makes resolvers pin the first value they see, silently.

See [`composition-context.md`](./composition-context.md) for the pattern, its
invariants, and the worked heading-depth example.

### Communication Rule of Thumb

- Same CE/runtime dependency scope: `@pie-players/pie-context`.
- Same local Svelte-only tree (non-CE boundary): Svelte context.
- Same runtime scope across components: controller/toolkit API.
- External host integration: custom element events.

### Examples

#### 1) CE runtime context via `@pie-players/pie-context`

```ts
import { ContextProvider, createContext } from "@pie-players/pie-context";

const cardRenderContext = createContext<{
  resolvedPlayerTag: string;
  runPlayerAction: (action: string, payload?: unknown) => void;
}>(Symbol.for("@pie-players/pie-section-player/card-render-context"));

const provider = new ContextProvider(host, {
  context: cardRenderContext,
  initialValue: { resolvedPlayerTag, runPlayerAction },
});
provider.connect();
```

```ts
import { ContextConsumer } from "@pie-players/pie-context";

const consumer = new ContextConsumer(host, {
  context: cardRenderContext,
  subscribe: true,
  onValue: (value: {
    resolvedPlayerTag: string;
    runPlayerAction: (action: string, payload?: unknown) => void;
  }) => {
    // use value in component logic
  },
});
consumer.connect();
```

#### 1b) Local-only composition via Svelte context

```ts
import { setContext, getContext } from "svelte";

setContext("local-card-config", { density: "compact" });
const localCardConfig = getContext<{ density: "compact" | "comfortable" }>(
  "local-card-config",
);
```

#### 2) Runtime-wide state/events via controller API

```ts
// `subscribe*` follows the toolkit's active section cohort — a single
// subscribe call survives navigation between sections without re-wiring.
// Subscribe after the first `getOrCreateSectionController(...)` resolves.
const unsubscribeItem = coordinator.subscribeItemEvents({
  listener: (event) => {
    handleItemEvent(event);
  },
});
const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event) => {
    handleSectionEvent(event);
  },
});
const unsubscribe = () => {
  unsubscribeItem?.();
  unsubscribeSection?.();
};

// `getSectionController` is unchanged — still keyed by id, useful for
// reading state from inactive (persisted) sections.
const runtimeState = coordinator
  .getSectionController?.({ sectionId, attemptId })
  ?.getRuntimeState?.();
```

#### 3) Host boundary via custom element events

```ts
element.dispatchEvent(
  new CustomEvent("session-changed", {
    detail: { ...session, itemId, canonicalItemId },
    bubbles: true,
    composed: true,
  }),
);
```

#### Notes

- If communication must cross CE boundaries or shadow/light DOM, do not use Svelte context alone.
- For a provider that may connect after its consumer, subscribe (`subscribe: true`, or `connectContextWithRetry`). The consumer installs the document's `ContextRoot`, which replays the request when the provider announces itself; components do not attach roots of their own.
- Keep context values typed and versioned when needed to avoid stale payload assumptions.

## Theming Contract (Shadow-Safe)

The theme model, resolution order and entrypoints are in
[`how-theming-works.md`](../theming/how-theming-works.md) and the
[`@pie-players/pie-theme` README](../../packages/theme/README.md). Component
authors:

- In shadow-DOM CEs, style internals from `:host` tokens and expose host customization via documented `::part(...)`/attributes only when needed.
- In light-DOM CEs, avoid depending on host app utility classes; still consume the same `--pie-*` variables so migration to `shadow: "open"` stays incremental.
- Include interaction/accessibility tokens (`--pie-focus-*`, `--pie-button-*`) in component styles; avoid hardcoded color literals for focus/active/hover states.
- Theme switching and scheme/provider registration must update existing nodes
  (light and shadow) without remounts.
- Cover forced-colors behavior without `forced-color-adjust: none`; system color
  replacement is an accessibility feature.

## DOM Usage Rules

- Keep DOM listeners scoped to the nearest host/container element; avoid `document`/`window` listeners for internal coordination unless there is no scoped alternative.
- Always clean up listeners/observers/timers in effect teardown.
- Treat DOM events as boundary signals, not primary internal state storage.
- Prefer controller/context state as source of truth; derive DOM from state, not state from incidental DOM queries.
- Use typed and documented `CustomEvent` payloads; prefer `bubbles: true` and `composed: true` for host-boundary events.
- In light-DOM CEs, use stable `pie-*` / `data-pie-*` selectors and avoid fragile generic class hooks.
- Avoid broad query selectors over the full document when a host-scoped query is possible.
- Use event dedupe/intent guards when normalizing low-level player events into canonical runtime events.

## Build and Validation Workflow

Rebuild and boundary-check rules for CE changes live in [`AGENTS.md`](../../AGENTS.md#custom-element-import-and-packaging-boundaries).

## Types and Utilities Ownership

- Shared types live with their canonical owner. New symbols take no `I*` prefix, write acronyms as Pascal words (`Pnp`, `Pie`, `Tts`), name booleans `is*`/`has*`/`can*`/`should*`, and name events `*-changed` for post-state and `*-change` for intent; type-only imports use `import type`.
- Use canonical API names from `@pie-players/pie-assessment-toolkit` (`ToolCoordinatorApi`, `ToolkitCoordinatorApi`, `TtsServiceApi`, `ToolProviderApi`) instead of older `I*` interface names in new docs/examples.
- Re-export shared contracts instead of re-defining near-identical shapes in multiple packages.
- For cross-package constants (for example layering/z-index enums), import from the canonical package owner and re-export locally only when needed for consumer convenience.

## E2E Test Stability

- Prefer semantic role/structure selectors over brittle text where markup timing can vary (for example math content).
- Add explicit readiness steps before interactions (`scrollIntoViewIfNeeded`, visibility checks, expected counts).
- Avoid running Playwright specs in parallel when they share a single web-server setup in the same workspace.
- Verify flaky failures by rerunning the failing spec in isolation before changing app code.

## Quick Anti-Patterns

- Effect body subscribes and mutates tracked state in the same path.
- Resubscribe logic keyed by object identity from service lookups.
- Debugger initialization that assumes replayed events must appear.
- CE source edits validated in consumer app without package rebuild.
- Internal component coordination implemented through `document.addEventListener(...)` instead of context/controller contracts.
