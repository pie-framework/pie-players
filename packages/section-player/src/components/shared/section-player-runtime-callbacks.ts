/**
 * Lockstep runtime-callback bridge (M7 PR 5).
 *
 * The section runtime engine's DOM-event bridge dispatches the canonical
 * `pie-stage-change` and `pie-loading-complete` events directly on the
 * layout CE host. This helper installs matching `addEventListener`s on
 * the same host so the resolved `runtime.onStageChange` and
 * `runtime.onLoadingComplete` callbacks fire at the exact same emit
 * point as the DOM events for that cohort.
 *
 * Why a helper (and not just an inline `$effect` block in
 * `SectionPlayerLayoutKernel.svelte`):
 *
 *   - Lets unit tests under `packages/section-player/tests/` exercise
 *     the lockstep contract directly with a real
 *     `SectionRuntimeEngine`, without spinning up Svelte mount
 *     infrastructure.
 *   - Forces a future refactor that drops the kernel listener wiring
 *     to also drop this helper, making the deletion visible in code
 *     review.
 *
 * Handler lookup is intentionally lazy. The bridge calls the supplied
 * `get*` accessors *each time* the engine fires a DOM event so a
 * `runtime` prop reassign mid-cohort still reaches the freshest
 * handler reference. Capturing the handler at attach time would freeze
 * the closure to whatever was passed when the kernel last subscribed.
 */

import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type {
	LoadingCompleteHandler,
	StageChangeHandler,
} from "@pie-players/pie-assessment-toolkit/runtime/internal";

export type RuntimeCallbackBridgeChannel =
	| "onStageChange"
	| "onLoadingComplete";

export interface RuntimeCallbackBridgeOptions {
	/** Layout CE host element the engine dispatches DOM events on. */
	host: HTMLElement;
	/**
	 * Late-bound accessor for the resolved `runtime.onStageChange`. The
	 * bridge calls this on each `pie-stage-change` event so prop
	 * reassigns mid-cohort still reach the latest handler.
	 */
	getOnStageChange: () => StageChangeHandler | undefined;
	/**
	 * Late-bound accessor for the resolved
	 * `runtime.onLoadingComplete`. Called on each
	 * `pie-loading-complete` event for the same reason as
	 * `getOnStageChange`.
	 */
	getOnLoadingComplete: () => LoadingCompleteHandler | undefined;
	/**
	 * Optional error sink invoked when a host callback throws. The
	 * kernel pipes this into its logger so `runtime.on*` exceptions
	 * surface in `pie-debug` without breaking the engine's own
	 * dispatch path.
	 */
	onError?: (channel: RuntimeCallbackBridgeChannel, error: unknown) => void;
}

/**
 * Attach the lockstep callback bridge. Returns a teardown that removes
 * both DOM listeners; the kernel runs it from its `$effect` cleanup so
 * subsequent host swaps or unmounts release the listeners cleanly.
 */
export function attachRuntimeCallbackBridge(
	options: RuntimeCallbackBridgeOptions,
): () => void {
	const { host, getOnStageChange, getOnLoadingComplete, onError } = options;

	const stageHandler = (event: Event) => {
		const detail = (event as CustomEvent<StageChangeDetail>).detail;
		const handler = getOnStageChange();
		if (!handler) return;
		try {
			handler(detail);
		} catch (error) {
			onError?.("onStageChange", error);
		}
	};
	const loadingHandler = (event: Event) => {
		const detail = (event as CustomEvent<LoadingCompleteDetail>).detail;
		const handler = getOnLoadingComplete();
		if (!handler) return;
		try {
			handler(detail);
		} catch (error) {
			onError?.("onLoadingComplete", error);
		}
	};

	host.addEventListener("pie-stage-change", stageHandler);
	host.addEventListener("pie-loading-complete", loadingHandler);
	return () => {
		host.removeEventListener("pie-stage-change", stageHandler);
		host.removeEventListener("pie-loading-complete", loadingHandler);
	};
}
