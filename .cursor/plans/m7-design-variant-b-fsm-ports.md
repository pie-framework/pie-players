# M7 Design — Variant B: Explicit FSM + Ports

> Engine = explicit finite state machine + four injectable ports.
> Common host pays for one factory call; advanced hosts pay one extra port to
> swap a default. Internal layout CEs and `<pie-assessment-toolkit>` retire
> their hand-rolled stage progression and call into the engine.

This document is a **design**, not an implementation. It cites real symbols
and file paths so the build sequence is unambiguous.

---

## 0. Vocabulary

- **Engine** — the consolidated runtime owner. Today's seed is
  `packages/assessment-toolkit/src/runtime/SectionRuntimeEngine.ts`. M7
  expands it to also own runtime resolution, readiness emission, and
  coordinator lifecycle.
- **Port** — a small, declarative TypeScript interface the engine consumes
  to interact with one external concern. Each port has a default
  implementation (the production wiring) and an obvious test fake.
- **FSM** — finite state machine. States, triggers, and the transition
  table are first-class data the engine exports for tests and host
  instrumentation.
- **Cohort** — the `(sectionId, attemptId)` pair. A new cohort resets the
  FSM and the stage tracker.
- **Stage** — the M6 canonical readiness vocabulary
  (`composed | engine-ready | interactive | disposed`), defined in
  `packages/players-shared/src/pie/stages.ts`.

---

## 1. Public API surface

All new types/values listed in this section are exported from
`@pie-players/pie-assessment-toolkit` (see §2 for exact `dist`-published
paths). Backward compatibility for any pre-M7 export is **not preserved**
unless the symbol is part of the `pie-item` client contract — which none of
these are.

### 1.1 Stage / cohort identity

```ts
import type { Stage, StageChangeDetail, LoadingCompleteDetail } from
  "@pie-players/pie-players-shared/pie";

// `Stage` and `StageChangeDetail` already exist (M6); reused verbatim.

export type CohortKey = {
  sectionId: string;
  attemptId?: string;
};
```

### 1.2 FSM types

```ts
export type EngineState =
  | "idle"             // constructed, not attached
  | "attaching"        // attach() called, ports not yet resolved
  | "resolving"        // RuntimePort returning effectiveRuntime
  | "acquiring"        // CoordinatorPort.acquire()
  | "composing"        // controller acquired, awaiting first composition
  | "composed"         // composition snapshot landed
  | "engine-ready"     // coordinator.waitUntilReady() resolved
  | "interactive"      // readiness-gate satisfied
  | "loading-complete" // every item loaded (sub-state of `interactive`)
  | "failed"           // terminal-ish; recoverable via reset()
  | "disposing"
  | "disposed";

export type EngineTrigger =
  | { kind: "attach"; inputs: EngineAttachInputs }
  | { kind: "inputs-resolved" }
  | { kind: "coordinator-acquired" }
  | { kind: "controller-acquired" }
  | { kind: "composition-changed"; composition: unknown }
  | { kind: "coordinator-ready" }
  | { kind: "coordinator-failed"; error: unknown }
  | { kind: "controller-failed"; error: unknown }
  | { kind: "readiness-signals-changed"; signals: ReadinessSignals }
  | { kind: "cohort-changed"; cohort: CohortKey }
  | { kind: "dispose" };

export type EngineTransition = {
  from: EngineState;
  to: EngineState;
  trigger: EngineTrigger;
  timestamp: string;
  cohort: CohortKey;
};

export type ReadinessSignals = {
  sectionReady: boolean;
  interactionReady: boolean;
  allLoadingComplete: boolean;
  runtimeError: boolean;
};

/** Static, enumerable transition table; suitable for tests, telemetry,
 *  and host introspection. */
export const ENGINE_TRANSITIONS: ReadonlyArray<{
  from: EngineState;
  on: EngineTrigger["kind"];
  to: EngineState;
  emitsStage?: Stage;
  emitsStageStatus?: "entered" | "failed" | "skipped";
}>;
```

### 1.3 Engine attach inputs

`EngineAttachInputs` is **the** input shape the engine accepts. It mirrors
the prop surface of `<pie-assessment-toolkit>` and the layout CEs but is
narrower and typed.

```ts
import type {
  RuntimeConfig,
  RuntimeInputs,            // moved into engine; see §5
} from "@pie-players/pie-assessment-toolkit/runtime/runtime-config";

export type EngineAttachInputs = {
  host: HTMLElement;          // CE host element (used for cross-boundary events)
  cohort: CohortKey;
  sectionView: string;        // candidate | scorer | author
  section: unknown;
  // Two-tier resolution inputs (mirrors RuntimeInputs).
  runtimeInputs: RuntimeInputs;
  // Optional: inject host-side overrides for any port.
  ports?: Partial<EnginePorts>;
};
```

### 1.4 Subscription API

Three subscription channels, all returning a typed disposer:

```ts
export type Disposer = () => void;

export interface SectionRuntimeEngineApi {
  // FSM
  getState(): EngineState;
  getCohort(): CohortKey | null;
  subscribeTransitions(listener: (t: EngineTransition) => void): Disposer;

  // Stage emission (mirrors M6)
  subscribeStageChange(listener: (detail: StageChangeDetail) => void): Disposer;
  subscribeLoadingComplete(listener: (detail: LoadingCompleteDetail) => void): Disposer;

  // Legacy readiness chain (kept until a future major rips it; this
  // milestone consolidates emission into the engine, not removes it).
  subscribeReadinessChange(
    listener: (detail: SectionPlayerReadinessChangeDetail) => void,
  ): Disposer;
  subscribeInteractionReady(
    listener: (detail: SectionPlayerReadinessChangeDetail) => void,
  ): Disposer;
  subscribeFinalReady(
    listener: (detail: SectionPlayerReadinessChangeDetail) => void,
  ): Disposer;

  // Framework errors (M3 bus pass-through)
  subscribeFrameworkErrors(
    listener: (model: FrameworkErrorModel) => void,
  ): Disposer;

  // Lifecycle
  attach(inputs: EngineAttachInputs): Promise<void>;
  reportReadinessSignals(signals: ReadinessSignals): void;
  reportControllerError(error: unknown): void;
  cohortChanged(cohort: CohortKey): void;
  dispose(): Promise<void>;

  // Read-only views (the engine owns truth for these)
  getEffectiveRuntime(): Record<string, unknown> | null;
  getCompositionModel(): unknown;
  getSectionController(): SectionControllerHandle | null;
  waitForSectionController(timeoutMs?: number): Promise<SectionControllerHandle | null>;

  // Existing seed surface (kept; mostly delegated to the controller)
  register(detail: RuntimeRegistrationDetail): boolean;
  unregister(element: HTMLElement): boolean;
  getCanonicalItemId(itemId: string): string;
  handleContentRegistered(detail: RuntimeRegistrationDetail): void;
  handleContentUnregistered(detail: RuntimeRegistrationDetail): void;
  handleContentLoaded(args: { /* see seed */ }): void;
  handleItemPlayerError(args: { /* see seed */ }): void;
  reportSectionError(args: { /* see seed */ }): void;
  updateItemSession(itemId: string, session: unknown): unknown;
  navigateToItem(index: number): unknown;
  persist(): Promise<void>;
  hydrate(): Promise<void>;
}
```

### 1.5 Port set

