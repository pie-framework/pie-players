/**
 * Section runtime engine inputs (M7 — Variant C, layered core).
 *
 * Inputs are the discriminated union of events the adapter (PR 2) feeds
 * into the pure transition function (`engine-transition.ts`). The shape
 * is closed: every field is plain data so the transition can be tested
 * without any DOM, Svelte, or coordinator wiring.
 *
 * Adapter→core boundary contract:
 *   - The adapter never mutates engine state directly. It always
 *     constructs an input and calls `core.dispatch(input)`.
 *   - Inputs are total: an unhandled `kind` is a programming error
 *     (the transition uses `assertNever` exhaustiveness).
 *   - Inputs carry only data, never live host references that would
 *     pin lifetime. Coordinator and controller handles live in the
 *     adapter; the core only sees readiness signals derived from them.
 */

import type { CohortKey } from "./cohort.js";
import type {
	EffectiveRuntime,
	RuntimeInputs,
} from "./engine-resolver.js";
import type { EngineReadinessSignals } from "./engine-readiness.js";
import type { FrameworkErrorModel } from "../../services/framework-error.js";

/**
 * `initialize` is the first transition out of `idle`. It carries the
 * cohort key and the resolved runtime/tools snapshot for the cohort.
 * The adapter constructs this input after running the resolver against
 * the host's two-tier inputs.
 */
export type EngineInputInitialize = {
	kind: "initialize";
	cohort: CohortKey;
	effectiveRuntime: EffectiveRuntime;
	effectiveToolsConfig: unknown;
	itemCount: number;
};

/**
 * `update-runtime` is sent when the host two-tier inputs change but
 * the cohort does not. The transition stores the latest resolver
 * output without changing phase; readiness gates and stage progression
 * stay where they are.
 */
export type EngineInputUpdateRuntime = {
	kind: "update-runtime";
	effectiveRuntime: EffectiveRuntime;
	effectiveToolsConfig: unknown;
};

/**
 * `cohort-change` is sent when `(sectionId, attemptId)` changes. The
 * transition emits `disposed` for the outgoing cohort, resets state
 * to `booting-section` for the new one, and re-arms latches.
 */
export type EngineInputCohortChange = {
	kind: "cohort-change";
	cohort: CohortKey;
	effectiveRuntime: EffectiveRuntime;
	effectiveToolsConfig: unknown;
	itemCount: number;
};

/**
 * `section-controller-resolved` is sent when the coordinator returns
 * the controller for the current cohort. Advances the phase from
 * `booting-section` → `engine-ready` (assuming `composed` is already
 * implied by `phase >= booting-section`, which the FSM treats as
 * monotonic).
 */
export type EngineInputSectionControllerResolved = {
	kind: "section-controller-resolved";
};

/**
 * `update-readiness-signals` carries the latest readiness snapshot
 * from the host. The transition uses it to gate the move into
 * `interactive` and to decide whether to emit `loading-complete`.
 *
 * The full signal set is sent every time so the transition does not
 * have to reason about partial overlays.
 */
export type EngineInputUpdateReadinessSignals = {
	kind: "update-readiness-signals";
	signals: EngineReadinessSignals;
	loadedCount: number;
	itemCount: number;
	/**
	 * Strict-mode gate. When `"strict"`, `interactive` only fires
	 * after `allLoadingComplete`; in `"progressive"`, `interactionReady`
	 * is sufficient. Carried per-input so the host can reconfigure
	 * mode mid-cohort without re-initializing.
	 */
	mode: "progressive" | "strict";
};

/**
 * `framework-error` is sent for every framework-error report (M3
 * canonical channel). The transition records the latest error in
 * state and emits a `framework-error` output so the adapter can fan
 * out to subscribers and the DOM event.
 */
export type EngineInputFrameworkError = {
	kind: "framework-error";
	error: FrameworkErrorModel;
};

/**
 * `dispose` tears the engine down. Emits `disposed` for the current
 * cohort (if any) and moves to the terminal `disposed` phase. After
 * dispose the engine accepts no further inputs (the transition logs
 * a warning and is a no-op).
 */
export type EngineInputDispose = {
	kind: "dispose";
};

export type SectionEngineInput =
	| EngineInputInitialize
	| EngineInputUpdateRuntime
	| EngineInputCohortChange
	| EngineInputSectionControllerResolved
	| EngineInputUpdateReadinessSignals
	| EngineInputFrameworkError
	| EngineInputDispose;

/**
 * Convenience re-export so the adapter can import `RuntimeInputs`
 * from a single place when it constructs `initialize` inputs.
 */
export type { RuntimeInputs };
