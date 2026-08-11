/**
 * Composition emit scheduler (PIE-885).
 *
 * `PieAssessmentToolkit.svelte` publishes the section composition to the
 * players through exactly one path — the `composition-changed` event — and
 * coalesces bursts of updates behind a one-shot latch so several changes
 * within one frame produce a single emit.
 *
 * That latch used to be cleared only by a `requestAnimationFrame` callback,
 * and the frame branch was chosen whenever `window.requestAnimationFrame`
 * merely *existed* rather than when it was known to fire. In a document that
 * never paints the callback never ran, the latch never cleared, and no
 * `composition-changed` was ever dispatched: the section controller held a
 * correct view model while the player kept its initial empty composition, so
 * every `pie-section-player` route rendered no content at all. The permanent
 * failure was in contexts with no compositor — headless browsers, hidden or
 * offscreen tabs, agent and CI automation harnesses. A background tab only
 * rendered late, because its pending frame becomes due on refocus.
 *
 * So the frame is raced against a deadline timer instead of trusted. Whichever
 * arrives first releases the latch and flushes, and a non-painting document
 * degrades to a slower render rather than a permanent blank. Svelte's own
 * `tick()` races the same two primitives for the same reason.
 *
 * This scheduler owns the latch and both handles, which is what makes "the
 * latch cannot stay set after a scheduled frame is cancelled or superseded"
 * structural rather than a discipline every call site has to keep: releasing
 * the latch and releasing the handles is one operation in one place.
 *
 * Deliberately stateless across cycles. A cycle the timer wins does not switch
 * the scheduler into a timer-preferring mode: that trades the deadline cost for
 * a mode which never returns to frame alignment once a single frame is missed,
 * and a slower render is the accepted outcome.
 *
 * NOT a public surface: internal to the toolkit and not exported from
 * `runtime/engine.ts`. It exists as its own module so the race can be pinned in
 * a unit test without mounting the toolkit CE — same rationale as
 * `runtime/stage-emit-gate.ts`.
 */

/**
 * How long to wait for a frame before the timer takes over.
 *
 * Six frames at 60fps, so on any normally painting document the frame still
 * wins and emits stay paint-aligned. Chrome clamps timers in hidden tabs to
 * ≥1s and can clamp harder under intensive throttling; that makes a hidden tab
 * bounded-slow instead of blank, which is the point.
 */
export const DEFAULT_FRAME_DEADLINE_MS = 100;

/**
 * Timing primitives, injectable so tests can drive the race deterministically.
 *
 * An omitted primitive is resolved from `globalThis` at `schedule()` time
 * rather than captured at construction: the pre-fix code also checked per
 * emit, and a host can install a `requestAnimationFrame` shim after the
 * toolkit is constructed. An explicit `null` opts the primitive out.
 */
export interface CompositionEmitSchedulerTiming {
	requestFrame?: ((callback: () => void) => number) | null;
	cancelFrame?: ((handle: number) => void) | null;
	setTimer?: ((callback: () => void, delayMs: number) => unknown) | null;
	clearTimer?: ((handle: unknown) => void) | null;
	queueMicrotaskFn?: ((callback: () => void) => void) | null;
	frameDeadlineMs?: number;
}

export interface CompositionEmitScheduler {
	/**
	 * Arm a flush. While a cycle is pending this only replaces the stored
	 * callback — that is the coalescing guarantee: one resolution, one flush.
	 */
	schedule(flush: () => void): void;

	/**
	 * Abandon a pending cycle. Releases the latch and both handles together,
	 * and is idempotent.
	 */
	cancel(): void;

	isPending(): boolean;
}

type AmbientTiming = {
	requestAnimationFrame?: (callback: () => void) => number;
	cancelAnimationFrame?: (handle: number) => void;
	setTimeout?: (callback: () => void, delayMs: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
	queueMicrotask?: (callback: () => void) => void;
};

function pickFunction<T>(
	override: T | null | undefined,
	ambient: T | undefined,
): T | null {
	if (typeof override === "function") return override;
	if (override === null) return null;
	return typeof ambient === "function" ? ambient : null;
}

export function createCompositionEmitScheduler(
	timing: CompositionEmitSchedulerTiming = {},
): CompositionEmitScheduler {
	const frameDeadlineMs = timing.frameDeadlineMs ?? DEFAULT_FRAME_DEADLINE_MS;

	let pending = false;
	let pendingFlush: (() => void) | null = null;
	let frameHandle: number | null = null;
	let timerHandle: unknown = null;
	// Kept from the arming call so a cancel is paired with the primitive that
	// actually armed the handle.
	let cancelFrame: ((handle: number) => void) | null = null;
	let clearTimer: ((handle: unknown) => void) | null = null;

	function release(): void {
		pending = false;
		if (frameHandle !== null) {
			cancelFrame?.(frameHandle);
			frameHandle = null;
		}
		if (timerHandle !== null) {
			clearTimer?.(timerHandle);
			timerHandle = null;
		}
		cancelFrame = null;
		clearTimer = null;
	}

	/**
	 * Resolve one cycle. `firedFrom` names the side that arrived so its own
	 * handle is dropped rather than handed back to a cancel that has nothing
	 * left to cancel.
	 *
	 * The latch is released before the flush callback runs, so a re-entrant
	 * `schedule()` from inside the flush arms a fresh cycle instead of being
	 * swallowed. The pre-fix code cleared its latch first for the same reason.
	 */
	function resolve(firedFrom: "frame" | "timer" | "microtask"): void {
		if (!pending) return;
		if (firedFrom === "frame") frameHandle = null;
		if (firedFrom === "timer") timerHandle = null;
		const flushNow = pendingFlush;
		pendingFlush = null;
		release();
		flushNow?.();
	}

	function schedule(flush: () => void): void {
		pendingFlush = flush;
		if (pending) return;
		pending = true;

		const ambient = globalThis as unknown as AmbientTiming;
		const requestFrame = pickFunction(
			timing.requestFrame,
			ambient.requestAnimationFrame,
		);
		cancelFrame = pickFunction(timing.cancelFrame, ambient.cancelAnimationFrame);
		const setTimer = pickFunction(timing.setTimer, ambient.setTimeout);
		clearTimer = pickFunction(timing.clearTimer, ambient.clearTimeout);

		if (requestFrame) {
			const handle = requestFrame(() => resolve("frame"));
			// A primitive that calls back synchronously has already flushed and
			// released; arming anything else would leave a stray handle behind.
			if (!pending) return;
			frameHandle = handle;
			// The frame is not trusted to arrive. Without a timer alongside it, a
			// document that never paints leaves the latch set forever.
			if (setTimer) {
				const deadlineHandle = setTimer(
					() => resolve("timer"),
					frameDeadlineMs,
				);
				if (pending) timerHandle = deadlineHandle;
			}
			return;
		}

		// No frame primitive at all (SSR, non-DOM test environments). Preserve
		// the microtask timing those hosts already had.
		const queueMicrotaskFn = pickFunction(
			timing.queueMicrotaskFn,
			ambient.queueMicrotask,
		);
		if (queueMicrotaskFn) {
			queueMicrotaskFn(() => resolve("microtask"));
			return;
		}
		if (setTimer) {
			const deadlineHandle = setTimer(() => resolve("timer"), 0);
			if (pending) timerHandle = deadlineHandle;
			return;
		}
		// Nothing to defer with. A synchronous flush is strictly better than
		// dropping the composition on the floor.
		resolve("microtask");
	}

	function cancel(): void {
		if (!pending) return;
		pendingFlush = null;
		release();
	}

	return {
		schedule,
		cancel,
		isPending: () => pending,
	};
}
