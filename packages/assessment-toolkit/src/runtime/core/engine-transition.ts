/**
 * Pure transition function for the section runtime engine (M7 — Variant
 * C, layered core).
 *
 * `transition(state, input)` is total over `(state, input)` pairs and
 * returns:
 *   - the next `SectionEngineState` (immutable; the input state object
 *     is never mutated);
 *   - the ordered list of `SectionEngineOutput`s the adapter must
 *     dispatch (DOM events, framework-error fan-out, legacy event
 *     mirrors, etc.).
 *
 * The function imports nothing from Svelte, the DOM, or the
 * coordinator. The `core/` constraint is enforced by the per-PR audit
 * step in the M7 implementation plan.
 *
 * Phase machine (per `engine-state.ts`):
 *   idle → booting-section → engine-ready → interactive → disposed
 *   (cohort-change rolls back to booting-section for the new cohort
 *    after emitting `disposed` for the outgoing cohort)
 *
 * Output ordering invariants (preserved bit-for-bit from the kernel's
 * legacy emit order, M7 PR 1 acceptance):
 *   1. `stage-change` for stage advancement fires *before* the
 *      readiness-change-derived legacy outputs for the same input.
 *   2. `readiness-change` always fires before `interaction-ready` /
 *      `ready` for the same readiness update.
 *   3. `loading-complete` fires after `ready` because the kernel's
 *      legacy chain emits in that order.
 *   4. `framework-error` outputs are independent of the stage chain
 *      and do not move the phase.
 */

import { cohortsEqual, type CohortKey } from "./cohort.js";
import type { SectionEngineInput } from "./engine-input.js";
import type { SectionEngineOutput } from "./engine-output.js";
import {
	createReadinessDetail,
	type EngineReadinessDetail,
	type EngineReadinessSignals,
} from "./engine-readiness.js";
import { phaseToStage } from "./engine-stage-derivation.js";
import {
	createInitialEngineState,
	type SectionEnginePhase,
	type SectionEngineState,
} from "./engine-state.js";

export interface TransitionResult {
	state: SectionEngineState;
	outputs: SectionEngineOutput[];
}

function readinessDetailsEqual(
	a: EngineReadinessDetail | null,
	b: EngineReadinessDetail | null,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.phase === b.phase &&
		a.interactionReady === b.interactionReady &&
		a.allLoadingComplete === b.allLoadingComplete &&
		a.reason === b.reason
	);
}

function emitStageChange(
	outputs: SectionEngineOutput[],
	phase: SectionEnginePhase,
	cohort: CohortKey | null,
	status: "entered" | "skipped" | "failed" = "entered",
): void {
	const stage = phaseToStage(phase);
	if (!stage) return;
	outputs.push({ kind: "stage-change", stage, status, cohort });
}

/**
 * Transition the engine after `initialize` / `cohort-change`. Sets
 * the new cohort, resets latches, stores the resolved runtime/tools,
 * and emits the `composed` stage.
 */
function startCohort(args: {
	state: SectionEngineState;
	cohort: CohortKey;
	effectiveRuntime: SectionEngineState["effectiveRuntime"];
	effectiveToolsConfig: unknown;
	itemCount: number;
}): { state: SectionEngineState; outputs: SectionEngineOutput[] } {
	const next: SectionEngineState = {
		...createInitialEngineState(),
		phase: "booting-section",
		cohort: args.cohort,
		effectiveRuntime: args.effectiveRuntime,
		effectiveToolsConfig: args.effectiveToolsConfig,
		itemCount: args.itemCount,
	};
	const outputs: SectionEngineOutput[] = [];
	emitStageChange(outputs, "booting-section", args.cohort);
	return { state: next, outputs };
}

/**
 * Apply a readiness update: store new signals, derive the detail in
 * the requested mode, emit `readiness-change` if the detail changed,
 * fire one-shot legacy emits, advance the phase to `interactive` when
 * gated, and emit `loading-complete` once per cohort.
 */
function applyReadinessUpdate(
	state: SectionEngineState,
	args: {
		signals: EngineReadinessSignals;
		mode: "progressive" | "strict";
		loadedCount: number;
		itemCount: number;
	},
): TransitionResult {
	if (state.phase === "idle" || state.phase === "disposed") {
		// No cohort to update; ignore.
		return { state, outputs: [] };
	}

	const detail = createReadinessDetail({
		mode: args.mode,
		signals: args.signals,
	});
	const outputs: SectionEngineOutput[] = [];

	let phase = state.phase;
	let interactionReadyEmitted = state.interactionReadyEmitted;
	let readyEmitted = state.readyEmitted;
	let loadingCompleteEmitted = state.loadingCompleteEmitted;

	// Stage advancement: engine-ready → interactive when readiness
	// satisfies `interactionReady` (mode-aware via `createReadinessDetail`).
	if (phase === "engine-ready" && detail.interactionReady) {
		phase = "interactive";
		emitStageChange(outputs, phase, state.cohort);
	}

	// Readiness-change emission. Always fires when the detail differs
	// from the previously emitted detail.
	if (!readinessDetailsEqual(detail, state.lastReadinessDetail)) {
		outputs.push({ kind: "readiness-change", detail });
	}

	// Legacy `interaction-ready` one-shot per cohort.
	if (detail.interactionReady && !interactionReadyEmitted) {
		interactionReadyEmitted = true;
		outputs.push({ kind: "interaction-ready", detail });
	}

	// Legacy `ready` one-shot per cohort + canonical `loading-complete`.
	if (detail.allLoadingComplete && !readyEmitted) {
		readyEmitted = true;
		outputs.push({ kind: "ready", detail });
		if (state.cohort && !loadingCompleteEmitted) {
			loadingCompleteEmitted = true;
			outputs.push({
				kind: "loading-complete",
				cohort: state.cohort,
				itemCount: args.itemCount,
				loadedCount: args.loadedCount,
			});
		}
	}

	const nextState: SectionEngineState = {
		...state,
		phase,
		readinessSignals: args.signals,
		loadedCount: args.loadedCount,
		itemCount: args.itemCount,
		interactionReadyEmitted,
		readyEmitted,
		loadingCompleteEmitted,
		lastReadinessDetail: detail,
	};
	return { state: nextState, outputs };
}

