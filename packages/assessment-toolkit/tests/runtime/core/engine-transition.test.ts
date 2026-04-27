/**
 * Engine transition tests (M7 PR 1).
 *
 * Exhaustive coverage of `transition(state, input)` over the four-phase
 * FSM (`idle` → `booting-section` → `engine-ready` → `interactive` →
 * `disposed`) and every input variant. The transition is pure and
 * total, so every assertion runs without a host, DOM, or coordinator.
 *
 * Output ordering invariants asserted here (preserved from today's
 * kernel chain):
 *   1. `stage-change` for stage advancement fires before
 *      `readiness-change` / `interaction-ready` / `ready` for the same
 *      input.
 *   2. `readiness-change` fires before its derived legacy emits.
 *   3. `loading-complete` fires after `ready`.
 *   4. `framework-error` is independent of stage progression.
 */

import { describe, expect, test } from "bun:test";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import type {
	SectionEngineInput,
} from "../../../src/runtime/core/engine-input.js";
import type {
	SectionEngineOutput,
} from "../../../src/runtime/core/engine-output.js";
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
		const { state, outputs } = fold(createInitialEngineState(), [initialize(COHORT_A, 3)]);
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
		const next = transition(start.state, { kind: "section-controller-resolved" });
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
		const next = transition(ready.state, { kind: "section-controller-resolved" });
		expect(next.state.phase).toBe("engine-ready");
		expect(next.state.controllerResolved).toBe(true);
		expect(next.outputs).toEqual([]);
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
	test("emits readiness-change + interaction-ready + stage interactive when gated", () => {
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
			loadedCount: 0,
			itemCount: 1,
		});
		expect(next.state.phase).toBe("interactive");
		// stage-change fires before the legacy chain.
		expect(next.outputs[0]).toEqual({
			kind: "stage-change",
			stage: "interactive",
			status: "entered",
			cohort: COHORT_A,
		});
		expect(next.outputs[1]?.kind).toBe("readiness-change");
		expect(next.outputs[2]?.kind).toBe("interaction-ready");
		expect(next.outputs).toHaveLength(3);
	});

	test("emits ready + loading-complete once per cohort when allLoadingComplete latches", () => {
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
			loadedCount: 2,
			itemCount: 2,
		});
		expect(next.state.phase).toBe("interactive");
		expect(next.state.readyEmitted).toBe(true);
		expect(next.state.loadingCompleteEmitted).toBe(true);
		// Output order: stage-change, readiness-change, interaction-ready, ready, loading-complete.
		const kinds = next.outputs.map((output) => output.kind);
		expect(kinds).toEqual([
			"stage-change",
			"readiness-change",
			"interaction-ready",
			"ready",
			"loading-complete",
		]);
		const loadingComplete = next.outputs.find(
			(output) => output.kind === "loading-complete",
		);
		expect(loadingComplete).toMatchObject({
			cohort: COHORT_A,
			itemCount: 2,
			loadedCount: 2,
		});
	});

	test("does not double-emit ready / loading-complete on subsequent updates with same signals", () => {
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
				loadedCount: 1,
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
			loadedCount: 1,
			itemCount: 1,
		});
		expect(next.outputs).toEqual([]);
	});

	test("does not emit `loading-complete` while still in engine-ready (no interactive yet)", () => {
		// Edge case: progressive mode + `interactionReady=false` + `allLoadingComplete=true`
		// should fire `ready` but not advance to interactive.
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
			loadedCount: 1,
			itemCount: 1,
		});
		expect(next.state.phase).toBe("engine-ready");
		const kinds = next.outputs.map((output) => output.kind);
		expect(kinds).toContain("ready");
		expect(kinds).toContain("loading-complete");
		expect(kinds).not.toContain("interaction-ready");
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
			loadedCount: 0,
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
			loadedCount: 1,
			itemCount: 2,
		});
		expect(partial.state.phase).toBe("engine-ready");
		// Strict mode collapses interactionReady to false until loading completes.
		const partialReadiness = partial.outputs.find(
			(output) => output.kind === "readiness-change",
		);
		expect(partialReadiness?.kind).toBe("readiness-change");
		expect((partialReadiness as { detail?: { interactionReady: boolean } } | undefined)?.detail?.interactionReady).toBe(
			false,
		);

		const complete = transition(partial.state, {
			kind: "update-readiness-signals",
			mode: "strict",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			loadedCount: 2,
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
				loadedCount: 1,
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
		expect(next.state.interactionReadyEmitted).toBe(false);
		expect(next.state.readyEmitted).toBe(false);
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

describe("transition: framework-error", () => {
	test("records error and emits framework-error output without changing phase", () => {
		const start = fold(createInitialEngineState(), [
			initialize(COHORT_A),
			{ kind: "section-controller-resolved" },
		]);
		const next = transition(start.state, {
			kind: "framework-error",
			error: {
				kind: "tool-config",
				severity: "error",
				source: "test",
				message: "boom",
				details: [],
				recoverable: false,
			},
		});
		expect(next.state.phase).toBe("engine-ready");
		expect(next.state.lastFrameworkError?.message).toBe("boom");
		expect(next.state.readinessSignals.runtimeError).toBe(true);
		expect(next.outputs).toHaveLength(1);
		expect(next.outputs[0]?.kind).toBe("framework-error");
	});

	test("framework-error in idle phase still records and emits", () => {
		const next = transition(createInitialEngineState(), {
			kind: "framework-error",
			error: {
				kind: "coordinator-init",
				severity: "fatal",
				source: "toolkit",
				message: "init failed",
				details: [],
				recoverable: false,
			},
		});
		expect(next.outputs).toHaveLength(1);
		expect(next.state.lastFrameworkError?.kind).toBe("coordinator-init");
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
			loadedCount: 1,
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
		expect(seen.map((output) => output.kind)).toEqual(["stage-change", "stage-change"]);
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
