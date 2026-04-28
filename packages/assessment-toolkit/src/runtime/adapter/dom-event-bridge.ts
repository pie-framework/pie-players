/**
 * DOM event bridge for the section runtime engine adapter (M7 — Variant
 * C, layered).
 *
 * Translates canonical engine outputs (`stage-change`,
 * `loading-complete`, `framework-error`) into DOM `CustomEvent`
 * dispatches on the host element. Mirrors the kernel's existing
 * `dispatch("pie-stage-change", …)` / `dispatch("pie-loading-complete", …)`
 * / `dispatch("framework-error", …)` emit chain bit-for-bit so the M6
 * canonical event surface stays stable while the kernel migrates onto
 * the engine in PR 5.
 *
 * **Detail-shape contract.** The engine core emits structurally minimal
 * outputs (`{ stage, status, cohort }`, `{ cohort, itemCount,
 * loadedCount }`). The bridge enriches them with `runtimeId`,
 * `sourceCe`, and `timestamp` so the dispatched DOM event detail
 * matches the legacy
 * `packages/players-shared/src/pie/stages.ts#StageChangeDetail` and
 * `LoadingCompleteDetail` shapes verbatim. `runtimeId` and `sourceCe`
 * are supplied at adapter construction time (one per engine instance);
 * `timestamp` is captured per-emit via the injected `now()` clock so
 * tests can pin a deterministic value.
 *
 * **Why not import the stage tracker.** The tracker's monotonic /
 * skipped-fill enforcement now lives in the engine core's transition
 * function. The bridge is purely an output-to-DOM translator — it does
 * not gate emissions, does not re-order, does not de-duplicate. That
 * keeps the responsibility clean and matches the "outputs are already
 * ordered correctly by the core" contract from
 * `engine-transition.ts`.
 *
 * The bridge **must not** import `svelte`; per the M7 layering
 * constraint the adapter is plain TS.
 */

import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type { SectionEngineOutput } from "../core/engine-output.js";

export interface DomEventBridgeOptions {
	/** Element on which to dispatch the DOM events. */
	host: EventTarget;
	/** Stable runtime id for this engine instance. */
	runtimeId: string;
	/**
	 * Tag name of the host CE without the `--version-<encoded>` suffix.
	 * Each layout CE that mounts the kernel passes its own canonical tag
	 * name; the toolkit CE passes its own.
	 */
	sourceCe: string;
	/**
	 * Clock injection for tests. Defaults to `() => new Date().toISOString()`.
	 */
	now?: () => string;
}

export interface DomEventBridgeHandle {
	/** Translate a single engine output into a DOM dispatch. */
	dispatch(output: SectionEngineOutput): void;
	/**
	 * Update the host element after construction (e.g. when the kernel
	 * receives its host element via Svelte action / context). The
	 * bridge keeps the latest host; future dispatches go to that host.
	 */
	setHost(host: EventTarget): void;
}

export function createDomEventBridge(
	options: DomEventBridgeOptions,
): DomEventBridgeHandle {
	const { runtimeId, sourceCe } = options;
	let host: EventTarget = options.host;
	const now = options.now ?? (() => new Date().toISOString());

	function dispatchStageChange(
		output: Extract<SectionEngineOutput, { kind: "stage-change" }>,
	): void {
		const detail: StageChangeDetail = {
			stage: output.stage,
			status: output.status,
			runtimeId,
			sectionId: output.cohort?.sectionId,
			attemptId: output.cohort?.attemptId ? output.cohort.attemptId : undefined,
			timestamp: now(),
			sourceCe,
		};
		host.dispatchEvent(
			new CustomEvent<StageChangeDetail>("pie-stage-change", { detail }),
		);
	}

	function dispatchLoadingComplete(
		output: Extract<SectionEngineOutput, { kind: "loading-complete" }>,
	): void {
		const detail: LoadingCompleteDetail = {
			runtimeId,
			sectionId: output.cohort.sectionId,
			attemptId: output.cohort.attemptId ? output.cohort.attemptId : undefined,
			itemCount: output.itemCount,
			loadedCount: output.loadedCount,
			timestamp: now(),
			sourceCe,
		};
		host.dispatchEvent(
			new CustomEvent<LoadingCompleteDetail>("pie-loading-complete", {
				detail,
			}),
		);
	}

	function dispatchFrameworkError(
		output: Extract<SectionEngineOutput, { kind: "framework-error" }>,
	): void {
		// Mirror the kernel's existing surface — the `framework-error`
		// DOM event detail is the framework-error model. The
		// `framework-error-bridge` separately reports the same model
		// into the bus so subscribers see one fan-out per error.
		host.dispatchEvent(
			new CustomEvent("framework-error", { detail: output.error }),
		);
	}

	function dispatch(output: SectionEngineOutput): void {
		switch (output.kind) {
			case "stage-change":
				dispatchStageChange(output);
				return;
			case "loading-complete":
				dispatchLoadingComplete(output);
				return;
			case "framework-error":
				dispatchFrameworkError(output);
				return;
			default: {
				const exhaustive: never = output;
				void exhaustive;
				return;
			}
		}
	}

	function setHost(next: EventTarget): void {
		host = next;
	}

	return { dispatch, setHost };
}
