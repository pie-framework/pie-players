/**
 * Stage-emit suppression gate tests (M7 PR 6).
 *
 * Pins the wrapped/standalone behavior change introduced by PR 6 in
 * `PieAssessmentToolkit.svelte`. The toolkit routes every
 * `stageTracker.emit(detail)` through
 * `runStageEmitWithSuppression`; this file exercises that helper
 * directly so a future refactor cannot silently drop the suppression
 * branch and regress to a duplicate-emit on the layout CE host.
 *
 * Coverage matrix:
 *
 *   - **Standalone** (`isSuppressed() === false`): DOM event +
 *     `onStageChange` callback both fire, in DOM-event-then-callback
 *     order, with the same `detail` object.
 *   - **Wrapped** (`isSuppressed() === true`): neither side effect
 *     fires.
 *   - **Late suppression flip** (suppressed becomes unsuppressed mid
 *     run): the next emit fires both side effects.
 *   - **Late suppression flip the other way** (unsuppressed becomes
 *     suppressed): the next emit fires nothing.
 *   - **Throwing handler** does not interrupt the DOM event (the DOM
 *     event has already fired) and does not propagate; the error is
 *     forwarded to the optional `logHandlerError` for tests.
 *   - **Missing handler** (returned thunk yields `null` /
 *     `undefined`): DOM event still fires.
 *   - **Latest handler wins**: the thunk is called per emit, so a
 *     reassigned `onStageChange` is invoked next time.
 *
 * The toolkit-side wiring in `PieAssessmentToolkit.svelte` reads
 * `upstreamEngine` and `onStageChange` through the thunks below at
 * emit time (not at construction time), preserving pre-PR-6 cohort /
 * host-swap semantics. These tests exercise that thunk discipline.
 */

import { describe, expect, test } from "bun:test";

import {
	runStageEmitWithSuppression,
	type StageEmitGateContext,
	type StageOnChangeHandler,
} from "../../src/runtime/stage-emit-gate.js";
import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";

function makeDetail(
	stage: StageChangeDetail["stage"] = "composed",
): StageChangeDetail {
	return {
		stage,
		status: "entered",
		runtimeId: "toolkit-runtime-1",
		sourceCe: "pie-assessment-toolkit",
		sectionId: "section-A",
		attemptId: "attempt-1",
		timestamp: "2026-04-25T00:00:00.000Z",
	};
}

interface Recorder {
	domEvents: StageChangeDetail[];
	handlerCalls: StageChangeDetail[];
	logged: unknown[];
}

function makeRecorder(): Recorder {
	return { domEvents: [], handlerCalls: [], logged: [] };
}

interface MakeGateOptions {
	suppressed: boolean | (() => boolean);
	handler: StageOnChangeHandler | null | undefined;
}

function makeGate(
	recorder: Recorder,
	options: MakeGateOptions,
): StageEmitGateContext {
	const isSuppressed =
		typeof options.suppressed === "function"
			? options.suppressed
			: () => options.suppressed as boolean;
	return {
		isSuppressed,
		dispatchDomEvent: (d) => {
			recorder.domEvents.push(d);
		},
		getOnStageChange: () => options.handler,
		logHandlerError: (error) => {
			recorder.logged.push(error);
		},
	};
}

