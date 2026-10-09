/**
 * Engine transition tests.
 *
 * Exhaustive coverage of `transition(state, input)` over the FSM
 * (`idle` → `booting-section` → `engine-ready` → `interactive` →
 * `disposed`, with `failed` ending a chain before `interactive`) and every
 * input variant. The transition is pure and total, so every assertion runs
 * without a host, DOM, or coordinator.
 *
 * Output ordering invariants asserted here:
 *   1. `stage-change` for stage advancement fires before any
 *      `loading-complete` triggered by the same input.
 *   2. `loading-complete` fires once per cohort, gated on
 *      `state.loadingCompleteEmitted`.
 */

import { describe, expect, test } from "bun:test";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import type { SectionEngineInput } from "../../../src/runtime/core/engine-input.js";
import type { SectionEngineOutput } from "../../../src/runtime/core/engine-output.js";
import {
	createInitialEngineState,
	type SectionEngineState,
} from "../../../src/runtime/core/engine-state.js";
import { transition } from "../../../src/runtime/core/engine-transition.js";

const COHORT_A: CohortKey = { sectionId: "section-A", attemptId: "attempt-1" };
const COHORT_B: CohortKey = { sectionId: "section-B", attemptId: "attempt-1" };
const COHORT_A_NEW_ATTEMPT: CohortKey = {
	sectionId: "section-A",
	attemptId: "attempt-2",
};

const STUB_RUNTIME = { onStageChange: undefined, onLoadingComplete: undefined };
const STUB_TOOLS = { placement: {} };

function fold(
	initial: SectionEngineState,
	inputs: readonly SectionEngineInput[],
): { state: SectionEngineState; outputs: SectionEngineOutput[] } {
	let state = initial;
	const outputs: SectionEngineOutput[] = [];
	for (const input of inputs) {
		const next = transition(state, input);
		state = next.state;
		outputs.push(...next.outputs);
	}
	return { state, outputs };
}

function initialize(cohort: CohortKey, itemCount = 1): SectionEngineInput {
	return {
		kind: "initialize",
		cohort,
		effectiveRuntime: STUB_RUNTIME as never,
		effectiveToolsConfig: STUB_TOOLS,
		itemCount,
	};
}

describe("transition: idle → booting-section (initialize)", () => {
	test("emits `composed` and stores cohort + runtime + tools", () => {
		const { state, outputs } = fold(createInitialEngineState(), [
			initialize(COHORT_A, 3),
		]);
		expect(state.phase).toBe("booting-section");
		expect(state.cohort).toEqual(COHORT_A);
		expect(state.itemCount).toBe(3);
		expect(state.effectiveRuntime).toBe(STUB_RUNTIME as never);
		expect(state.effectiveToolsConfig).toBe(STUB_TOOLS);
		expect(outputs).toEqual([
			{
				kind: "stage-change",
				stage: "composed",
				status: "entered",
				cohort: COHORT_A,
			},
		]);
	});

	test("re-initialize on the same cohort folds into update-runtime (no stage emit)", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(
			start.state,
			initialize(COHORT_A, 5) /* same cohort, new itemCount */,
		);
		expect(next.outputs).toEqual([]);
		// `update-runtime` does NOT carry itemCount — the transition keeps the
		// previous one. itemCount only changes on cohort-change/initialize-new.
		expect(next.state.itemCount).toBe(start.state.itemCount);
	});

	test("re-initialize on a different cohort folds into cohort-change (disposed + composed)", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(start.state, initialize(COHORT_B, 4));
		expect(next.state.phase).toBe("booting-section");
		expect(next.state.cohort).toEqual(COHORT_B);
		expect(next.state.itemCount).toBe(4);
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "disposed",
				status: "entered",
				cohort: COHORT_A,
			},
			{
				kind: "stage-change",
				stage: "composed",
				status: "entered",
				cohort: COHORT_B,
			},
		]);
	});
});