/**
 * Pure transition. Total over `(state, input)`; never mutates inputs;
 * never throws. Unhandled inputs after `disposed` fall through to a
 * no-op (the adapter is responsible for not feeding them in, but the
 * core stays safe by design).
 */
export function transition(
	state: SectionEngineState,
	input: SectionEngineInput,
): TransitionResult {
	switch (input.kind) {
		case "initialize": {
			if (state.phase === "disposed") {
				// The engine has been disposed; ignore.
				return { state, outputs: [] };
			}
			if (state.phase !== "idle") {
				// Already initialized. Treat as `update-runtime` for the
				// current cohort if the cohort matches; otherwise treat as
				// a `cohort-change`.
				if (cohortsEqual(state.cohort, input.cohort)) {
					return transition(state, {
						kind: "update-runtime",
						effectiveRuntime: input.effectiveRuntime,
						effectiveToolsConfig: input.effectiveToolsConfig,
					});
				}
				return transition(state, {
					kind: "cohort-change",
					cohort: input.cohort,
					effectiveRuntime: input.effectiveRuntime,
					effectiveToolsConfig: input.effectiveToolsConfig,
					itemCount: input.itemCount,
				});
			}
			return startCohort({
				state,
				cohort: input.cohort,
				effectiveRuntime: input.effectiveRuntime,
				effectiveToolsConfig: input.effectiveToolsConfig,
				itemCount: input.itemCount,
			});
		}

		case "update-runtime": {
			if (state.phase === "idle" || state.phase === "disposed") {
				return { state, outputs: [] };
			}
			return {
				state: {
					...state,
					effectiveRuntime: input.effectiveRuntime,
					effectiveToolsConfig: input.effectiveToolsConfig,
				},
				outputs: [],
			};
		}

		case "cohort-change": {
			if (state.phase === "disposed") {
				return { state, outputs: [] };
			}
			if (cohortsEqual(state.cohort, input.cohort)) {
				// No-op cohort change; fall back to a runtime update.
				return transition(state, {
					kind: "update-runtime",
					effectiveRuntime: input.effectiveRuntime,
					effectiveToolsConfig: input.effectiveToolsConfig,
				});
			}
			const outputs: SectionEngineOutput[] = [];
			if (state.phase !== "idle") {
				// Emit `disposed` for the outgoing cohort before we wipe state.
				outputs.push({
					kind: "stage-change",
					stage: "disposed",
					status: "entered",
					cohort: state.cohort,
				});
			}
			const started = startCohort({
				state,
				cohort: input.cohort,
				effectiveRuntime: input.effectiveRuntime,
				effectiveToolsConfig: input.effectiveToolsConfig,
				itemCount: input.itemCount,
			});
			return {
				state: started.state,
				outputs: [...outputs, ...started.outputs],
			};
		}

		case "section-controller-resolved": {
			if (state.phase !== "booting-section") {
				// Either too early (idle), too late (interactive / disposed),
				// or a duplicate notification; the FSM is monotonic.
				return {
					state: { ...state, controllerResolved: true },
					outputs: [],
				};
			}
			const outputs: SectionEngineOutput[] = [];
			emitStageChange(outputs, "engine-ready", state.cohort);
			return {
				state: {
					...state,
					phase: "engine-ready",
					controllerResolved: true,
				},
				outputs,
			};
		}

		case "update-readiness-signals": {
			return applyReadinessUpdate(state, {
				signals: input.signals,
				mode: input.mode,
				loadedCount: input.loadedCount,
				itemCount: input.itemCount,
			});
		}

		case "framework-error": {
			return {
				state: {
					...state,
					lastFrameworkError: input.error,
					readinessSignals: {
						...state.readinessSignals,
						runtimeError: true,
					},
				},
				outputs: [{ kind: "framework-error", error: input.error }],
			};
		}

		case "dispose": {
			if (state.phase === "disposed") {
				return { state, outputs: [] };
			}
			const outputs: SectionEngineOutput[] = [];
			if (state.phase !== "idle") {
				emitStageChange(outputs, "disposed", state.cohort);
			}
			return {
				state: {
					...state,
					phase: "disposed",
				},
				outputs,
			};
		}

		default: {
			const exhaustive: never = input;
			void exhaustive;
			return { state, outputs: [] };
		}
	}
}