```ts
export interface EnginePorts {
  coordinator: CoordinatorPort;
  runtime: RuntimePort;
  readiness: ReadinessPort;
  frameworkError: FrameworkErrorPort;
}

export interface CoordinatorPort {
  /** Resolve / construct / accept the coordinator for this attach. */
  acquire(args: {
    host: HTMLElement;
    runtimeInputs: RuntimeInputs;
    effectiveRuntime: Record<string, unknown>;
    frameworkErrorBus: FrameworkErrorReporter;
  }): Promise<{ coordinator: ToolkitCoordinatorApi; ownership: "owned" | "inherited" | "external" }>;

  /** Subscribed for the coordinator-ready stage signal. */
  waitUntilReady(coordinator: ToolkitCoordinatorApi): Promise<void>;

  /** Acquire / create section controller. */
  getOrCreateSectionController(args: {
    coordinator: ToolkitCoordinatorApi;
    cohort: CohortKey;
    section: unknown;
    assessmentId: string;
    sectionView: string;
    createDefaultController: () => Promise<SectionControllerHandle> | SectionControllerHandle;
  }): Promise<SectionControllerHandle>;

  /** Tear down a section controller and (if owned) the coordinator. */
  release(args: {
    coordinator: ToolkitCoordinatorApi;
    cohort: CohortKey;
    ownership: "owned" | "inherited" | "external";
  }): Promise<void>;
}

export interface RuntimePort {
  /** Two-tier resolver: prop/attribute inputs in, effectiveRuntime out. */
  resolve(inputs: RuntimeInputs): {
    effectiveToolsConfig: unknown;
    effectiveRuntime: Record<string, unknown>;
    playerRuntime: ResolvedPlayerRuntime;
  };
}

export interface ReadinessPort {
  /** Bind to the FSM; called once by the engine. */
  bind(args: {
    host: HTMLElement;
    runtimeId: string;
    sourceCe: string;
    sourceCeShape: "toolkit" | "layout";
    cohort: CohortKey;
  }): void;

  /** Cohort changed → reset stage tracker, re-arm legacy emit latches. */
  resetCohort(cohort: CohortKey): void;

  /** Stage progression (M6). */
  emitStage(stage: Stage, status?: "entered" | "failed" | "skipped"): void;

  /** Legacy readiness chain. */
  emitReadinessChange(detail: SectionPlayerReadinessChangeDetail): void;
  emitInteractionReady(detail: SectionPlayerReadinessChangeDetail): void;
  emitFinalReady(detail: SectionPlayerReadinessChangeDetail): void;

  /** Companion to `interactive` — fires once per cohort. */
  emitLoadingComplete(detail: LoadingCompleteDetail): void;

  /** Local subscription channels (engine surfaces these on its API). */
  onStageChange(listener: (d: StageChangeDetail) => void): Disposer;
  onLoadingComplete(listener: (d: LoadingCompleteDetail) => void): Disposer;
  onReadinessChange(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
  onInteractionReady(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
  onFinalReady(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
}

export interface FrameworkErrorPort
  extends FrameworkErrorReporter,
          FrameworkErrorPortReadable {
  /** Bus passes through to engine subscribers. */
}

export interface FrameworkErrorPortReadable {
  subscribeFrameworkErrors(listener: FrameworkErrorListener): Disposer;
  /** Detach all listeners (engine.dispose()). */
  dispose(): void;
}
```

### 1.6 Concrete factory + class

```ts
export class SectionRuntimeEngine implements SectionRuntimeEngineApi {
  // Constructor takes ports. No magic.
  constructor(ports: EnginePorts);

  // Static FSM (data, not behavior).
  static readonly transitions: typeof ENGINE_TRANSITIONS;
}

/**
 * Common-host one-liner. Wires:
 *   - DefaultRuntimePort       (folds resolveSectionPlayerRuntimeState)
 *   - DefaultCoordinatorPort   (owns / inherits ToolkitCoordinator)
 *   - DefaultReadinessPort     (wraps createStageTracker + legacy chain)
 *   - DefaultFrameworkErrorPort (wraps FrameworkErrorBus)
 *
 * Pass `overrides` to swap a single port (test, alt host).
 */
export function createSectionRuntimeEngine(
  overrides?: Partial<EnginePorts>,
): SectionRuntimeEngine;
```

### 1.7 Default port export paths

Each default port is exported individually so a host that wants to swap one
port can still construct the others from the package:

```ts
export { DefaultRuntimePort } from
  "@pie-players/pie-assessment-toolkit/runtime/ports/runtime-port";
export { DefaultCoordinatorPort } from
  "@pie-players/pie-assessment-toolkit/runtime/ports/coordinator-port";
export { DefaultReadinessPort } from
  "@pie-players/pie-assessment-toolkit/runtime/ports/readiness-port";
export { DefaultFrameworkErrorPort } from
  "@pie-players/pie-assessment-toolkit/runtime/ports/framework-error-port";
```

---

## 2. File structure

All source paths under `packages/assessment-toolkit/src/runtime/` and
`packages/section-player/src/`.

### 2.1 Files that move (assessment-toolkit gains new ownership)

| From | To | Reason |
|------|----|--------|
| `packages/section-player/src/components/shared/section-player-runtime.ts` (logic only) | `packages/assessment-toolkit/src/runtime/runtime-config.ts` (new) | Two-tier resolver belongs to the engine. The 15-key `RuntimeConfig` type + `RuntimeInputs` + `resolveSectionPlayerRuntimeState` move here. |
| The stage tracker construction + cohort latches in `SectionPlayerLayoutKernel.svelte` (lines ~200–593) | `packages/assessment-toolkit/src/runtime/ports/readiness-port.ts` (new) | Single emit source. Kernel becomes a thin adapter to `ReadinessPort`. |
| The stage tracker construction + cohort latches in `PieAssessmentToolkit.svelte` (lines ~204–270, ~1176–1274) | same file as above | One emit source; toolkit becomes a thin adapter to `ReadinessPort`. |
| `buildOwnedCoordinator(...)` + `effectiveCoordinator` derivation in `PieAssessmentToolkit.svelte` (lines ~628–689) | `packages/assessment-toolkit/src/runtime/ports/coordinator-port.ts` (new) | Coordinator lifecycle owned by the engine via the port. |

### 2.2 Files that stay but are simplified

- `packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte`
  — keeps DOM composition / slot wiring; replaces `resolveSectionPlayerRuntimeState`
  + `createStageTracker` + cohort latches + readiness `$effect` chain with one
  `engine.attach(...)` + a small set of subscriptions. Loses `~250` lines of
  state-machine logic.
- `packages/assessment-toolkit/src/components/PieAssessmentToolkit.svelte`
  — drops `sectionEngine`, `stageTracker`, `frameworkErrorBus`, `ownedCoordinator`,
  the `buildOwnedCoordinator` helper, and every `$effect` that maintained
  stage / readiness state. CE becomes a Svelte adapter that owns
  `connectedCallback → engine.attach`, `disconnectedCallback → engine.dispose`,
  context provision (`assessmentToolkitRuntimeContext`,
  `assessmentToolkitHostRuntimeContext`), and the error banner.
- `packages/section-player/src/components/PieSectionPlayerBaseElement.svelte`
  — keeps two-tier resolution wiring at the CE boundary as a passthrough; the
  imperative `toolkitElement.onFrameworkError = effectiveOnFrameworkError`
  shim (lines 271–289) goes away because the engine owns the bus.
- `packages/section-player/src/contracts/public-events.ts` — unchanged (event
  names are wire contract).
- `packages/section-player/src/components/shared/section-player-readiness.ts`
  — unchanged. `createReadinessDetail` stays pure and is used by the engine.
- `packages/players-shared/src/pie/stage-tracker.ts` — unchanged. Engine's
  `DefaultReadinessPort` wraps it.
- `packages/players-shared/src/pie/stages.ts` — unchanged.
- `packages/assessment-toolkit/src/services/framework-error-bus.ts` — unchanged.
  `DefaultFrameworkErrorPort` wraps it.

### 2.3 New files under `packages/assessment-toolkit/src/runtime/`

