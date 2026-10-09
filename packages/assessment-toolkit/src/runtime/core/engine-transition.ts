/**
 * Pure transition function for the section runtime engine.
 *
 * `transition(state, input)` is total over `(state, input)` pairs and
 * returns:
 *   - the next `SectionEngineState` (the input state object is never
 *     mutated);
 *   - the ordered list of `SectionEngineOutput`s the adapter dispatches.
 *
 * The function imports nothing from Svelte, the DOM, or the coordinator;
 * `scripts/check-engine-core-purity.mjs` enforces that.
 *
 * Phase machine (per `engine-state.ts`):
 *   idle → booting-section → engine-ready → interactive → disposed
 *   booting-section | engine-ready → failed → disposed
 *   (cohort-change emits `disposed` for the outgoing cohort and restarts at
 *    booting-section for the new one)
 *
 * A readiness update that reports `runtimeError` before `interactive` ends the
 * chain: the first stage the cohort did not reach is recorded as `failed` and
 * any after it as `skipped`, so a host waiting on `engine-ready` or
 * `interactive` always hears an answer.
 *
 * Output ordering invariants:
 *   1. `stage-change` for stage advancement fires before any
 *      `loading-complete` triggered by the same input.
 *   2. `loading-complete` fires once per cohort, gated on
 *      `state.loadingCompleteEmitted`.
 */

import { cohortsEqual, type CohortKey } from "./cohort.js";
import type { SectionEngineInput } from "./engine-input.js";
import type { SectionEngineOutput } from "./engine-output.js";
import {
	createReadinessDetail,
	type EngineReadinessSignals,
} from "./engine-readiness.js";
import type { Stage } from "@pie-players/pie-players-shared/pie";
import {
	createInitialEngineState,
	type SectionEnginePhase,
	type SectionEngineState,
} from "./engine-state.js";

export interface TransitionResult {
	state: SectionEngineState;
	outputs: SectionEngineOutput[];
}

/** `idle` and `failed` have no stage of their own. */
function phaseToStage(phase: SectionEnginePhase): Stage | null {
	switch (phase) {
		case "idle":
		case "failed":
			return null;
		case "booting-section":
			return "composed";
		case "engine-ready":
			return "engine-ready";
		case "interactive":
			return "interactive";
		case "disposed":
			return "disposed";
	}
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
		readinessMode: args.state.readinessMode,
		effectiveRuntime: args.effectiveRuntime,
		effectiveToolsConfig: args.effectiveToolsConfig,
		itemCount: args.itemCount,
	};
	const outputs: SectionEngineOutput[] = [];
	emitStageChange(outputs, "booting-section", args.cohort);
	return { state: next, outputs };
}

/**
 * End the chain of a cohort that has not reached `interactive`. Returns the
 * `failed` phase after recording the stages it will not reach.
 */
function failChain(
	outputs: SectionEngineOutput[],
	phase: "booting-section" | "engine-ready",
	cohort: CohortKey | null,
): SectionEnginePhase {
	if (phase === "booting-section") {
		emitStageChange(outputs, "engine-ready", cohort, "failed");
		emitStageChange(outputs, "interactive", cohort, "skipped");
	} else {
		emitStageChange(outputs, "interactive", cohort, "failed");
	}
	return "failed";
}

/**
 * Apply a readiness update: store new signals, derive the detail in
 * the requested mode, end the chain on a runtime error before
 * `interactive`, advance the phase to `interactive` when gated, and emit
 * `loading-complete` once per cohort.
 */
function applyReadinessUpdate(
	state: SectionEngineState,
	args: {
		signals: EngineReadinessSignals;
		mode: "progressive" | "strict";
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

	let phase: SectionEnginePhase = state.phase;
	let loadingCompleteEmitted = state.loadingCompleteEmitted;

	if (
		args.signals.runtimeError &&
		(phase === "booting-section" || phase === "engine-ready")
	) {
		phase = failChain(outputs, phase, state.cohort);
	} else if (phase === "engine-ready" && detail.interactionReady) {
		// engine-ready → interactive when readiness satisfies
		// `interactionReady` (mode-aware via `createReadinessDetail`).
		phase = "interactive";
		emitStageChange(outputs, phase, state.cohort);
	}

	// Canonical `loading-complete` emission. One-shot per cohort, gated
	// on the readiness signals indicating every item has finished
	// loading.
	if (detail.allLoadingComplete && state.cohort && !loadingCompleteEmitted) {
		loadingCompleteEmitted = true;
		outputs.push({
			kind: "loading-complete",
			cohort: state.cohort,
			itemCount: args.itemCount,
		});
	}

	const nextState: SectionEngineState = {
		...state,
		phase,
		readinessSignals: args.signals,
		readinessMode: args.mode,
		itemCount: args.itemCount,
		loadingCompleteEmitted,
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
				// Either too early (idle), too late (interactive / failed /
				// disposed), or a duplicate notification; the FSM is monotonic.
				return {
					state: { ...state, controllerResolved: true },
					outputs: [],
				};
			}
			const outputs: SectionEngineOutput[] = [];
			emitStageChange(outputs, "engine-ready", state.cohort);
			// Readiness can be satisfied before the controller resolves: with
			// preloaded elements the items load in the same flush as the
			// composition. No later signal change would move the cohort on, so
			// the stored snapshot gates `interactive` here.
			let phase: SectionEnginePhase = "engine-ready";
			if (
				createReadinessDetail({
					mode: state.readinessMode,
					signals: state.readinessSignals,
				}).interactionReady
			) {
				phase = "interactive";
				emitStageChange(outputs, phase, state.cohort);
			}
			return {
				state: {
					...state,
					phase,
					controllerResolved: true,
				},
				outputs,
			};
		}

		case "update-readiness-signals": {
			return applyReadinessUpdate(state, {
				signals: input.signals,
				mode: input.mode,
				itemCount: input.itemCount,
			});
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
