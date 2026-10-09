/**
 * DOM event bridge for the section runtime engine adapter.
 *
 * Translates engine outputs (`stage-change`, `loading-complete`) into
 * `pie-stage-change` and `pie-loading-complete` on the host element. Both are
 * dispatched with `CROSS_BOUNDARY_EVENT_INIT` (bubbling, composed), the init
 * every other runtime event uses, so a listener above the layout element hears
 * them as it hears `toolkit-ready` or `framework-error`.
 *
 * **Detail-shape contract.** The core emits structurally minimal outputs
 * (`{ stage, status, cohort }`, `{ cohort, itemCount }`). The bridge enriches
 * them with `runtimeId`, `sourceCe`, `timestamp` and, on loading-complete,
 * `loadedCount` (equal to `itemCount`) so the
 * dispatched detail matches `StageChangeDetail` and `LoadingCompleteDetail` in
 * `packages/players-shared/src/pie/stages.ts`. `runtimeId` and `sourceCe` are
 * fixed per engine; `timestamp` comes from the injected `now()` clock.
 *
 * The bridge only translates: ordering and once-per-cohort gating belong to
 * the transition function. It must not import `svelte`.
 */

import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type { SectionEngineOutput } from "../core/engine-output.js";
import { dispatchCrossBoundaryEvent } from "../tool-host-contract.js";

export interface DomEventBridgeOptions {
	/** Element on which to dispatch the DOM events. */
	host: EventTarget;
	/** Stable runtime id for this engine instance. */
	runtimeId: string;
	/**
	 * Tag name of the host CE without the `--version-<encoded>` suffix.
	 * Each layout CE that mounts the kernel passes its own canonical tag
	 * name.
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
		dispatchCrossBoundaryEvent(host, "pie-stage-change", detail);
	}

	function dispatchLoadingComplete(
		output: Extract<SectionEngineOutput, { kind: "loading-complete" }>,
	): void {
		const detail: LoadingCompleteDetail = {
			runtimeId,
			sectionId: output.cohort.sectionId,
			attemptId: output.cohort.attemptId ? output.cohort.attemptId : undefined,
			itemCount: output.itemCount,
			loadedCount: output.itemCount,
			timestamp: now(),
			sourceCe,
		};
		dispatchCrossBoundaryEvent(host, "pie-loading-complete", detail);
	}

	function dispatch(output: SectionEngineOutput): void {
		switch (output.kind) {
			case "stage-change":
				dispatchStageChange(output);
				return;
			case "loading-complete":
				dispatchLoadingComplete(output);
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
