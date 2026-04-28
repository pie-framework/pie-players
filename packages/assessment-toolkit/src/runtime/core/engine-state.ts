/**
 * Section runtime engine state (M7 — Variant C, layered core).
 *
 * The state object is the single source of truth for stage, cohort,
 * readiness signals, and the resolved coordinator/controller handles
 * across one engine instance. The transition function in
 * `engine-transition.ts` is the only legal mutator; the adapter (M7
 * PR 2) reads the state via `SectionEngineCore.getState()` and emits
 * the bundled `SectionEngineOutput[]` to its bridges.
 *
 * Phases (the FSM). Adjustment A2 of the M7 implementation plan locks
 * this list to four phases that map 1:1 onto the M6 canonical stages:
 *
 *   `idle`             → no cohort yet (before `initialize`).
 *   `booting-section`  → cohort known, controller resolution pending. Maps to stage `composed`.
 *   `engine-ready`     → controller resolved. Maps to stage `engine-ready`.
 *   `interactive`      → readiness gate satisfied. Maps to stage `interactive`.
 *   `disposed`         → engine torn down. Maps to stage `disposed`.
 *
 * `loading-complete` is intentionally **not** an FSM phase — it is a
 * `SectionEngineOutput` emitted from the `interactive` phase when the
 * readiness signals satisfy `allLoadingComplete`. See
 * `engine-output.ts` for the output shape and the implementation
 * plan's Adjustment A2 fence.
 */

import type { CohortKey } from "./cohort.js";
import type { EffectiveRuntime } from "./engine-resolver.js";
import type { EngineReadinessSignals } from "./engine-readiness.js";
import type { FrameworkErrorModel } from "../../services/framework-error.js";

export type SectionEnginePhase =
	| "idle"
	| "booting-section"
	| "engine-ready"
	| "interactive"
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
	 * Readiness signal snapshot. Updated by `update-readiness-signals`
	 * inputs from the host (kernel) — the engine itself does not
	 * compute these from scratch in PR 1. Strict-mode gating is
	 * applied at derivation time via `createReadinessDetail`, not by
	 * mutating the signals.
	 */
	readinessSignals: EngineReadinessSignals;

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

	/**
	 * Most recent framework error, if any. The engine routes errors
	 * through outputs, not through state — this field is kept so
	 * subscribers asking for the latest snapshot (e.g. error banners)
	 * can read it without replaying the output stream.
	 */
	lastFrameworkError: FrameworkErrorModel | null;

	/** Number of items the host has registered for the current cohort. */
	itemCount: number;

	/** Number of items reported as loaded. */
	loadedCount: number;
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
		effectiveRuntime: null,
		effectiveToolsConfig: null,
		loadingCompleteEmitted: false,
		lastFrameworkError: null,
		itemCount: 0,
		loadedCount: 0,
	};
}
