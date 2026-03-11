# Developer Patterns

This guide captures code-style and implementation patterns that help keep PIE Players stable, predictable, and easy to evolve.

Use this as practical guidance when adding features or fixing bugs.

## Svelte 5 Reactivity Patterns

- Keep `$effect` focused on wiring (subscribe/unsubscribe, setup/teardown), not UI state mutation.
- If setup must read/write reactive state (for example seed debugger rows), wrap setup in `untrack(() => { ... })`.
- Make subscription setup idempotent: if `sectionId` and `attemptId` did not change and a subscription exists, return early.
- Prefer stable key checks (`sectionId`, `attemptId`) over controller object identity for rebinding decisions.
- Queue lifecycle-driven rebinds with `queueMicrotask` to avoid synchronous re-entrant update loops.
- On lifecycle `"disposed"` events, detach first, then queue rebind.

## Controller and Event Contract

- Treat controller events as a forward-only stream.
- Do not depend on event replay for baseline state.
- Read current truth from explicit controller APIs (`getRuntimeState`, `getSession`), then apply future events.
- Keep debugger tools as consumers of controller state/events, not alternate state owners.

## Custom Element Boundaries

- Import CE registration entrypoints from package exports, not package `src` files.
- Dogfood CE consumption inside this monorepo the same way external consumers do: use package export entrypoints (for example `@pie-players/<pkg>/components/...`) instead of local source imports.
- Prefer CE tag usage in apps/demos and integration surfaces where CEs are the published contract, so packaging/runtime issues surface during normal development.
- Do not use cross-package `?customElement` imports.
- Keep runtime exports pointing to `dist` artifacts for publishable packages.
- Use stable `pie-*` or `data-pie-*` hooks for light-DOM custom-element selectors/classes.

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
const unsubscribeItem = toolkitCoordinator.subscribeItemEvents({
  sectionId,
  attemptId,
  listener: (event) => {
    handleItemEvent(event);
  },
});
const unsubscribeSection = toolkitCoordinator.subscribeSectionLifecycleEvents({
  sectionId,
  attemptId,
  listener: (event) => {
    handleSectionEvent(event);
  },
});
const unsubscribe = () => {
  unsubscribeItem?.();
  unsubscribeSection?.();
};

const runtimeState = toolkitCoordinator
  .getSectionController?.({ sectionId, attemptId })
  ?.getRuntimeState?.();
```

#### 3) Host boundary via custom element events

```ts
element.dispatchEvent(
  new CustomEvent("pie-ready", {
    detail: { sectionId, attemptId },
    bubbles: true,
    composed: true,
  }),
);
```

#### Notes

- If communication must cross CE boundaries or shadow/light DOM, do not use Svelte context alone.
- For late-provider timing, prefer `ContextRoot` + subscribe/retry patterns from `@pie-players/pie-context` consumers.
- Keep context values typed and versioned when needed to avoid stale payload assumptions.

## Theming Contract (Shadow-Safe)

- Treat `--pie-*` CSS variables as the stable public theming API for both light-DOM and shadow-DOM CEs.
- Keep a single source of truth in `@pie-players/pie-theme` for defaults and built-in color schemes; consumers should read from `listPieColorSchemes()` instead of duplicating scheme catalogs.
- Resolve theme values in this order: base theme (`light`/`dark`/`auto`) -> provider variables -> color-scheme variables -> explicit `variables` overrides.
- In shadow-DOM CEs, style internals from `:host` tokens and expose host customization via documented `::part(...)`/attributes only when needed.
- In light-DOM CEs, avoid depending on host app utility classes; still consume the same `--pie-*` variables so migration to `shadow: "open"` stays incremental.
- Include interaction/accessibility tokens (`--pie-focus-*`, `--pie-button-*`) in component styles; avoid hardcoded color literals for focus/active/hover states.
- Theme switching must update existing nodes (light and shadow) without remounts; keep E2E coverage for live scheme switching.

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

- After changing CE package `src`, rebuild that package before validating in a consumer app.
- If behavior appears unchanged after source edits, suspect stale `dist` first.
- Run boundary checks for CE-related changes:
  - `bun run check:source-exports`
  - `bun run check:consumer-boundaries`
  - `bun run check:custom-elements`

## Types and Utilities Ownership

- Use the canonical contract map in `docs/architecture/types-and-utilities-contract.md` when adding or changing shared type/utility symbols.
- Use canonical API names from `@pie-players/pie-assessment-toolkit` (`ToolCoordinatorApi`, `ToolkitCoordinatorApi`, `TtsServiceApi`, `ToolProviderApi`) and avoid legacy `I*` contracts.
- Re-export shared contracts instead of re-defining near-identical shapes in multiple packages.
- For cross-package constants (for example layering/z-index enums), import from the canonical package owner and re-export locally only when needed for compatibility.

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
