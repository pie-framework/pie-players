/**
 * Section runtime engine — the stable entry for a host that drives a section's
 * stage chain.
 *
 * Besides the `SectionRuntimeEngine` facade it carries the vocabulary of the
 * facade's own surface: the inputs `dispatchInput` takes and the outputs
 * `subscribe` delivers, the state `getState` returns, the runtime config and its
 * resolution, the id a section runs under, the cohort an `initialize` or
 * `cohort-change` input names, and the
 * readiness signals. The section player's layout kernel is the host
 * this was cut for. The engine's core, adapter and bridges stay behind the
 * facade, with no entry of their own.
 */

export {
	SectionRuntimeEngine,
	type SectionRuntimeEngineHostArgs,
} from "./SectionRuntimeEngine.js";

export type { SectionEngineInput } from "./core/engine-input.js";
export type { SectionEngineOutput } from "./core/engine-output.js";
export type {
	SectionEnginePhase,
	SectionEngineState,
} from "./core/engine-state.js";

export {
	DEFAULT_ENV,
	DEFAULT_ISOLATION,
	DEFAULT_PLAYER_TYPE,
	resolveSectionEngineRuntimeState,
	resolveSectionId,
	type FrameworkErrorHandler,
	type LoadingCompleteHandler,
	type PlayerOverrides,
	type RuntimeConfig,
	type RuntimeInputs,
	type StageChangeHandler,
} from "./core/engine-resolver.js";

export { cohortsEqual, makeCohort, type CohortKey } from "./core/cohort.js";

export type { EngineReadinessSignals } from "./core/engine-readiness.js";
