# Developer Patterns

Implementation patterns for contributors to PIE Players: how custom elements
share state and events, component theming, DOM usage, type naming and
end-to-end test stability. They keep the players stable, predictable and easy
to evolve.

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

## Custom Element Communication

- Default to `@pie-players/pie-context` (Lit-style context-request protocol) for runtime dependencies shared between custom elements.
- Use Svelte `setContext/getContext` only for strictly local component-tree coordination that does not cross custom element or runtime boundaries.
- Use explicit controller/toolkit APIs for section-level runtime state and event streams (`getRuntimeState`, `getSession`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents`).
- Use custom DOM events for host integration boundaries, not as a primary internal state bus.
- Keep event direction explicit:
  - child-to-parent intent via component callbacks/context methods
  - section-runtime updates via controller events
  - host-facing integration via documented custom events
- Prefer typed payload contracts over ad-hoc event detail shapes.
- Avoid document-wide broadcast listeners for internal synchronization when a scoped context or controller stream exists.
- Do not mirror the same state across context + DOM events + local component state unless there is a clear boundary reason.

Facts about where content renders — heading depth, media arbitration, region
scope, available width — follow the
[composition context](./composition-context.md) pattern: the container
publishes, the descendant that needs the fact resolves it, and each context
declares a resolution order, a default and a change signal.

### Examples

#### Shared runtime context with `@pie-players/pie-context`

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

#### Local composition with Svelte context

```ts
import { setContext, getContext } from "svelte";

setContext("local-card-config", { density: "compact" });
const localCardConfig = getContext<{ density: "compact" | "comfortable" }>(
  "local-card-config",
);
```

#### Section state and events through the coordinator

```ts
// `subscribe*` follows the toolkit's active section cohort, the
// `(sectionId, attemptId)` pair whose controller is active, so one subscribe
// call survives navigation between sections without re-wiring.
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

// `getSectionController` is keyed by `(sectionId, attemptId)`, so it also
// reads state from inactive (persisted) sections.
const runtimeState = coordinator
  .getSectionController?.({ sectionId, attemptId })
  ?.getRuntimeState?.();
```

#### Host boundary events

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

- If communication must cross custom element boundaries or shadow/light DOM, do not use Svelte context alone.
- For a provider that may connect after its consumer, subscribe (`subscribe: true`, or `connectContextWithRetry`). The consumer installs the document's `ContextRoot`, which replays the request when the provider announces itself; components do not attach roots of their own.
- Keep context values typed and versioned when needed to avoid stale payload assumptions.

## Theming Contract

Component theming rules — shadow and light DOM, interaction tokens, updates
without remounts and forced colors — are in the
[`@pie-players/pie-theme` README](../../packages/theme/README.md#light-dom-and-shadow-dom).
[How theming works](../theming/how-theming-works.md) explains the theme model
and resolution order.

## DOM Usage Rules

- Keep DOM listeners scoped to the nearest host/container element; avoid `document`/`window` listeners for internal coordination unless there is no scoped alternative.
- Always clean up listeners/observers/timers in effect teardown.
- Treat DOM events as boundary signals, not primary internal state storage.
- Prefer controller/context state as source of truth; derive DOM from state, not state from incidental DOM queries.
- Use typed and documented `CustomEvent` payloads; prefer `bubbles: true` and `composed: true` for host-boundary events.
- In light-DOM custom elements, use stable `pie-*` / `data-pie-*` selectors and avoid fragile generic class hooks.
- Avoid broad query selectors over the full document when a host-scoped query is possible.
- Use event dedupe/intent guards when normalizing low-level player events into canonical runtime events.

## Build and Validation Workflow

Rebuild and boundary-check rules for custom element changes live in [`AGENTS.md`](../../AGENTS.md#custom-element-import-and-packaging-boundaries).

## Types and Utilities Ownership

- Shared types live with their canonical owner. New symbols take no `I*` prefix, write acronyms as Pascal words (`Pnp`, `Pie`, `Tts`), name booleans `is*`/`has*`/`can*`/`should*`, and name events `*-changed` for post-state and `*-change` for intent; type-only imports use `import type`.
- Use the canonical API names from `@pie-players/pie-assessment-toolkit` in docs and examples: `ToolCoordinatorApi`, `ToolkitCoordinatorApi`, `TtsServiceApi`, and `ToolProviderApi` from its `tools/registration` entry.
- A contract interface takes no type parameter that appears only in argument position: method parameters compare bivariantly, so such a parameter constrains nothing. A provider narrows its config in its own method signatures ([ADR 0002](../adr/0002-provider-contracts-are-not-parameterized-by-config.md)).
- A package that is only a dev dependency, or an optional peer, is named only inside function bodies. Declaration emit keeps `implements` clauses and public return types, so a top-level `import type` of it lands in the published `.d.ts` and breaks consumers type-checking without `skipLibCheck` ([ADR 0002](../adr/0002-provider-contracts-are-not-parameterized-by-config.md#consequences)).
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
- Custom element source edits validated in a consumer app without a package rebuild.
- Internal component coordination implemented through `document.addEventListener(...)` instead of context/controller contracts.
