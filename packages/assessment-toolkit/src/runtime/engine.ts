/**
 * Section runtime engine — the stable entry for a host that mounts, drives and
 * disposes a section runtime.
 *
 * Besides the `SectionRuntimeEngine` facade it carries the vocabulary of the
 * facade's own inputs: the runtime config and its resolution, the framework-error
 * bus `attachHost` takes, the cohort an `initialize` or `cohort-change` input
 * names, and the readiness signals and detail. The section player's layout kernel
 * is the host this was cut for. The engine's core, adapter and bridges stay
 * behind the facade, with no entry of their own.
 */

export {
	SectionRuntimeEngine,
	type SectionRuntimeEngineHostArgs,
} from "./SectionRuntimeEngine.js";

export {
	sectionRuntimeEngineHostContext,
	connectSectionRuntimeEngineHostContext,
	type SectionRuntimeLifecycleHandle,
	type SectionRuntimeEngineHostContextValue,
	type SectionRuntimeEngineHostContextListener,
} from "./section-runtime-engine-host-context.js";

export { FrameworkErrorBus } from "../services/framework-error-bus.js";

export {
	DEFAULT_ASSESSMENT_ID,
	DEFAULT_ENV,
	DEFAULT_ISOLATION,
	DEFAULT_PLAYER_TYPE,
	resolveOnFrameworkError,
	resolveSectionEngineRuntimeState,
	type EffectiveRuntime,
	type FrameworkErrorHandler,
	type LoadingCompleteHandler,
	type PlayerOverrides,
	type RuntimeConfig,
	type RuntimeInputs,
	type StageChangeHandler,
} from "./core/engine-resolver.js";

export { cohortsEqual, makeCohort, type CohortKey } from "./core/cohort.js";

export {
	createReadinessDetail,
	type EngineReadinessDetail,
	type EngineReadinessSignals,
} from "./core/engine-readiness.js";
