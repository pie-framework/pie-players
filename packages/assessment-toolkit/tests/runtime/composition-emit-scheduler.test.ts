/**
 * Composition emit scheduler tests (PIE-885).
 *
 * The bug: `PieAssessmentToolkit.svelte` armed only `requestAnimationFrame`
 * behind a one-shot emit latch, and picked that branch whenever
 * `window.requestAnimationFrame` merely existed. In a document that never
 * paints the callback never ran, the latch never cleared, and
 * `composition-changed` was never dispatched — so every `pie-section-player`
 * route rendered no content, permanently.
 *
 * Every timing primitive is injected, so the frame/timer race is driven by hand
 * rather than by wall-clock or by whatever a DOM shim decides to do. No DOM and
 * no Svelte mount, same approach as `stage-emit-gate.test.ts`.
 *
 * The three acceptance criteria map onto the cases below:
 *
 *   - **AC 1** (renders with no frame callbacks): "flushes on the deadline
 *     timer when the frame never arrives".
 *   - **AC 2** (latch cannot stay set after a cancelled/superseded frame):
 *     "cancel releases the latch…" and "…releases both handles".
 *   - **AC 3** (coalescing preserved): "coalesces repeated schedules…".
 *
 * The end-to-end half of AC 1 is
 * `pie-players` - `packages/section-player/tests/section-player-non-painting-document.spec.ts`,
 * which loads a real section with `requestAnimationFrame` stubbed dead.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
	createCompositionEmitScheduler,
	DEFAULT_FRAME_DEADLINE_MS,
	type CompositionEmitSchedulerTiming,
} from "../../src/runtime/composition-emit-scheduler.js";

interface Harness {
	timing: CompositionEmitSchedulerTiming;
	/** Invoke the queued frame callback, as a compositor would. */
	fireFrame(): void;
	/** Invoke the queued deadline callback, as an expiring timer would. */
	fireTimer(): void;
	frameRequests: number;
	timerRequests: Array<{ handle: number; delayMs: number }>;
	cancelledFrames: number[];
	clearedTimers: unknown[];
	/** Frame/timer handles still armed from the scheduler's point of view. */
	pendingFrameCallback: (() => void) | null;
	pendingTimerCallback: (() => void) | null;
}

/**
 * A frame source and a timer source that only fire when told to. Both hand out
 * monotonic handles from separate spaces so a cancel can be attributed to the
 * right side.
 */
function createHarness(
	overrides: CompositionEmitSchedulerTiming = {},
): Harness {
	const harness: Harness = {
		timing: {},
		fireFrame: () => {
			const callback = harness.pendingFrameCallback;
			harness.pendingFrameCallback = null;
			callback?.();
		},
		fireTimer: () => {
			const callback = harness.pendingTimerCallback;
			harness.pendingTimerCallback = null;
			callback?.();
		},
		frameRequests: 0,
		timerRequests: [],
		cancelledFrames: [],
		clearedTimers: [],
		pendingFrameCallback: null,
		pendingTimerCallback: null,
	};

	let nextFrameHandle = 100;
	let nextTimerHandle = 900;

	harness.timing = {
		requestFrame: (callback) => {
			harness.frameRequests += 1;
			harness.pendingFrameCallback = callback;
			nextFrameHandle += 1;
			return nextFrameHandle;
		},
		cancelFrame: (handle) => {
			harness.cancelledFrames.push(handle);
			harness.pendingFrameCallback = null;
		},
		setTimer: (callback, delayMs) => {
			nextTimerHandle += 1;
			harness.timerRequests.push({ handle: nextTimerHandle, delayMs });
			harness.pendingTimerCallback = callback;
			return nextTimerHandle;
		},
		clearTimer: (handle) => {
			harness.clearedTimers.push(handle);
			harness.pendingTimerCallback = null;
		},
		...overrides,
	};

	return harness;
}