```
runtime/
├── SectionRuntimeEngine.ts          (rewritten; was a thin wrapper, now the FSM owner)
├── engine-fsm.ts                    (transition table + reducer; pure)
├── engine-types.ts                  (EngineState, EngineTrigger, EngineTransition, …)
├── runtime-config.ts                (moved from section-player; resolveRuntime, RuntimeConfig, RuntimeInputs)
├── default-runtime-engine.ts        (createSectionRuntimeEngine factory)
├── ports/
│   ├── coordinator-port.ts          (CoordinatorPort + DefaultCoordinatorPort)
│   ├── runtime-port.ts              (RuntimePort + DefaultRuntimePort)
│   ├── readiness-port.ts            (ReadinessPort + DefaultReadinessPort)
│   └── framework-error-port.ts      (FrameworkErrorPort + DefaultFrameworkErrorPort)
└── (existing files: RuntimeRegistry.ts, registration-events.ts,
   runtime-id.ts, runtime-event-guards.ts, session-event-emitter-policy.ts,
   tool-host-contract.ts — unchanged)
```

### 2.4 Files that disappear

- `packages/section-player/src/components/shared/section-player-runtime.ts`
  is **deleted** after the move. The `RuntimeConfig` type re-export moves
  to a thin shim file `packages/section-player/src/components/shared/runtime-config-shim.ts`
  that re-exports from `@pie-players/pie-assessment-toolkit` to keep the
  import paths inside the section-player package short. **No alias map**.
- `packages/section-player/src/components/shared/section-player-stage-tracker.ts`
  (already a one-line re-export) is **deleted**; consumers go through the
  engine.

### 2.5 New `dist`-published exports

Added to `packages/assessment-toolkit/package.json` `exports`:

```json
{
  "./runtime": {
    "types": "./dist/runtime/index.d.ts",
    "import": "./dist/runtime/index.js"
  },
  "./runtime/ports/coordinator": { "types": "...", "import": "..." },
  "./runtime/ports/runtime":     { "types": "...", "import": "..." },
  "./runtime/ports/readiness":   { "types": "...", "import": "..." },
  "./runtime/ports/framework-error": { "types": "...", "import": "..." }
}
```

A new `packages/assessment-toolkit/src/runtime/index.ts` barrel re-exports
the engine, the factory, the FSM types, the port interfaces, and the
default port classes. No new CE entrypoints — the engine ships as plain JS.

`packages/section-player/package.json` adds **no new** exports; the
section-player package consumes the engine via the `dist` barrel.

---

## 3. State machine

### 3.1 Mermaid

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> attaching: attach
    attaching --> resolving: inputs-resolved
    resolving --> acquiring: (auto, sync)
    acquiring --> composing: coordinator-acquired
    acquiring --> failed: coordinator-failed
    composing --> composed: composition-changed
    composing --> failed: controller-failed
    composed --> engine-ready: coordinator-ready
    composed --> failed: coordinator-failed
    engine-ready --> interactive: readiness-signals-changed (gate ok)
    interactive --> loading-complete: readiness-signals-changed (allLoadingComplete)
    interactive --> interactive: readiness-signals-changed
    loading-complete --> loading-complete: readiness-signals-changed
    state failed {
        [*] --> recoverable
    }
    failed --> attaching: attach (after reset)
    composing --> disposing: dispose
    composed --> disposing: dispose
    engine-ready --> disposing: dispose
    interactive --> disposing: dispose
    loading-complete --> disposing: dispose
    failed --> disposing: dispose
    attaching --> disposing: dispose
    resolving --> disposing: dispose
    acquiring --> disposing: dispose
    disposing --> disposed: (auto)
    interactive --> composing: cohort-changed
    loading-complete --> composing: cohort-changed
    composed --> composing: cohort-changed
    engine-ready --> composing: cohort-changed
```

### 3.2 Transition table

| from              | trigger                            | to                  | emits stage          |
|-------------------|------------------------------------|---------------------|----------------------|
| `idle`            | `attach`                           | `attaching`         | —                    |
| `attaching`       | `inputs-resolved`                  | `resolving`         | —                    |
| `resolving`       | (auto)                             | `acquiring`         | —                    |
| `acquiring`       | `coordinator-acquired`             | `composing`         | —                    |
| `acquiring`       | `coordinator-failed`               | `failed`            | `engine-ready:failed` |
| `composing`       | `composition-changed`              | `composed`          | `composed:entered`    |
| `composing`       | `controller-failed`                | `failed`            | `engine-ready:skipped`, `interactive:failed` |
| `composed`        | `coordinator-ready`                | `engine-ready`      | `engine-ready:entered` |
| `composed`        | `coordinator-failed`               | `failed`            | `engine-ready:failed` |
| `engine-ready`    | `readiness-signals-changed` (gate) | `interactive`       | `interactive:entered` |
| `engine-ready`    | `readiness-signals-changed` (¬gate)| `engine-ready`      | —                    |
| `interactive`     | `readiness-signals-changed` (loaded)| `loading-complete` | —                    |
| `loading-complete`| `readiness-signals-changed`        | `loading-complete`  | —                    |
| any non-disposed  | `cohort-changed`                   | `composing` (after reset) | `disposed:entered` (outgoing cohort) |
| any non-disposed  | `dispose`                          | `disposing`         | —                    |
| `disposing`       | (auto)                             | `disposed`          | `disposed:entered`    |

Stage emission rules (encoded by the `ReadinessPort`):

- The stage tracker's monotonic invariant
  (`packages/players-shared/src/pie/stage-tracker.ts`) is the source of
  truth. The FSM never emits a stage out of order — it routes the
  emission through the port, which fills `skipped` slots automatically.
- The `interactive` gate function reads `policies.readiness.mode`
  (progressive vs strict) and the `ReadinessSignals` to decide whether
  `engine-ready → interactive` fires now or stays parked.
- Legacy chain (`readiness-change`, `interaction-ready`, `ready`,
  `pie-loading-complete`) is emitted by the port whenever
  `reportReadinessSignals(...)` is called; the port owns the per-cohort
  latches that today live in `SectionPlayerLayoutKernel.svelte`.

### 3.3 Stage ↔ FSM-state mapping

| FSM state          | M6 stage that just emitted | Notes |
|--------------------|---------------------------|-------|
| `idle`             | none                      | engine constructed, attach pending |
| `attaching`        | none                      | port wiring |
| `resolving`        | none                      | runtime port resolving |
| `acquiring`        | none                      | coordinator port acquiring |
| `composing`        | none                      | controller acquired, awaiting first composition |
| `composed`         | `composed:entered`        | composition snapshot landed |
| `engine-ready`     | `engine-ready:entered`    | coordinator settled |
| `interactive`      | `interactive:entered`     | readiness gate satisfied |
| `loading-complete` | `interactive:entered` (already) + `pie-loading-complete` cohort emit | sub-state |
| `failed`           | `engine-ready:failed` or `interactive:failed` (depending on phase) | non-terminal; `attach` after `dispose` resets |
| `disposing`        | none                      | port cleanup in flight |
| `disposed`         | `disposed:entered`        | terminal for this cohort |

---

## 4. Port interfaces (full signatures)

### 4.1 `CoordinatorPort`

```ts
// packages/assessment-toolkit/src/runtime/ports/coordinator-port.ts
import type {
  ToolkitCoordinatorApi,
  SectionControllerHandle,
  ToolConfigStrictness,
  FrameworkErrorReporter,
} from "../../services/...";

export type CoordinatorOwnership = "owned" | "inherited" | "external";

