/**
 * Section runtime engine state.
 *
 * The state object is the single source of truth for stage, cohort and
 * readiness signals across one engine instance. The transition function in
 * `engine-transition.ts` is its only mutator; the adapter reads it through
 * `SectionEngineCore.getState()`.
 *
 * Phases map onto the canonical stages:
 *
 *   `idle`             → no cohort yet. No stage.
 *   `booting-section`  → cohort known, controller pending. Stage `composed`.
 *   `engine-ready`     → controller resolved. Stage `engine-ready`.
 *   `interactive`      → readiness gate satisfied. Stage `interactive`.
 *   `failed`           → a runtime error ended the cohort's chain before
 *                        `interactive`. No stage of its own: the transition
 *                        records the stages it did not reach as `failed` and
 *                        `skipped`.
 *   `disposed`         → engine torn down. Stage `disposed`.
 *
 * `loading-complete` is an output, emitted once per cohort when the readiness
 * signals report every item loaded.
 */

import type { CohortKey } from "./cohort.js";
import type { EffectiveRuntime } from "./engine-resolver.js";
import type { EngineReadinessSignals } from "./engine-readiness.js";

export type SectionEnginePhase =
	| "idle"
	| "booting-section"
	| "engine-ready"
	| "interactive"
	| "failed"
	| "disposed";

export type SectionEngineState = {
	/** Current FSM phase. The single source of truth for stage derivation. */
	phase: SectionEnginePhase;

	/**
	 * Active cohort, or `null` when the engine is `idle` or `disposed`.
	 * `phase === "idle"` always implies `cohort === null`. A non-idle,
	 * non-disposed phase always has a cohort.
	 */
	cohort: CohortKey | null;

	/**
	 * Whether the host has reported the section controller is resolved.
	 * Latched by the `section-controller-resolved` input; the
	 * transition uses it (along with `phase >= booting-section`) to
	 * advance into `engine-ready`.
	 */
	controllerResolved: boolean;

	/**
	 * Readiness signal snapshot, replaced by each `update-readiness-signals`
	 * input from the host. Strict-mode gating is applied at derivation time
	 * through `createReadinessDetail`.
	 */
	readinessSignals: EngineReadinessSignals;

	/**
	 * Readiness mode of the last `update-readiness-signals` input. Kept with
	 * the signals so `section-controller-resolved` can apply a snapshot that
	 * arrived while the controller was pending.
	 */
	readinessMode: "progressive" | "strict";

	/** Last resolved effective runtime (output of `resolveRuntime`). */
	effectiveRuntime: EffectiveRuntime | null;

	/** Last resolved tools config. */
	effectiveToolsConfig: unknown;

	/**
	 * `true` once the engine has emitted `loading-complete` for the
	 * current cohort. Re-armed on cohort change. The single-shot
	 * semantics of the canonical `pie-loading-complete` event are
	 * preserved by gating emission on this flag in the transition.
	 */
	loadingCompleteEmitted: boolean;

	/** Number of items in the current cohort's composition. */
	itemCount: number;
};

/**
 * Initial state. Kept as a function so callers cannot mutate a shared
 * default by reference.
 */
export function createInitialEngineState(): SectionEngineState {
	return {
		phase: "idle",
		cohort: null,
		controllerResolved: false,
		readinessSignals: {
			sectionReady: false,
			interactionReady: false,
			allLoadingComplete: false,
			runtimeError: false,
		},
		readinessMode: "progressive",
		effectiveRuntime: null,
		effectiveToolsConfig: null,
		loadingCompleteEmitted: false,
		itemCount: 0,
	};
}