describe("createCompositionEmitScheduler", () => {
	test("arms a frame and a deadline timer together", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);

		scheduler.schedule(() => {});

		expect(harness.frameRequests).toBe(1);
		expect(harness.timerRequests).toHaveLength(1);
		expect(harness.timerRequests[0]?.delayMs).toBe(DEFAULT_FRAME_DEADLINE_MS);
		expect(scheduler.isPending()).toBe(true);
	});

	test("honors an overridden frame deadline", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler({
			...harness.timing,
			frameDeadlineMs: 42,
		});

		scheduler.schedule(() => {});

		expect(harness.timerRequests[0]?.delayMs).toBe(42);
	});

	test("flushes on the frame and releases the deadline timer", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		harness.fireFrame();

		expect(flushes).toBe(1);
		expect(scheduler.isPending()).toBe(false);
		expect(harness.clearedTimers).toEqual([harness.timerRequests[0]?.handle]);
		// The frame that just fired is not handed back to `cancelFrame`.
		expect(harness.cancelledFrames).toEqual([]);
	});

	/**
	 * AC 1: this is PIE-885. Pre-fix, no timer existed and this cycle never
	 * resolved.
	 */
	test("flushes on the deadline timer when the frame never arrives", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		harness.fireTimer();

		expect(flushes).toBe(1);
		expect(scheduler.isPending()).toBe(false);
		// The frame that will never arrive is released, not left dangling.
		expect(harness.cancelledFrames).toHaveLength(1);
		expect(harness.clearedTimers).toEqual([]);
	});

	test("a frame arriving after the deadline timer won cannot flush twice", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		// A compositor that wakes up late still holds the callback the scheduler
		// handed it, and a real `cancelAnimationFrame` cannot unhand it once the
		// frame is already being serviced. The latch check has to absorb that.
		const lateFrameCallback = harness.pendingFrameCallback;
		harness.fireTimer();
		lateFrameCallback?.();

		expect(flushes).toBe(1);
	});

	/** AC 3. */
	test("coalesces repeated schedules into a single flush, using the latest callback", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		const flushed: string[] = [];

		scheduler.schedule(() => flushed.push("first"));
		scheduler.schedule(() => flushed.push("second"));
		scheduler.schedule(() => flushed.push("third"));

		expect(harness.frameRequests).toBe(1);
		expect(harness.timerRequests).toHaveLength(1);

		harness.fireFrame();

		expect(flushed).toEqual(["third"]);
	});

	test("a schedule from inside the flush arms a fresh cycle", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		const flushed: string[] = [];

		scheduler.schedule(() => {
			flushed.push("outer");
			scheduler.schedule(() => flushed.push("inner"));
		});
		harness.fireFrame();

		expect(flushed).toEqual(["outer"]);
		expect(scheduler.isPending()).toBe(true);
		expect(harness.frameRequests).toBe(2);

		harness.fireFrame();

		expect(flushed).toEqual(["outer", "inner"]);
	});

	/** AC 2. */
	test("cancel releases the latch and both handles without flushing", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		scheduler.cancel();

		expect(flushes).toBe(0);
		expect(scheduler.isPending()).toBe(false);
		expect(harness.cancelledFrames).toHaveLength(1);
		expect(harness.clearedTimers).toEqual([harness.timerRequests[0]?.handle]);
	});

	/** AC 2: a cancelled cycle must not block the next one. */
	test("schedules again after a cancel", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		scheduler.cancel();
		scheduler.schedule(() => {
			flushes += 1;
		});
		harness.fireFrame();

		expect(flushes).toBe(1);
		expect(harness.frameRequests).toBe(2);
	});

	test("cancel is idempotent and a no-op with nothing pending", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);

		scheduler.cancel();
		scheduler.schedule(() => {});
		scheduler.cancel();
		scheduler.cancel();

		expect(scheduler.isPending()).toBe(false);
		expect(harness.cancelledFrames).toHaveLength(1);
		expect(harness.clearedTimers).toHaveLength(1);
	});

	test("a cancelled cycle's late frame cannot flush", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		const strandedFrameCallback = harness.pendingFrameCallback;
		scheduler.cancel();
		strandedFrameCallback?.();

		expect(flushes).toBe(0);
	});

	test("keeps racing both primitives after the timer wins a cycle", () => {
		const harness = createHarness();
		const scheduler = createCompositionEmitScheduler(harness.timing);

		scheduler.schedule(() => {});
		harness.fireTimer();
		scheduler.schedule(() => {});

		// No timer-preferring mode: the frame is still armed, so a document that
		// starts painting again gets paint-aligned emits back.
		expect(harness.frameRequests).toBe(2);
		expect(harness.timerRequests).toHaveLength(2);
	});

	test("falls back to a microtask when no frame primitive exists", async () => {
		const harness = createHarness({ requestFrame: null, cancelFrame: null });
		const microtasks: Array<() => void> = [];
		const scheduler = createCompositionEmitScheduler({
			...harness.timing,
			queueMicrotaskFn: (callback) => {
				microtasks.push(callback);
			},
		});
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});

		// No frame, and no deadline timer either: the microtask is already the
		// soonest available slot, so racing one against it buys nothing.
		expect(harness.frameRequests).toBe(0);
		expect(harness.timerRequests).toHaveLength(0);
		expect(microtasks).toHaveLength(1);

		microtasks[0]?.();

		expect(flushes).toBe(1);
	});

	test("falls back to a zero-delay timer when neither a frame nor a microtask exists", () => {
		const harness = createHarness({ requestFrame: null, cancelFrame: null });
		const scheduler = createCompositionEmitScheduler({
			...harness.timing,
			queueMicrotaskFn: null,
		});
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});

		expect(harness.timerRequests[0]?.delayMs).toBe(0);

		harness.fireTimer();

		expect(flushes).toBe(1);
	});

	test("flushes synchronously when no deferral primitive exists at all", () => {
		const scheduler = createCompositionEmitScheduler({
			requestFrame: null,
			cancelFrame: null,
			setTimer: null,
			clearTimer: null,
			queueMicrotaskFn: null,
		});
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});

		expect(flushes).toBe(1);
		expect(scheduler.isPending()).toBe(false);
	});

	test("survives a frame primitive that calls back synchronously", () => {
		const harness = createHarness({
			requestFrame: (callback) => {
				callback();
				return 1;
			},
		});
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});

		expect(flushes).toBe(1);
		expect(scheduler.isPending()).toBe(false);
		// Already flushed, so no deadline timer is left armed behind it.
		expect(harness.timerRequests).toHaveLength(0);
	});

	test("resolves on the frame when no timer primitive exists", () => {
		const harness = createHarness({ setTimer: null, clearTimer: null });
		const scheduler = createCompositionEmitScheduler(harness.timing);
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		harness.fireFrame();

		expect(flushes).toBe(1);
	});

	test("resolves against the real ambient primitives with no injection", async () => {
		const scheduler = createCompositionEmitScheduler();
		let flushes = 0;

		scheduler.schedule(() => {
			flushes += 1;
		});
		// Bun has no `requestAnimationFrame`, so this exercises the ambient
		// microtask path end to end.
		await Promise.resolve();

		expect(flushes).toBe(1);
	});
});

/**
 * Source guardrail, in the style of
 * `packages/section-player/tests/m5-mirror-rule.test.ts`.
 *
 * The scheduler only helps while the toolkit actually routes through it. A
 * future refactor that inlines a bare `requestAnimationFrame` back into the
 * composition path would restore PIE-885 with every unit test above still
 * green, so the toolkit component is held to referencing no frame primitive
 * directly.
 */
describe("PieAssessmentToolkit composition emit wiring", () => {
	const TOOLKIT_SOURCE = readFileSync(
		resolve(__dirname, "../../src/components/PieAssessmentToolkit.svelte"),
		"utf8",
	);

	test("routes composition emits through the scheduler", () => {
		expect(TOOLKIT_SOURCE).toContain("createCompositionEmitScheduler");
		expect(TOOLKIT_SOURCE).toContain("compositionEmitScheduler.schedule(");
		expect(TOOLKIT_SOURCE).toContain("compositionEmitScheduler.cancel()");
	});

	test("references no frame primitive directly", () => {
		expect(TOOLKIT_SOURCE).not.toContain("requestAnimationFrame");
		expect(TOOLKIT_SOURCE).not.toContain("cancelAnimationFrame");
	});
});