export interface CoordinatorPort {
  acquire(args: {
    host: HTMLElement;
    runtimeInputs: RuntimeInputs;
    effectiveRuntime: Record<string, unknown>;
    frameworkErrorBus: FrameworkErrorReporter;
    toolConfigStrictness: ToolConfigStrictness;
  }): Promise<{
    coordinator: ToolkitCoordinatorApi;
    ownership: CoordinatorOwnership;
  }>;

  waitUntilReady(coordinator: ToolkitCoordinatorApi): Promise<void>;

  getOrCreateSectionController(args: {
    coordinator: ToolkitCoordinatorApi;
    cohort: CohortKey;
    section: unknown;
    assessmentId: string;
    sectionView: string;
    createDefaultController: () =>
      Promise<SectionControllerHandle> | SectionControllerHandle;
  }): Promise<SectionControllerHandle>;

  release(args: {
    coordinator: ToolkitCoordinatorApi;
    cohort: CohortKey;
    ownership: CoordinatorOwnership;
  }): Promise<void>;
}
```

**Default implementation** (`DefaultCoordinatorPort`):

- `acquire` reads `runtime.coordinator` (host-supplied) first; if absent,
  checks `connectAssessmentToolkitHostRuntimeContext` for an inherited
  coordinator; if neither, validates tools config and constructs a new
  `ToolkitCoordinator` (today's `buildOwnedCoordinator`). Records the
  `ownership` flag so `release` only disposes coordinators it owns.
- `waitUntilReady` calls `coordinator.waitUntilReady()` (existing API).
- `getOrCreateSectionController` calls
  `coordinator.getOrCreateSectionController({...})` exactly as today.
- `release` calls `coordinator.disposeSectionController({...})` and, only
  for `ownership === "owned"`, lets the coordinator GC.

**Test fake** (`InMemoryCoordinatorPort`): synchronous `acquire`/`release`
returning a stub coordinator with deterministic `waitUntilReady` (resolved
or rejected per test config). Records call counts for assertions; the
section-controller stub is a hand-rolled object satisfying
`SectionControllerHandle`.

### 4.2 `RuntimePort`

```ts
// packages/assessment-toolkit/src/runtime/ports/runtime-port.ts
export interface RuntimePort {
  resolve(inputs: RuntimeInputs): {
    effectiveToolsConfig: unknown;
    effectiveRuntime: Record<string, unknown>;
    playerRuntime: ResolvedPlayerRuntime;
  };
}
```

**Default implementation** (`DefaultRuntimePort`): a one-liner. Delegates
to `resolveSectionPlayerRuntimeState` (relocated from
`packages/section-player/src/components/shared/section-player-runtime.ts`
to `packages/assessment-toolkit/src/runtime/runtime-config.ts`). Pure
function; no internal state.

**Test fake** (`StubRuntimePort`): returns a frozen, hand-rolled
`effectiveRuntime` object. Useful for asserting that the engine consumes
the effective shape, not the raw inputs.

### 4.3 `ReadinessPort`

```ts
// packages/assessment-toolkit/src/runtime/ports/readiness-port.ts
import { createStageTracker, type StageTracker } from
  "@pie-players/pie-players-shared/pie";