describe("transition: section-controller-resolved", () => {
	test("advances booting-section → engine-ready and emits stage", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(start.state, {
			kind: "section-controller-resolved",
		});
		expect(next.state.phase).toBe("engine-ready");
		expect(next.state.controllerResolved).toBe(true);
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "engine-ready",
				status: "entered",
				cohort: COHORT_A,
			},
		]);
	});

	test("idempotent past engine-ready (latches the flag, no stage emit)", () => {
		const ready = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(ready.state, {
			kind: "section-controller-resolved",
		});
		expect(next.state.phase).toBe("engine-ready");
		expect(next.state.controllerResolved).toBe(true);
		expect(next.outputs).toEqual([]);
	});

	test("readiness reported while booting advances to interactive once the controller resolves", () => {
		const booting = fold(createInitialEngineState(), [
			initialize(COHORT_A, 1),
			{
				kind: "update-readiness-signals",
				mode: "progressive",
				signals: {
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: true,
					runtimeError: false,
				},
				itemCount: 1,
			},
		]);
		expect(booting.state.phase).toBe("booting-section");
		const next = transition(booting.state, {
			kind: "section-controller-resolved",
		});
		expect(next.state.phase).toBe("interactive");
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "engine-ready",
				status: "entered",
				cohort: COHORT_A,
			},
			{
				kind: "stage-change",
				stage: "interactive",
				status: "entered",
				cohort: COHORT_A,
			},
		]);
	});

	test("a strict snapshot short of loading-complete stays at engine-ready", () => {
		const booting = fold(createInitialEngineState(), [
			initialize(COHORT_A, 2),
			{
				kind: "update-readiness-signals",
				mode: "strict",
				signals: {
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: false,
					runtimeError: false,
				},
				itemCount: 2,
			},
		]);
		const next = transition(booting.state, {
			kind: "section-controller-resolved",
		});
		expect(next.state.phase).toBe("engine-ready");
		expect(next.outputs.map((output) => output.kind)).toEqual(["stage-change"]);
	});

	test("ignored before initialize (idle stays idle, no stage emit)", () => {
		const next = transition(createInitialEngineState(), {
			kind: "section-controller-resolved",
		});
		expect(next.state.phase).toBe("idle");
		expect(next.state.controllerResolved).toBe(true);
		expect(next.outputs).toEqual([]);
	});
});

describe("transition: update-readiness-signals (progressive)", () => {
	test("advances engine-ready → interactive and emits stage-change when gated", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 1),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: false,
				runtimeError: false,
			},
			itemCount: 1,
		});
		expect(next.state.phase).toBe("interactive");
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "interactive",
				status: "entered",
				cohort: COHORT_A,
			},
		]);
	});

	test("emits stage-change + loading-complete once per cohort when allLoadingComplete latches", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 2),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 2,
		});
		expect(next.state.phase).toBe("interactive");
		expect(next.state.loadingCompleteEmitted).toBe(true);
		// Output order: stage-change (interactive), then loading-complete.
		const kinds = next.outputs.map((output) => output.kind);
		expect(kinds).toEqual(["stage-change", "loading-complete"]);
		const loadingComplete = next.outputs.find(
			(output) => output.kind === "loading-complete",
		);
		expect(loadingComplete).toMatchObject({
			cohort: COHORT_A,
			itemCount: 2,
		});
	});

	test("does not double-emit loading-complete on subsequent updates with same signals", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 1),
			{ kind: "section-controller-resolved" },
			{
				kind: "update-readiness-signals",
				mode: "progressive",
				signals: {
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: true,
					runtimeError: false,
				},
				itemCount: 1,
			},
		]);
		const next = transition(start.state, {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 1,
		});
		expect(next.outputs).toEqual([]);
	});

	test("emits loading-complete from engine-ready when allLoadingComplete fires before interactionReady", () => {
		// Edge case: progressive mode + `interactionReady=false` + `allLoadingComplete=true`
		// emits `loading-complete` for the cohort but does not advance to interactive.
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 1),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: false,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 1,
		});
		expect(next.state.phase).toBe("engine-ready");
		const kinds = next.outputs.map((output) => output.kind);
		expect(kinds).toEqual(["loading-complete"]);
	});

	test("ignored in idle phase (no cohort)", () => {
		const next = transition(createInitialEngineState(), {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 0,
		});
		expect(next.outputs).toEqual([]);
	});
});

describe("transition: update-readiness-signals (strict mode)", () => {
	test("strict mode delays interactive until allLoadingComplete", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 2),
			{ kind: "section-controller-resolved" },
		]);
		const partial = transition(start.state, {
			kind: "update-readiness-signals",
			mode: "strict",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: false,
				runtimeError: false,
			},
			itemCount: 2,
		});
		// Strict mode collapses interactionReady to false until loading
		// completes, so the engine stays in `engine-ready` and the
		// transition emits no outputs (no stage advance, no loading
		// complete).
		expect(partial.state.phase).toBe("engine-ready");
		expect(partial.outputs).toEqual([]);

		const complete = transition(partial.state, {
			kind: "update-readiness-signals",
			mode: "strict",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 2,
		});
		expect(complete.state.phase).toBe("interactive");
	});
});

