/**
 * Stage-emit suppression gate (M7 PR 6).
 *
 * `PieAssessmentToolkit.svelte` builds a `createStageTracker(...)` whose
 * `emit` callback dispatches the toolkit CE's `pie-stage-change` DOM
 * event and invokes the runtime-tier `onStageChange` callback. PR 6
 * introduces the wrapped/standalone branch:
 *
 *   - **Standalone** (no upstream `SectionRuntimeEngine` provider on
 *     the layout CE host): emit + `onStageChange` fire as before.
 *   - **Wrapped** (kernel publishes its engine via
 *     `sectionRuntimeEngineHostContext` and the toolkit consumer
 *     resolves it): emit + `onStageChange` are suppressed on the
 *     toolkit CE, because the kernel's engine already emits the
 *     canonical `pie-stage-change` chain on the layout CE host and
 *     invokes the runtime-tier callback. Without suppression the
 *     toolkit CE would also dispatch its own event, which bubbles
 *     through `composed: true` to the layout CE host and produces a
 *     duplicate emission for outside listeners.
 *
 * The internal `stageTracker` latch state advances **before** this
 * helper is reached (the latch is updated inside
 * `createStageTracker.enter` prior to `opts.emit(...)`), so suppression
 * here only short-circuits the externally-visible side effects. The
 * toolkit's own readiness path (`waitUntilReady` / `engine-ready` /
 * `interactive`) keeps working in standalone mode and degenerates into
 * a series of suppressed emits in wrapped mode without losing any
 * latch transitions.
 *
 * Splitting this helper out of the inline `emit:` closure in
 * `PieAssessmentToolkit.svelte` lets us pin the suppression branch in a
 * unit test without mounting the toolkit CE — see
 * `tests/runtime/stage-emit-gate.test.ts`. The closure in the toolkit
 * passes thunks for `isSuppressed` and `getOnStageChange` so the live
 * Svelte reactive variables (`upstreamEngine`, `onStageChange`) are
 * read at emit time, not captured at construction time. This keeps the
 * pre-PR-6 behavior of always reading the latest `onStageChange` prop
 * value (cohort change, host swap, etc.) intact.
 *
 * NOT a public surface: this helper is internal to the toolkit and is
 * not exported from `runtime/engine.ts`. It only exists to make the
 * gate testable.
 */

import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";

export type StageOnChangeHandler = (detail: StageChangeDetail) => void;

export interface StageEmitGateContext {
	/**
	 * Reads the current suppression flag. Implemented as a thunk so
	 * the reactive Svelte `$state(upstreamEngine)` is read at emit
	 * time. Return `true` to suppress; `false` to fire.
	 */
	isSuppressed: () => boolean;

	/**
	 * Dispatches the `pie-stage-change` DOM event on the toolkit's
	 * CE host. In `PieAssessmentToolkit.svelte` this is the
	 * Svelte-generated `emit("pie-stage-change", detail)` helper.
	 */
	dispatchDomEvent: (detail: StageChangeDetail) => void;

	/**
	 * Reads the current `onStageChange` runtime-tier callback. Thunk
	 * so the latest reassigned handler is invoked, not whichever
	 * handler was current at construction time.
	 */
	getOnStageChange: () => StageOnChangeHandler | null | undefined;

	/**
	 * Optional logger for handler errors. Defaults to `console.error`
	 * with the same prefix the toolkit used pre-PR-6 so test output
	 * matches production logs.
	 */
	logHandlerError?: (error: unknown) => void;
}

const defaultLogHandlerError = (error: unknown): void => {
	console.error("[pie-assessment-toolkit] onStageChange handler threw", error);
};

/**
 * Run the toolkit's stage emit pipeline with the suppression gate
 * applied.
 *
 *   - When `isSuppressed()` returns `true`, the helper returns
 *     immediately with neither side effect.
 *   - Otherwise it dispatches the `pie-stage-change` DOM event first,
 *     then invokes `onStageChange(detail)` (preserving the
 *     "DOM-event-then-callback" ordering pre-PR-6 consumers depend
 *     on).
 *   - A throwing `onStageChange` handler does not interrupt the DOM
 *     event (already fired) and does not propagate up to
 *     `stageTracker.enter` (latch state already advanced); the error
 *     is logged and swallowed, matching pre-PR-6 behavior.
 *
 * Returns `true` if the emit pipeline ran (i.e. it was not
 * suppressed); `false` if it was suppressed. Tests use the return
 * value to assert the gate's decision in isolation from the side
 * effects.
 */
export function runStageEmitWithSuppression(
	context: StageEmitGateContext,
	detail: StageChangeDetail,
): boolean {
	if (context.isSuppressed()) {
		return false;
	}
	context.dispatchDomEvent(detail);
	const handler = context.getOnStageChange();
	if (handler) {
		try {
			handler(detail);
		} catch (error) {
			(context.logHandlerError ?? defaultLogHandlerError)(error);
		}
	}
	return true;
}