describe("runStageEmitWithSuppression", () => {
	test("standalone (not suppressed) fires DOM event and handler with the same detail in order", () => {
		const recorder = makeRecorder();
		const order: string[] = [];
		const handler: StageOnChangeHandler = (detail) => {
			order.push("handler");
			recorder.handlerCalls.push(detail);
		};
		const detail = makeDetail("composed");
		// Build the gate inline so we can record ordering before the
		// recorder's `dispatchDomEvent` runs.
		const gate: StageEmitGateContext = {
			isSuppressed: () => false,
			dispatchDomEvent: (d) => {
				order.push("dom");
				recorder.domEvents.push(d);
			},
			getOnStageChange: () => handler,
			logHandlerError: (error) => {
				recorder.logged.push(error);
			},
		};

		const ran = runStageEmitWithSuppression(gate, detail);

		expect(ran).toBe(true);
		expect(recorder.domEvents).toEqual([detail]);
		expect(recorder.handlerCalls).toEqual([detail]);
		expect(order).toEqual(["dom", "handler"]);
		expect(recorder.logged).toEqual([]);
	});

	test("wrapped (suppressed) does not fire DOM event and does not invoke handler", () => {
		const recorder = makeRecorder();
		let handlerCalls = 0;
		const gate = makeGate(recorder, {
			suppressed: true,
			handler: () => {
				handlerCalls += 1;
			},
		});

		const ran = runStageEmitWithSuppression(gate, makeDetail());

		expect(ran).toBe(false);
		expect(recorder.domEvents).toEqual([]);
		expect(handlerCalls).toBe(0);
	});

	test("late suppression flip: wrapped → standalone delivers the next emit", () => {
		const recorder = makeRecorder();
		let suppressed = true;
		const handler: StageOnChangeHandler = (d) => {
			recorder.handlerCalls.push(d);
		};
		const gate = makeGate(recorder, {
			suppressed: () => suppressed,
			handler,
		});

		const detailA = makeDetail("composed");
		const detailB = makeDetail("interactive");
		expect(runStageEmitWithSuppression(gate, detailA)).toBe(false);
		suppressed = false;
		expect(runStageEmitWithSuppression(gate, detailB)).toBe(true);

		expect(recorder.domEvents).toEqual([detailB]);
		expect(recorder.handlerCalls).toEqual([detailB]);
	});

	test("late suppression flip: standalone → wrapped suppresses the next emit", () => {
		const recorder = makeRecorder();
		let suppressed = false;
		const handler: StageOnChangeHandler = (d) => {
			recorder.handlerCalls.push(d);
		};
		const gate = makeGate(recorder, {
			suppressed: () => suppressed,
			handler,
		});

		const detailA = makeDetail("composed");
		const detailB = makeDetail("interactive");
		expect(runStageEmitWithSuppression(gate, detailA)).toBe(true);
		suppressed = true;
		expect(runStageEmitWithSuppression(gate, detailB)).toBe(false);

		expect(recorder.domEvents).toEqual([detailA]);
		expect(recorder.handlerCalls).toEqual([detailA]);
	});

	test("throwing handler does not prevent the DOM event and does not propagate", () => {
		const recorder = makeRecorder();
		const error = new Error("boom");
		const handler: StageOnChangeHandler = () => {
			throw error;
		};
		const gate = makeGate(recorder, { suppressed: false, handler });

		// Must not throw out of the helper.
		const ran = runStageEmitWithSuppression(gate, makeDetail());

		expect(ran).toBe(true);
		expect(recorder.domEvents.length).toBe(1);
		expect(recorder.logged).toEqual([error]);
	});

	test("missing handler thunk yields null/undefined: DOM event still fires", () => {
		const recorder = makeRecorder();
		const gate: StageEmitGateContext = {
			isSuppressed: () => false,
			dispatchDomEvent: (d) => {
				recorder.domEvents.push(d);
			},
			getOnStageChange: () => null,
		};

		const ran = runStageEmitWithSuppression(gate, makeDetail());
		expect(ran).toBe(true);
		expect(recorder.domEvents.length).toBe(1);

		(gate as { getOnStageChange: () => StageOnChangeHandler | null | undefined })
			.getOnStageChange = () => undefined;
		const ran2 = runStageEmitWithSuppression(gate, makeDetail("interactive"));
		expect(ran2).toBe(true);
		expect(recorder.domEvents.length).toBe(2);
	});

	test("the latest handler is read at emit time (thunk discipline)", () => {
		const recorder = makeRecorder();
		const calls: Array<{ which: string; detail: StageChangeDetail }> = [];
		let handler: StageOnChangeHandler = (d) => {
			calls.push({ which: "first", detail: d });
		};
		const gate: StageEmitGateContext = {
			isSuppressed: () => false,
			dispatchDomEvent: (d) => {
				recorder.domEvents.push(d);
			},
			getOnStageChange: () => handler,
		};

		const detailA = makeDetail("composed");
		runStageEmitWithSuppression(gate, detailA);
		handler = (d) => {
			calls.push({ which: "second", detail: d });
		};
		const detailB = makeDetail("interactive");
		runStageEmitWithSuppression(gate, detailB);

		expect(calls).toEqual([
			{ which: "first", detail: detailA },
			{ which: "second", detail: detailB },
		]);
	});

	test("the latest suppression value is read at emit time (thunk discipline)", () => {
		const recorder = makeRecorder();
		let suppressed = false;
		const gate: StageEmitGateContext = {
			isSuppressed: () => suppressed,
			dispatchDomEvent: (d) => {
				recorder.domEvents.push(d);
			},
			getOnStageChange: () => null,
		};

		runStageEmitWithSuppression(gate, makeDetail("composed"));
		suppressed = true;
		runStageEmitWithSuppression(gate, makeDetail("engine-ready"));
		suppressed = false;
		runStageEmitWithSuppression(gate, makeDetail("interactive"));

		expect(recorder.domEvents.map((d) => d.stage)).toEqual([
			"composed",
			"interactive",
		]);
	});
});