describe("transition: cohort-change", () => {
	test("emits disposed for outgoing, composed for incoming, and resets latches", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A, 1),
			{ kind: "section-controller-resolved" },
			{
				kind: "update-readiness-signals",
				mode: "progressive",
				signals: {
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: true,
					runtimeError: false,
				},
				itemCount: 1,
			},
		]);
		expect(start.state.loadingCompleteEmitted).toBe(true);

		const next = transition(start.state, {
			kind: "cohort-change",
			cohort: COHORT_B,
			effectiveRuntime: STUB_RUNTIME as never,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 5,
		});

		expect(next.state.phase).toBe("booting-section");
		expect(next.state.cohort).toEqual(COHORT_B);
		expect(next.state.loadingCompleteEmitted).toBe(false);
		expect(next.state.controllerResolved).toBe(false);
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "disposed",
				status: "entered",
				cohort: COHORT_A,
			},
			{
				kind: "stage-change",
				stage: "composed",
				status: "entered",
				cohort: COHORT_B,
			},
		]);
	});

	test("cohort-change to identical cohort folds into update-runtime (no stage emits)", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(start.state, {
			kind: "cohort-change",
			cohort: COHORT_A,
			effectiveRuntime: STUB_RUNTIME as never,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 99,
		});
		expect(next.outputs).toEqual([]);
		expect(next.state.cohort).toEqual(COHORT_A);
	});

	test("attempt-id-only change still rolls the cohort", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(start.state, {
			kind: "cohort-change",
			cohort: COHORT_A_NEW_ATTEMPT,
			effectiveRuntime: STUB_RUNTIME as never,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		const kinds = next.outputs.map((output) => output.kind);
		expect(kinds).toEqual(["stage-change", "stage-change"]);
		expect(next.state.cohort).toEqual(COHORT_A_NEW_ATTEMPT);
	});
});

function readiness(
	signals: Partial<{
		sectionReady: boolean;
		interactionReady: boolean;
		allLoadingComplete: boolean;
		runtimeError: boolean;
	}>,
): SectionEngineInput {
	return {
		kind: "update-readiness-signals",
		signals: {
			sectionReady: false,
			interactionReady: false,
			allLoadingComplete: false,
			runtimeError: false,
			...signals,
		},
		itemCount: 1,
		mode: "progressive",
	};
}

function stages(outputs: readonly SectionEngineOutput[]): string[] {
	return outputs.flatMap((output) =>
		output.kind === "stage-change" ? [`${output.stage}:${output.status}`] : [],
	);
}

describe("transition: runtime error before interactive", () => {
	test("while booting, `engine-ready` fails and `interactive` is skipped", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const next = transition(start.state, readiness({ runtimeError: true }));
		expect(next.state.phase).toBe("failed");
		expect(stages(next.outputs)).toEqual([
			"engine-ready:failed",
			"interactive:skipped",
		]);
	});

	test("after `engine-ready`, `interactive` fails", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, readiness({ runtimeError: true }));
		expect(next.state.phase).toBe("failed");
		expect(stages(next.outputs)).toEqual(["interactive:failed"]);
	});

	test("a failed chain stays ended: a late controller and repeated signals emit no stage", () => {
		const { outputs } = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			readiness({ runtimeError: true }),
			{ kind: "section-controller-resolved" },
			readiness({ runtimeError: true, sectionReady: true, interactionReady: true }),
		]);
		expect(stages(outputs)).toEqual([
			"composed:entered",
			"engine-ready:failed",
			"interactive:skipped",
		]);
	});

	test("after `interactive`, an error emits no stage", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "section-controller-resolved" },
			readiness({ sectionReady: true, interactionReady: true }),
		]);
		expect(start.state.phase).toBe("interactive");
		const next = transition(start.state, readiness({ runtimeError: true }));
		expect(next.state.phase).toBe("interactive");
		expect(stages(next.outputs)).toEqual([]);
	});

	test("a failed cohort is disposed on dispose and on cohort change", () => {
		const failed = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			readiness({ runtimeError: true }),
		]);
		expect(stages(transition(failed.state, { kind: "dispose" }).outputs)).toEqual([
			"disposed:entered",
		]);
		const switched = transition(failed.state, initialize(COHORT_B));
		expect(switched.state.phase).toBe("booting-section");
		expect(stages(switched.outputs)).toEqual([
			"disposed:entered",
			"composed:entered",
		]);
	});

	test("a failed cohort still reports loading-complete once", () => {
		const { outputs } = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			readiness({ runtimeError: true }),
			readiness({ runtimeError: true, sectionReady: true, allLoadingComplete: true }),
			readiness({ runtimeError: true, sectionReady: true, allLoadingComplete: true }),
		]);
		expect(outputs.filter((o) => o.kind === "loading-complete")).toHaveLength(1);
	});
});