export interface ReadinessPort {
  bind(args: {
    host: HTMLElement | null;
    runtimeId: string;
    sourceCe: string;
    sourceCeShape: "toolkit" | "layout";
    cohort: CohortKey;
  }): void;
  resetCohort(cohort: CohortKey): void;
  emitStage(stage: Stage, status?: "entered" | "failed" | "skipped"): void;
  emitReadinessChange(detail: SectionPlayerReadinessChangeDetail): void;
  emitInteractionReady(detail: SectionPlayerReadinessChangeDetail): void;
  emitFinalReady(detail: SectionPlayerReadinessChangeDetail): void;
  emitLoadingComplete(detail: LoadingCompleteDetail): void;
  onStageChange(listener: (d: StageChangeDetail) => void): Disposer;
  onLoadingComplete(listener: (d: LoadingCompleteDetail) => void): Disposer;
  onReadinessChange(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
  onInteractionReady(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
  onFinalReady(listener: (d: SectionPlayerReadinessChangeDetail) => void): Disposer;
}
```

**Default implementation** (`DefaultReadinessPort`):

- Constructs a `StageTracker` via `createStageTracker(...)` whose `emit`
  callback `dispatchCrossBoundaryEvent`s `pie-stage-change` on the host
  *and* fans out to local stage subscribers. Same shape today's
  layout-kernel and toolkit-CE use, but in one place.
- `emitLoadingComplete` dispatches `pie-loading-complete` on the host and
  fans out to local subscribers; handles per-cohort dedup latch internally
  (today this is `loadingCompleteEmittedForCohort` in the kernel).
- `emitReadinessChange` / `emitInteractionReady` / `emitFinalReady`
  dispatch the deprecated DOM events (`readiness-change`,
  `interaction-ready`, `ready`) and fan out to local subscribers. Per-cohort
  latches (`interactionReadyDispatched`, `finalReadyDispatched`) live here.
- `resetCohort` calls `stageTracker.reset(...)` and resets all latches.

**Test fake** (`InMemoryReadinessPort`): records every emit call as an
ordered array; lets tests assert exact emission sequence including
`skipped` fills. Subscribers are a Set, like the bus.

### 4.4 `FrameworkErrorPort`

```ts
// packages/assessment-toolkit/src/runtime/ports/framework-error-port.ts
import {
  FrameworkErrorBus,
  type FrameworkErrorListener,
  type FrameworkErrorReporter,
  type FrameworkErrorPort as FrameworkErrorPortReadable,
} from "../../services/framework-error-bus.js";

export interface FrameworkErrorPort
  extends FrameworkErrorPortReadable, FrameworkErrorReporter {
  dispose(): void;
}
```

**Default implementation** (`DefaultFrameworkErrorPort`): a thin wrapper
around `FrameworkErrorBus`. `reportFrameworkError` and
`subscribeFrameworkErrors` proxy to the bus. `dispose` calls
`bus.dispose()`.

**Test fake** (`SilentFrameworkErrorPort`): same behavior as default; the
bus is already package-internal and cheap. A noisier variant
`RecordingFrameworkErrorPort` records every reported model for assertions.

---

## 5. Two-tier resolution wiring

`packages/section-player/src/components/shared/section-player-runtime.ts`
moves to `packages/assessment-toolkit/src/runtime/runtime-config.ts`.
The engine's `RuntimePort` reads the input shape (`RuntimeInputs`)
verbatim from this module, including:

- The 15-key `RuntimeConfig` type.
- `DEFAULT_*` constants.
- `pick` helper (private).
- `resolveOnFrameworkError`, `resolveToolsConfig`, `resolveRuntime`,
  `resolvePlayerRuntime`, `resolveSectionPlayerRuntimeState`,
  `mapRenderablesToItems`, `FrameworkErrorHandler`,
  `StageChangeHandler`, `LoadingCompleteHandler`.

The strict-mirror invariant is unchanged. The CI guard
`packages/section-player/tests/m5-mirror-rule.test.ts` updates its
import path from `../src/components/shared/section-player-runtime.js`
to `@pie-players/pie-assessment-toolkit/runtime` and otherwise stays as
written.

### 5.1 Where the port reads inputs

Layout CEs and `<pie-section-player-base>` build a `RuntimeInputs` object
from their props/attributes (this is identical to today's
`resolveSectionPlayerRuntimeState` call site in
`SectionPlayerLayoutKernel.svelte` lines 232–252) and pass it into
`engine.attach({ runtimeInputs, ... })`. The engine's `RuntimePort.resolve`
runs once per attach and once per cohort change.

### 5.2 Where the engine exposes `effectiveRuntime`

```ts
engine.getEffectiveRuntime() // → Record<string, unknown> | null
```

Layout CEs that need it for derived rendering call this getter. To
preserve Svelte 5 reactivity, the kernel wraps the access in a `$derived`
keyed off a small monotonic version number the engine bumps on every
re-resolve (see §12).

### 5.3 Mirror rule guardrails

Two CI checks (already present) keep the strict mirror rule honest after
the move:

1. `packages/section-player/tests/m5-mirror-rule.test.ts` — re-pointed
   to the new module, retains the `RUNTIME_TIER_CONSUMERS` table.
2. A new `packages/assessment-toolkit/tests/runtime-config-shape.test.ts`
   freezes the `RuntimeConfig` key set at 15.

---

## 6. Readiness emission ownership

The `ReadinessPort` becomes the **single emit source** for stage events
and the legacy chain.

### 6.1 Happy path

```
[CE mount]
  → engine.attach({ host, cohort, runtimeInputs, ... })
    → FSM: idle → attaching
    → ReadinessPort.bind({ host, runtimeId, sourceCe, sourceCeShape, cohort })
    → RuntimePort.resolve(runtimeInputs)
    → FSM: attaching → resolving → (auto) acquiring
    → CoordinatorPort.acquire({ host, runtimeInputs, effectiveRuntime, frameworkErrorBus, toolConfigStrictness })
       returns { coordinator, ownership }
    → FSM: acquiring → composing
    → CoordinatorPort.getOrCreateSectionController({ coordinator, cohort, section, ... })
       returns SectionControllerHandle
    → controller.subscribe(...) wired
    → controller emits initial composition
       → trigger composition-changed
       → FSM: composing → composed
       → ReadinessPort.emitStage("composed", "entered")
         → DOM `pie-stage-change` { stage: "composed" } on host
         → engine subscriber notified
         → onStageChange callback (resolved from effectiveRuntime) invoked
[Coordinator settles]
  → CoordinatorPort.waitUntilReady(coordinator) resolves
    → trigger coordinator-ready
    → FSM: composed → engine-ready
    → ReadinessPort.emitStage("engine-ready", "entered")
[Items load / readiness signals propagate from layout]
  → host calls engine.reportReadinessSignals({ sectionReady, interactionReady,
                                                 allLoadingComplete, runtimeError })
  → engine recomputes via createReadinessDetail (mode-aware)
    → trigger readiness-signals-changed
    → FSM: engine-ready → interactive (if gate passes)
    → ReadinessPort.emitStage("interactive", "entered")
    → ReadinessPort.emitReadinessChange(detail)
    → ReadinessPort.emitInteractionReady(detail) (once per cohort)
[All items loaded]
  → host calls engine.reportReadinessSignals({ ..., allLoadingComplete: true })
    → trigger readiness-signals-changed
    → FSM: interactive → loading-complete
    → ReadinessPort.emitFinalReady(detail) (once per cohort) → DOM `ready`
    → ReadinessPort.emitLoadingComplete(detail) (once per cohort)
       → DOM `pie-loading-complete`
       → onLoadingComplete callback invoked (resolved from effectiveRuntime)
```

### 6.2 Failure paths

**Init reject** (`CoordinatorPort.acquire` rejects):

```
acquire rejects
  → trigger coordinator-failed
  → FSM: acquiring → failed
  → ReadinessPort.emitStage("engine-ready", "failed")  (records position)
  → FrameworkErrorPort.reportFrameworkError({ kind: "coordinator-init", ... })
  → onFrameworkError callback delivered via bus subscriber
  (legacy chain: emitReadinessChange({ phase: "error", runtimeError: true })
   if engine receives a synthetic readiness-signals-changed; otherwise
   no readiness emit — error path is purely framework-error)
```

**Section initializer reject** (controller acquisition fails — today's
`section-init` `.catch(...)` in `PieAssessmentToolkit.svelte` lines
1013–1041):

```
getOrCreateSectionController rejects
  → trigger controller-failed
  → FSM: composing → failed
  → ReadinessPort.emitStage("engine-ready", "skipped")
  → ReadinessPort.emitStage("interactive", "failed")
  → FrameworkErrorPort.reportFrameworkError({ kind: "runtime-init", ... })
```

**Coordinator-ready timeout / reject** (`waitUntilReady` rejects after
composition lands — today's toolkit `.catch(...)` in
`PieAssessmentToolkit.svelte` lines 1247–1274):

```
waitUntilReady rejects
  → trigger coordinator-failed
  → FSM: composed → failed
  → ReadinessPort.emitStage("engine-ready", "failed")
  → FrameworkErrorPort.reportFrameworkError(...)
  (cause has already been published by the coordinator through the bus;
   we re-publish only if this path produced a fresh error)
```

In every failure path, `dispose` returns the FSM to `disposed` and emits
`disposed:entered` so subscribers see a monotonic close-out.

---

## 7. Coordinator lifecycle via `CoordinatorPort`

### 7.1 Where the coordinator is created

In Variant B the **`CoordinatorPort` (default impl) is the only place
coordinators are constructed**. `PieAssessmentToolkit.svelte` no longer
calls `new ToolkitCoordinator(...)`; it calls `engine.attach(...)`, and
the engine internally invokes `coordinatorPort.acquire(...)`.

### 7.2 How the port wraps it

`DefaultCoordinatorPort` keeps a per-attach record of:

```ts
type CoordinatorRecord = {
  coordinator: ToolkitCoordinatorApi;
  ownership: "owned" | "inherited" | "external";
  // For owned only — needed so `release` can null it out.
  ownedHandle?: ToolkitCoordinator;
};
```

The acquire branch logic mirrors today's three sources:

1. `runtimeInputs.runtime?.coordinator` or `runtimeInputs.coordinator` →
   `external`.
2. Else `connectAssessmentToolkitHostRuntimeContext(host, ...)` → if a
   parent `<pie-assessment-toolkit>` is supplying one and `isolation !== "force"`,
   ownership is `inherited`.
3. Else validate tools config (today's `validateToolsConfigForBootstrap`)
   and construct a new `ToolkitCoordinator(...)`. Ownership is `owned`.

The `frameworkErrorBus` argument is passed through to the constructed
coordinator so coordinator-side failures (provider-init, tts-init, …)
fan out through the same bus the engine subscribes on. This preserves
the M3 "single source for framework errors" invariant.

### 7.3 How disposal is wired

```ts
engine.dispose():
  → FSM: any → disposing
  → ReadinessPort.emitStage("disposed", "entered")
  → CoordinatorPort.release({ coordinator, cohort, ownership })
    → coordinator.disposeSectionController({ sectionId, attemptId })
    → if ownership === "owned": null out the owned handle
       (no explicit destroy; coordinator GCs once nothing references it)
  → FrameworkErrorPort.dispose()  (drops listeners, mirroring
                                   FrameworkErrorBus.dispose() today)
  → registry.clear()
  → FSM: disposing → disposed
```

Cohort-change is **not** a disposal: the engine calls
`CoordinatorPort.release({ ..., cohort: oldCohort })` only if the
coordinator is `owned` and the host explicitly opts to recreate (rare).
The default behavior reuses the coordinator across cohorts; only the
section-controller flips, matching today's behavior in
`PieAssessmentToolkit.svelte`.

---

## 8. Common host wiring

### 8.1 Inside layout CEs (the dominant case)

A layout CE (e.g. `PieSectionPlayerSplitPaneElement.svelte`) becomes:

```svelte
<script lang="ts">
  import { createSectionRuntimeEngine } from "@pie-players/pie-assessment-toolkit/runtime";
  // ... props ...
  const engine = createSectionRuntimeEngine();
  // ...
  $effect(() => {
    void engine.attach({
      host, cohort: { sectionId, attemptId }, sectionView,
      section, runtimeInputs: { /* mirror RuntimeInputs from props */ },
    });
    return () => { void engine.dispose(); };
  });
</script>
```

**Five lines** (factory + attach call + cleanup). Layout CE no longer
runs `resolveSectionPlayerRuntimeState`, no longer constructs a stage
tracker, no longer manages cohort latches.

### 8.2 Direct toolkit host

A page that mounts `<pie-assessment-toolkit>` doesn't change — the engine
is now a private collaborator inside the toolkit CE. The host still uses
the public CE props (`assessment-id`, `section`, `coordinator`, …) and
still subscribes to `framework-error`, `pie-stage-change`,
`pie-loading-complete` DOM events.

### 8.3 Programmatic host (the bonus path)

A SvelteKit/Angular/React host that needs to drive the runtime without
mounting a CE (e.g. a custom shell):

```ts
import { createSectionRuntimeEngine } from "@pie-players/pie-assessment-toolkit/runtime";

const engine = createSectionRuntimeEngine();
engine.subscribeStageChange((d) => track(d));
await engine.attach({ host: rootEl, cohort, sectionView, section, runtimeInputs });
```

Three lines for the common host. A test that wants to swap the readiness
port:

```ts
import { createSectionRuntimeEngine, InMemoryReadinessPort }
  from "@pie-players/pie-assessment-toolkit/runtime";

const readiness = new InMemoryReadinessPort();
const engine = createSectionRuntimeEngine({ readiness });
await engine.attach({ ... });
expect(readiness.stages).toEqual([
  { stage: "composed", status: "entered" },
  { stage: "engine-ready", status: "entered" },
  { stage: "interactive", status: "entered" },
]);
```

One extra line vs. the no-override case. Acceptable cost for the
power-user.

---

## 9. Blast radius

Categories: **S**ource-edit · **T**est-update · **D**oc-update · **X**delete · **U**nchanged-but-dependent.

### 9.1 `packages/assessment-toolkit`

| Path | Cat | Notes |
|------|-----|-------|
| `src/runtime/SectionRuntimeEngine.ts` | S | Rewritten as the FSM owner / API surface. |
| `src/runtime/engine-fsm.ts` | S (new) | Pure FSM reducer + `ENGINE_TRANSITIONS` table. |
| `src/runtime/engine-types.ts` | S (new) | `EngineState`, `EngineTrigger`, `EngineTransition`. |
| `src/runtime/runtime-config.ts` | S (new) | Receives the moved `resolveRuntime` family + types. |
| `src/runtime/default-runtime-engine.ts` | S (new) | `createSectionRuntimeEngine` factory. |
| `src/runtime/ports/coordinator-port.ts` | S (new) | `CoordinatorPort` + `DefaultCoordinatorPort`. |
| `src/runtime/ports/runtime-port.ts` | S (new) | `RuntimePort` + `DefaultRuntimePort`. |
| `src/runtime/ports/readiness-port.ts` | S (new) | `ReadinessPort` + `DefaultReadinessPort`. |
| `src/runtime/ports/framework-error-port.ts` | S (new) | `FrameworkErrorPort` + `DefaultFrameworkErrorPort`. |
| `src/runtime/index.ts` | S (new) | Barrel for `./runtime` export. |
| `src/components/PieAssessmentToolkit.svelte` | S | Drops stage tracker, framework-error bus construction, `buildOwnedCoordinator`, `effectiveCoordinator` derivation, every `$effect` that maintained stage/readiness state. Wraps `engine.attach`/`engine.dispose`. |
| `src/index.ts` | S | Re-exports the new public engine surface (`SectionRuntimeEngine`, `createSectionRuntimeEngine`, port types, FSM types). |
| `package.json` | S | Adds the four new `./runtime/...` exports to `exports`. |
| `scripts/build-ce-components.mjs` | U | Build script unaffected. |
| `tests/toolkit-coordinator-framework-error.test.ts` | T | Updated to subscribe via `engine.subscribeFrameworkErrors` (or keep direct bus assertion if testing the bus, not the engine). |
| `tests/toolkit-coordinator-section-events.test.ts` | T | Asserts the engine still proxies events. |
| `tests/typed-event-bus.test.ts` | U | TypedEventBus is independent. |
| `tests/engine/fsm-transitions.test.ts` | T (new) | Asserts every row of `ENGINE_TRANSITIONS`. |
| `tests/engine/runtime-port-resolves.test.ts` | T (new) | Default port wraps `resolveSectionPlayerRuntimeState`. |
| `tests/engine/coordinator-port.test.ts` | T (new) | Owned / inherited / external acquire branches. |
| `tests/engine/readiness-port.test.ts` | T (new) | Stage tracker + legacy chain emit ordering, cohort reset. |
| `tests/engine/framework-error-port.test.ts` | T (new) | Bus passthrough + dispose. |
| `tests/engine/runtime-config-shape.test.ts` | T (new) | Freezes the 15-key `RuntimeConfig`. |
| `tests/engine/integration-default-bundle.test.ts` | T (new) | End-to-end attach → composed → engine-ready → interactive on a stub coordinator. |
| `dist/**` | U | Regenerated by `bun run build`. |

### 9.2 `packages/section-player`

| Path | Cat | Notes |
|------|-----|-------|
| `src/components/shared/SectionPlayerLayoutKernel.svelte` | S | Major shrink. Removes `resolveSectionPlayerRuntimeState`, `createStageTracker`, cohort latches, all readiness `$effect`s, the stage-progression `$effect`. Adds `engine.attach/dispose` + 3–4 subscriptions. Net –250 LoC. |
| `src/components/PieSectionPlayerBaseElement.svelte` | S | Drops the imperative `toolkitElement.onFrameworkError = …` shim and the `onStageChange` shim (lines 271–289); engine owns those handlers. Two-tier resolution at the CE boundary remains as a passthrough for the resolved props the CE forwards to the toolkit element. |
| `src/components/PieSectionPlayerSplitPaneElement.svelte` | S | Two-tier `resolveOnFrameworkError` shim (lines 269–276) goes away — kernel exposes `engine.getEffectiveRuntime()` to the layout. |
| `src/components/PieSectionPlayerVerticalElement.svelte` | S | Same as splitpane. |
| `src/components/PieSectionPlayerTabbedElement.svelte` | S | Same as splitpane. |
| `src/components/PieSectionPlayerKernelHostElement.svelte` | S | Same as splitpane. |
| `src/components/SectionPlayerShell.svelte` | U | No changes (host-side panel chrome). |
| `src/components/shared/section-player-runtime.ts` | X | Deleted. Logic moved to `@pie-players/pie-assessment-toolkit/runtime/runtime-config`. Section-player uses an internal shim file `runtime-config-shim.ts` that re-exports the engine module so existing in-package imports stay short. |
| `src/components/shared/section-player-stage-tracker.ts` | X | Deleted (already a one-line re-export). |
| `src/components/shared/section-player-readiness.ts` | U | Pure helper, used by the engine. |
| `src/components/shared/section-player-view-state.ts` | U | Composition snapshot helper unaffected. |
| `src/contracts/public-events.ts` | U | Wire contract preserved verbatim. |
| `src/contracts/runtime-host-contract.ts` | S (small) | Add `getEngine(): SectionRuntimeEngineApi` so layout CEs that expose the kernel ref can also expose the engine for hosts that want first-class access. |
| `src/contracts/host-hooks.ts` | U | Card formatter hooks unaffected. |
| `src/policies/*` | U | Readiness mode is consumed by the engine; the policy file itself is unchanged. |
| `tests/m5-mirror-rule.test.ts` | T | Re-pointed to `@pie-players/pie-assessment-toolkit/runtime`. |
| `tests/section-player-runtime.test.ts` | T | Re-pointed; assertions identical. |
| `tests/section-player-stage-tracker.test.ts` | T | Becomes engine-driven; asserts via `InMemoryReadinessPort` instead of constructing a tracker by hand. |
| `tests/section-player-readiness-events.spec.ts` | U | Pure test against `createReadinessDetail`. |
| `tests/section-player-controller-access.spec.ts` | T | Asserts engine-backed `getSectionController()` / `waitForSectionController(timeout)`. |
| `tests/section-player-event-panel.spec.ts` | T | Stage / readiness DOM events still arrive — asserts the engine emits them. |
| `tests/section-player-toolkit-observability.spec.ts` | T | Updates expected emit ordering if engine re-orders any stage. |
| Other `tests/*.spec.ts` (Playwright) | U or T | E2E specs run against built `dist`; most don't change. The two that assert per-cohort latching (preload / hydrate / session) re-validate after rebuild. |
| `package.json` | S (small) | No new exports; tests update test runner config if Playwright workspace path changes. |

### 9.3 `packages/assessment-player`

| Path | Cat | Notes |
|------|-----|-------|
| `src/components/AssessmentPlayerDefaultElement.ts` | U | Mounts `<pie-section-player-*>` CEs; no engine knowledge. |
| `src/components/AssessmentPlayerShellElement.ts` | U | Same. |
| `src/controller/AssessmentController.ts` | U | Talks to coordinator via toolkit context, not the engine. |

### 9.4 Apps

| Path | Cat | Notes |
|------|-----|-------|
| `apps/section-demos/src/**` | U | Imports the layout CEs. The demos do not import the engine directly today. |
| `apps/assessment-demos/src/**` | U | Same. |
| `apps/item-demos/src/**` | U | No section-engine usage. |
| `apps/docs/**` | D | Update the architecture doc / readiness doc (`packages/section-player/ARCHITECTURE.md`) and demo READMEs to reference the engine and the new export paths. |
| `apps/local-esm-cdn/**` | U | Pure registry. |

### 9.5 External project consumers

| Path | Cat | Notes |
|------|-----|-------|
| `../element-QuizEngineFixedFormPlayer/**` | U | Consumes pie-section-player at runtime via CDN/IIFE. No source-level imports of the engine. |
| `../element-QuizEngineFixedPlayer/projects/quiz-engine-fixed-player/src/app/components/pie-section-wrapper/*` | U | Wraps `<pie-section-player-*>` CEs in Angular. Wire contract (DOM events + props) is unchanged. Validate via the existing E2E in that project after the lockstep release. |
| `../../kds/pie-api-aws/containers/pieoneer/src/lib/section-demos/**` | U | SvelteKit consumer of `<pie-section-player-*>`. Same wire contract. |
| `../../kds/pie-api-aws/containers/pieoneer/src/routes/(public)/etl/demos/sections/**` | U | Same. |
| `../../kds/pie-api-aws/containers/pieoneer/src/routes/(fullscreen)/section-preview/**` | U | Same. |

> The consumers depend on the published `@pie-players/*` versions, not on
> internal runtime symbols. The lockstep release lifts them all at once.

---

## 10. Migration path

Each step is a single logical commit with passing builds + tests. PR
count estimated; one or two of the larger steps may split if review
churn warrants.

1. **Add engine types and FSM data (no behavior).** Land
   `engine-types.ts`, `engine-fsm.ts`, and `ENGINE_TRANSITIONS`. Pure
   types + a frozen array of rows. `bun run build` passes. ~1 PR.
2. **Move the runtime resolver into the toolkit package.**
   `packages/assessment-toolkit/src/runtime/runtime-config.ts` receives
   the verbatim contents of
   `packages/section-player/src/components/shared/section-player-runtime.ts`.
   The section-player file becomes a re-export shim
   (`section-player-runtime.ts` re-exports from the toolkit package).
   `m5-mirror-rule.test.ts` is re-pointed. Lockstep major release
   guarded — no compatibility alias for old paths. ~1 PR.
3. **Land the four ports + default implementations.** Each port file
   ships with its default impl and unit tests. Engine seed
   (`SectionRuntimeEngine.ts`) is **not** rewritten yet; it imports the
   default ports lazily so `bun run build` still emits the seed class.
   ~1 PR.
4. **Rewrite `SectionRuntimeEngine` as the FSM owner.** New API surface
   (§1.4). Existing seed methods (`register`, `unregister`,
   `getCanonicalItemId`, …) are kept as delegates. Add
   `tests/engine/fsm-transitions.test.ts` and
   `tests/engine/integration-default-bundle.test.ts`. ~1 PR.
5. **Engine takes over coordinator lifecycle in `PieAssessmentToolkit.svelte`.**
   Drop `buildOwnedCoordinator`, `effectiveCoordinator`,
   `frameworkErrorBus` instantiation, and the section-init `$effect`
   (lines 973–1046). Replace with `engine.attach(...)` /
   `engine.dispose()` and bus subscriptions. Existing CE-level tests
   (`toolkit-coordinator-framework-error.test.ts`, `toolkit-coordinator-section-events.test.ts`)
   adjust assertion paths. ~1 PR (large, well-scoped).
6. **Engine takes over readiness emission in `SectionPlayerLayoutKernel.svelte`.**
   Drop the in-kernel `createStageTracker` + cohort latches + readiness
   `$effect` chain. Replace with engine subscriptions. The kernel still
   owns DOM composition. Update
   `section-player-stage-tracker.test.ts` to assert engine-emitted
   stages. ~1 PR.
7. **Engine takes over readiness emission in `PieAssessmentToolkit.svelte`.**
   Drop the in-CE `createStageTracker` + per-stage latches. ~1 PR
   (small).
8. **Layout CE shims removed.** Delete the imperative
   `toolkitElement.onFrameworkError = ...` and `onStageChange = ...`
   shims in `PieSectionPlayerBaseElement.svelte` and the
   `resolveOnFrameworkError` shims in the four other layout CEs. The
   engine owns the resolved handlers. ~1 PR.
9. **Delete dead files.** Remove
   `packages/section-player/src/components/shared/section-player-runtime.ts`
   (after step 2's shim has done its job for two PRs) and
   `section-player-stage-tracker.ts`. Update internal in-package
   imports. ~1 PR.
10. **Add `dist`-published exports + barrel.** Update
    `packages/assessment-toolkit/package.json` `exports`. Add
    `runtime/index.ts`. Run `bun run check:source-exports`,
    `bun run check:consumer-boundaries`, `bun run check:custom-elements`.
    ~1 PR.
11. **Docs + changeset.** Update
    `packages/section-player/ARCHITECTURE.md`, the M7 readiness
    doc, and add a major-bump changeset under `.changeset/`. ~1 PR.

**Total: ~10–11 PRs.** Each green at HEAD; the final two are docs +
release plumbing.

---

## 11. Test plan

### 11.1 Unit tests for each port (with fakes)

- `tests/engine/coordinator-port.test.ts` — uses
  `InMemoryCoordinatorPort` to assert the engine routes
  `acquire/release/waitUntilReady` correctly and respects ownership
  branches in `DefaultCoordinatorPort` (host-passed coordinator,
  inherited coordinator, owned).
- `tests/engine/runtime-port.test.ts` — `StubRuntimePort` returns a
  hand-rolled `effectiveRuntime`; the engine forwards exactly that to
  the rest of the wiring. A second test uses `DefaultRuntimePort` to
  prove parity with the relocated `resolveSectionPlayerRuntimeState`.
- `tests/engine/readiness-port.test.ts` — `InMemoryReadinessPort`
  records emit calls; the engine produces stage / loading-complete /
  legacy chain events in the documented order, including the
  `engine-ready:skipped` / `interactive:failed` failure path.
- `tests/engine/framework-error-port.test.ts` — bus pass-through plus
  late-binding hook delivery.

### 11.2 FSM transition table tests

- `tests/engine/fsm-transitions.test.ts` — table-driven, iterates over
  `ENGINE_TRANSITIONS`. For each row: build a tiny harness that drives
  the engine into `from`, fire `trigger`, assert `to` and the emitted
  stage. Catches accidental regressions of the table.
- `tests/engine/fsm-illegal-triggers.test.ts` — for each `from`, fire
  every trigger not listed in the table; assert the engine stays in
  `from` and surfaces a one-time dev warn (mirrors the stage tracker's
  `unexpectedTransitionWarned` pattern).

### 11.3 Default-wired bundle (integration)

- `tests/engine/integration-default-bundle.test.ts` — uses a stub
  coordinator (returns a settled `waitUntilReady`, a stub
  `SectionControllerHandle`) and asserts:
  1. `attach → composed → engine-ready → interactive` on the happy
     path emits the canonical stages and the legacy chain.
  2. Cohort change resets latches and re-emits from `composed` for the
     incoming cohort, with `disposed:entered` first for the outgoing
     cohort.
  3. `dispose` emits `disposed:entered` and idempotently unbinds.

### 11.4 Existing tests that must change

- `packages/section-player/tests/m5-mirror-rule.test.ts` — re-pointed
  import path. Assertions unchanged.
- `packages/section-player/tests/section-player-runtime.test.ts` —
  same.
- `packages/section-player/tests/section-player-stage-tracker.test.ts` —
  asserts via `engine.subscribeStageChange` or
  `InMemoryReadinessPort` instead of constructing a tracker directly.
- `packages/section-player/tests/section-player-controller-access.spec.ts` —
  uses `engine.getSectionController()` /
  `engine.waitForSectionController(timeout)`.
- `packages/assessment-toolkit/tests/toolkit-coordinator-framework-error.test.ts` —
  if the test asserts the bus directly, it stays. If it asserts the
  CE behavior, it switches to engine-level assertions.
- `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
  — same.

### 11.5 New tests introduced

Listed above plus:

- `tests/engine/runtime-config-shape.test.ts` — freezes the 15-key
  `RuntimeConfig` to prevent accidental drift.
- `tests/engine/disposal-idempotency.test.ts` — calls `dispose` twice
  and asserts no second `disposed:entered` emission.
- `tests/engine/cohort-reset.test.ts` — multiple cohort changes,
  asserts FSM rolls back to `composing` each time, latches reset,
  monotonic ordering preserved.

### 11.6 E2E impact

The pre-push lefthook chain runs `test:e2e:section-player:critical`,
`test:e2e:item-player:multiple-choice`, and
`test:e2e:assessment-player`. None of those import the engine directly;
they exercise the CEs and assert DOM events. After step 6 lands they
must be re-run with `required_permissions: ["all"]`
(per `.cursor/rules/playwright-sandbox.mdc`) to catch any subtle
re-ordering of stage emissions.

E2E specs that explicitly subscribe to stage / readiness events
(`section-player-event-panel.spec.ts`,
`section-player-toolkit-observability.spec.ts`,
`section-swap-element-set-change.spec.ts`) get re-validated after step
6 and step 7. Expect zero contract drift; if any spec asserts ordering
that the engine does not preserve, the spec is wrong (engine is the
single source) and the spec updates, not the engine.

---

## 12. Risks and unknowns

1. **Reactivity boundary.** The engine is plain TypeScript: no `$state`,
   no `$derived`. Layout CE consumers must observe engine state via
   imperative subscriptions. Two options for the kernel:
   - **(picked)** Mirror engine state into a small set of `$state`
     fields (e.g. `let effectiveRuntime = $state<...>(null)` updated in
     `engine.subscribeTransitions`). Engine bumps a monotonic
     `effectiveRuntimeVersion` so we know when to re-mirror without
     deep-equality. Setup runs inside `untrack(() => ...)` per the
     `.cursor/rules/svelte-subscription-safety.mdc` pattern.
   - Rejected: a `$state` proxy inside the engine. That would make the
     engine non-portable to Angular / React hosts and drag Svelte 5 as
     a hard runtime dep into a pure-TS module — kills the test-fake
     story the variant is built around.
2. **Subscription idempotency on cohort change.** `engine.cohortChanged({
   sectionId, attemptId })` resets latches but reuses port instances.
   Bug shape to watch: a cohort change that fires before the stage
   tracker has emitted the outgoing cohort's `disposed`. Mitigation:
   the FSM's `cohort-changed` trigger always emits `disposed:entered`
   for the previous cohort *before* `resetCohort(...)` runs in the
   port. Captured in `tests/engine/cohort-reset.test.ts`.
3. **Inherited-coordinator dispose ownership.** When the engine
   inherits a coordinator (`isolation !== "force"` and a parent toolkit
   provides one), `release` must NOT dispose the coordinator. The
   `ownership` discriminator covers this; risk is the engine forgetting
   to forward it. Mitigation: types make `release` require ownership.
4. **Bus subscription timing during owned-coordinator construction.**
   Today the toolkit subscribes to the bus in a `$effect` *before*
   `buildOwnedCoordinator` runs, so coordinator-init failures reach the
   subscriber. The engine must do the equivalent: subscribe in
   `attach()` synchronously before calling `coordinatorPort.acquire`.
5. **Two-tier resolver moving package.** Section-player tests will
   import from `@pie-players/pie-assessment-toolkit/runtime`. The
   `RuntimeConfig` type is consumed via the same path. Risk: a public
   downstream consumer (in the external projects) had a transitive
   import of `@pie-players/pie-section-player/.../section-player-runtime.js`.
   Mitigation: a one-PR shim file (deleted in step 9) and an explicit
   note in the changeset about the new import path.
6. **Build-output guardrails.** The new `runtime/ports/*` files must
   land in `dist/runtime/ports/*` of the toolkit package. Risk: the
   toolkit's `build-ce-components.mjs` script might not pick them up
   (it currently targets the CE entrypoints). Mitigation: ports are
   plain TS — they get emitted by the `tsc -p tsconfig.json` step that
   runs before the CE builder.
7. **External project E2E.** No direct imports, but a behavior change
   that subtly re-orders DOM events could regress
   `element-QuizEngineFixedPlayer` (Angular wrapper that listens to
   `pie-section-player-*` events). Mitigation: hold the M7 release
   until after that project's smoke runs against an alpha publish from
   this branch.

---

## 13. Comparison anchor

- **Variant B's biggest win:** every external concern is a one-line
  port swap. Tests don't need a DOM, don't need Svelte, don't need a
  real coordinator — three of the four ports have trivial fakes. The
  FSM table is enumerable, so transitions are an integration test
  instead of a forensic exercise across two `.svelte` files.
- **Variant B's biggest cost:** four interface files + four default
  port classes are real complexity for a problem that, today, lives in
  two `.svelte` `$effect` blocks. A senior reviewer spending 5 minutes
  on the engine has to chase one more layer of indirection to confirm
  "what actually happens at runtime." For the dominant deployment
  (single-section, default coordinator, default policies) the host
  ergonomics tax is small (one factory call vs. one `new` call) — but
  the maintenance tax is real and persistent.
- **Where the FSM-with-ports shape hurts the most:** any change that
  needs to thread a *new* signal through the engine touches an
  interface, a default impl, every fake, and the engine reducer. Variant
  A (single class) would touch one method body. If the upcoming
  milestones (M8–M10) are mostly about adding new readiness or
  coordinator signals, Variant B will pay this tax repeatedly. If they
  are mostly about replacing or relocating existing concerns
  (refactors), Variant B's port boundaries pay back the upfront cost.
