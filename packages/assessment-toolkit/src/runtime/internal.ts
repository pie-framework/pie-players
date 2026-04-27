/**
 * Section runtime engine — **internal** entry point (M7 — Variant C).
 *
 * Re-exports the layered core + adapter surface for advanced hosts that
 * want to construct or inspect engines directly, and for the engine's
 * own tests / benchmarks.
 *
 * **Stability posture.** This module is **not** part of the stable
 * public API. Symbols here are subject to change between minor versions
 * with only a changeset note. Hosts that need long-term stability
 * should depend on the facade (`SectionRuntimeEngine` exported from
 * `./runtime/engine`) instead.
 *
 * The split is intentional:
 *   - `./runtime/engine` (PR 3) — narrow, stable facade for common
 *     host wiring.
 *   - `./runtime/internal` — wide, evolving surface for the kernel,
 *     adapter tests, and any host that wants to reach past the facade.
 *
 * The `runtime/engine` and `runtime/internal` package `exports` map
 * entries are added in PR 3 alongside the facade refactor.
 */

export { SectionEngineAdapter } from "./adapter/SectionEngineAdapter.js";
export type { SectionEngineAdapterOptions } from "./adapter/SectionEngineAdapter.js";

// `FrameworkErrorBus` is the package-internal multi-subscriber bus the
// engine adapter consumes via the `FrameworkErrorReporter` write port.
// It is re-exported here (alongside the read/write ports) so advanced
// hosts that construct an engine instance directly — including the M7
// PR 5 section-player kernel — can wire a bus without reaching into a
// deep relative path. The class itself remains "package-internal" in
// posture (the doc comment on the class explains why); this export is
// a deliberate, advanced-host escape hatch on the evolving
// `runtime/internal` surface, never on the stable facade.
export {
	FrameworkErrorBus,
	type FrameworkErrorListener,
	type FrameworkErrorPort,
	type FrameworkErrorReporter,
} from "../services/framework-error-bus.js";

export {
	createCoordinatorBridge,
	type CoordinatorBridgeHandle,
	type CoordinatorBridgeOptions,
	type CoordinatorPort,
	type ResolveSectionControllerArgs,
} from "./adapter/coordinator-bridge.js";

export {
	createDomEventBridge,
	type DomEventBridgeHandle,
	type DomEventBridgeOptions,
} from "./adapter/dom-event-bridge.js";

export {
	createFrameworkErrorBridge,
	type FrameworkErrorBridgeHandle,
	type FrameworkErrorBridgeOptions,
} from "./adapter/framework-error-bridge.js";

export {
	createInstrumentationBridge,
	type InstrumentationBridgeHandle,
	type InstrumentationBridgeOptions,
	type InstrumentationHook,
} from "./adapter/instrumentation-bridge.js";

export {
	createLegacyEventBridge,
	type LegacyEventBridgeHandle,
	type LegacyEventBridgeOptions,
} from "./adapter/legacy-event-bridge.js";

export {
	createSubscriberFanout,
	type EngineOutputListener,
	type SubscriberFanoutHandle,
} from "./adapter/subscriber-fanout.js";

export { SectionEngineCore } from "./core/SectionEngineCore.js";
export type { SectionEngineCoreListener } from "./core/SectionEngineCore.js";

export {
	cohortKey,
	cohortsEqual,
	makeCohort,
	type CohortKey,
} from "./core/cohort.js";

export type { SectionEngineInput } from "./core/engine-input.js";
export type { SectionEngineOutput } from "./core/engine-output.js";
export type {
	EngineReadinessDetail,
	EngineReadinessPhase,
	EngineReadinessSignals,
} from "./core/engine-readiness.js";
export type {
	SectionEnginePhase,
	SectionEngineState,
} from "./core/engine-state.js";
export { createInitialEngineState } from "./core/engine-state.js";
export { phaseToStage } from "./core/engine-stage-derivation.js";
export {
	DEFAULT_ASSESSMENT_ID,
	DEFAULT_ENV,
	DEFAULT_ISOLATION,
	DEFAULT_LAZY_INIT,
	DEFAULT_PLAYER_TYPE,
	resolveOnFrameworkError,
	resolveRuntime,
	resolveSectionEngineRuntimeState,
	resolveToolsConfig,
	type EffectiveRuntime,
	type FrameworkErrorHandler,
	type LoadingCompleteHandler,
	type PlayerOverrides,
	type RuntimeConfig,
	type RuntimeInputs,
	type StageChangeHandler,
} from "./core/engine-resolver.js";
export {
	createReadinessDetail,
	resolveReadinessPhase,
} from "./core/engine-readiness.js";
export { transition } from "./core/engine-transition.js";
export type { TransitionResult } from "./core/engine-transition.js";