describe("transition: dispose", () => {
	test("emits disposed and moves to disposed phase from any non-idle phase", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, { kind: "dispose" });
		expect(next.state.phase).toBe("disposed");
		expect(next.outputs).toEqual([
			{
				kind: "stage-change",
				stage: "disposed",
				status: "entered",
				cohort: COHORT_A,
			},
		]);
	});

	test("dispose from idle is a no-op (no cohort, no stage emit)", () => {
		const next = transition(createInitialEngineState(), { kind: "dispose" });
		expect(next.state.phase).toBe("disposed");
		expect(next.outputs).toEqual([]);
	});

	test("dispose is idempotent", () => {
		const disposed = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "dispose" },
		]);
		const next = transition(disposed.state, { kind: "dispose" });
		expect(next.outputs).toEqual([]);
		expect(next.state.phase).toBe("disposed");
	});

	test("inputs after dispose are ignored", () => {
		const disposed = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "dispose" },
		]);
		const afterControllerResolved = transition(disposed.state, {
			kind: "section-controller-resolved",
		});
		expect(afterControllerResolved.outputs).toEqual([]);
		expect(afterControllerResolved.state.phase).toBe("disposed");

		const afterReadiness = transition(disposed.state, {
			kind: "update-readiness-signals",
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			itemCount: 1,
		});
		expect(afterReadiness.outputs).toEqual([]);

		const afterInitialize = transition(disposed.state, initialize(COHORT_B));
		expect(afterInitialize.outputs).toEqual([]);
	});
});

describe("transition: update-runtime", () => {
	test("stores latest resolver output without changing phase or emitting", () => {
		const start = fold(createInitialEngineState(), [initialize(COHORT_A)]);
		const newRuntime = { onStageChange: () => {}, onLoadingComplete: () => {} };
		const next = transition(start.state, {
			kind: "update-runtime",
			effectiveRuntime: newRuntime as never,
			effectiveToolsConfig: { placement: { section: ["calc"] } },
		});
		expect(next.outputs).toEqual([]);
		expect(next.state.effectiveRuntime).toBe(newRuntime as never);
		expect(next.state.phase).toBe("booting-section");
	});

	test("update-runtime in idle is a no-op", () => {
		const next = transition(createInitialEngineState(), {
			kind: "update-runtime",
			effectiveRuntime: STUB_RUNTIME as never,
			effectiveToolsConfig: STUB_TOOLS,
		});
		expect(next.outputs).toEqual([]);
		expect(next.state.phase).toBe("idle");
	});
});

describe("transition: SectionEngineCore (subscribe + dispatch)", () => {
	test("listeners receive outputs in dispatch order", async () => {
		const { SectionEngineCore } = await import(
			"../../../src/runtime/core/SectionEngineCore.js"
		);
		const core = new SectionEngineCore();
		const seen: SectionEngineOutput[] = [];
		core.subscribe((outputs) => {
			seen.push(...outputs);
		});
		core.dispatch(initialize(COHORT_A));
		core.dispatch({ kind: "section-controller-resolved" });
		expect(seen.map((output) => output.kind)).toEqual([
			"stage-change",
			"stage-change",
		]);
	});

	test("disposer detaches the listener idempotently", async () => {
		const { SectionEngineCore } = await import(
			"../../../src/runtime/core/SectionEngineCore.js"
		);
		const core = new SectionEngineCore();
		let calls = 0;
		const dispose = core.subscribe(() => {
			calls += 1;
		});
		core.dispatch(initialize(COHORT_A));
		expect(calls).toBe(1);
		dispose();
		dispose();
		core.dispatch({ kind: "section-controller-resolved" });
		expect(calls).toBe(1);
	});

	test("a throwing listener does not block fan-out", async () => {
		const { SectionEngineCore } = await import(
			"../../../src/runtime/core/SectionEngineCore.js"
		);
		const core = new SectionEngineCore();
		const consoleWarn = console.warn;
		console.warn = () => {};
		try {
			let later = 0;
			core.subscribe(() => {
				throw new Error("boom");
			});
			core.subscribe(() => {
				later += 1;
			});
			core.dispatch(initialize(COHORT_A));
			expect(later).toBe(1);
		} finally {
			console.warn = consoleWarn;
		}
	});
});
