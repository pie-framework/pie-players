/**
 * Lockstep runtime-callback bridge — unit test (M7 PR 5).
 *
 * Locks the contract enforced at
 * `packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte`
 * via `attachRuntimeCallbackBridge` (extracted from the kernel's
 * lifecycle `$effect` for direct testability):
 *
 *   - For every `pie-stage-change` DOM event the engine dispatches on
 *     a layout CE host, the resolved `runtime.onStageChange` runs
 *     exactly once, *with the same `detail` reference*, *at the same
 *     emit point* (no buffering, no re-ordering).
 *   - The same lockstep guarantee holds for `pie-loading-complete`
 *     and `runtime.onLoadingComplete`.
 *   - Handler resolution is late-bound: a `runtime` reassign
 *     mid-cohort delivers the new handler on the next event without
 *     re-attaching listeners.
 *
 * Drives a real `SectionRuntimeEngine` so a regression in the engine's
 * DOM-event bridge or in the helper's listener wiring fails the same
 * test — the kernel's PR 6 toolkit-CE switch will rely on this
 * contract, so it must hold before that PR opens.
 *
 * The kernel uses this helper inside its second `$effect` block; a
 * future refactor that drops the helper invocation also drops the
 * kernel's lockstep behavior, which the
 * `kernel uses attachRuntimeCallbackBridge` source-level test pins.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SectionRuntimeEngine } from "@pie-players/pie-assessment-toolkit/runtime/engine";
import { FrameworkErrorBus } from "@pie-players/pie-assessment-toolkit/runtime/internal";

import { attachRuntimeCallbackBridge } from "../src/components/shared/section-player-runtime-callbacks.js";
import type {
	LoadingCompleteHandler,
	StageChangeHandler,
} from "@pie-players/pie-assessment-toolkit/runtime/internal";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const COHORT = { sectionId: "section-A", attemptId: "attempt-1" };
const STUB_RUNTIME = {
	onStageChange: undefined,
	onLoadingComplete: undefined,
} as never;
const STUB_TOOLS = { placement: {} } as never;

interface DomCapture {
	stageEvents: Array<{ detail: unknown }>;
	loadingEvents: Array<{ detail: unknown }>;
}

function bindDomCapture(host: EventTarget): DomCapture {
	const captured: DomCapture = { stageEvents: [], loadingEvents: [] };
	host.addEventListener("pie-stage-change", (event) => {
		captured.stageEvents.push({ detail: (event as CustomEvent).detail });
	});
	host.addEventListener("pie-loading-complete", (event) => {
		captured.loadingEvents.push({ detail: (event as CustomEvent).detail });
	});
	return captured;
}

interface CallbackCapture {
	stageCalls: Array<{ detail: unknown }>;
	loadingCalls: Array<{ detail: unknown }>;
}

function bindCallbackCapture(): {
	captured: CallbackCapture;
	stage: StageChangeHandler;
	loading: LoadingCompleteHandler;
} {
	const captured: CallbackCapture = { stageCalls: [], loadingCalls: [] };
	const stage: StageChangeHandler = (detail) => {
		captured.stageCalls.push({ detail });
	};
	const loading: LoadingCompleteHandler = (detail) => {
		captured.loadingCalls.push({ detail });
	};
	return { captured, stage, loading };
}

describe("attachRuntimeCallbackBridge — lockstep with engine DOM events", () => {
	let engine: SectionRuntimeEngine;
	let host: HTMLElement;
	let bus: FrameworkErrorBus;
	let dom: DomCapture;
	let teardown: (() => void) | null = null;

	beforeEach(() => {
		engine = new SectionRuntimeEngine();
		host = document.createElement("div");
		bus = new FrameworkErrorBus();
		dom = bindDomCapture(host);
		engine.attachHost({
			host,
			sourceCe: "pie-section-player",
			frameworkErrorBus: bus,
		});
		teardown = null;
	});

	test("invokes onStageChange and onLoadingComplete once per matching DOM event with the same detail (canonical four-stage sequence)", () => {
		const { captured: cb, stage, loading } = bindCallbackCapture();
		teardown = attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () => stage,
			getOnLoadingComplete: () => loading,
		});

		// Drive the engine through the canonical four-stage sequence
		// `composed → engine-ready → interactive → disposed`.
		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({ kind: "section-controller-resolved" });
		engine.dispatchInput({
			kind: "update-readiness-signals",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			loadedCount: 1,
			itemCount: 1,
			mode: "strict",
		});
		engine.dispatchInput({ kind: "dispose" });

		// Lockstep: callback invocations match DOM-event count and
		// preserve the detail reference *byte-for-byte*.
		expect(cb.stageCalls.length).toBe(dom.stageEvents.length);
		for (let i = 0; i < cb.stageCalls.length; i += 1) {
			expect(cb.stageCalls[i].detail).toBe(dom.stageEvents[i].detail);
		}
		expect(cb.loadingCalls.length).toBe(dom.loadingEvents.length);
		expect(cb.loadingCalls.length).toBe(1);
		expect(cb.loadingCalls[0].detail).toBe(dom.loadingEvents[0].detail);

		// Pin the canonical M6 sequence so a regression in the engine's
		// stage derivation also surfaces here.
		const stages = cb.stageCalls.map(
			(c) => (c.detail as { stage: string }).stage,
		);
		expect(stages).toEqual([
			"composed",
			"engine-ready",
			"interactive",
			"disposed",
		]);
	});

	test("does not fire callbacks when the resolved runtime tier omits them", () => {
		const { captured: cb } = bindCallbackCapture();
		teardown = attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () => undefined,
			getOnLoadingComplete: () => undefined,
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({ kind: "section-controller-resolved" });
		engine.dispatchInput({
			kind: "update-readiness-signals",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			loadedCount: 1,
			itemCount: 1,
			mode: "strict",
		});

		expect(cb.stageCalls).toEqual([]);
		expect(cb.loadingCalls).toEqual([]);
		// The DOM events still fire; only the callback invocation is
		// gated. This is the expected layered behavior.
		expect(dom.stageEvents.length).toBeGreaterThan(0);
		expect(dom.loadingEvents.length).toBe(1);
	});

	test("late-bound handler swap reaches the next event without re-attaching listeners", () => {
		const firstStage: StageChangeHandler = ((..._args: unknown[]) => {
			firstStageCalls += 1;
		}) as StageChangeHandler;
		const secondStage: StageChangeHandler = ((..._args: unknown[]) => {
			secondStageCalls += 1;
		}) as StageChangeHandler;
		let firstStageCalls = 0;
		let secondStageCalls = 0;
		let activeStage: StageChangeHandler | undefined = firstStage;

		teardown = attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () => activeStage,
			getOnLoadingComplete: () => undefined,
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		// At this point the engine has emitted `composed`. First
		// handler should have absorbed it.
		expect(firstStageCalls).toBeGreaterThan(0);
		const firstHandlerSnapshot = firstStageCalls;

		// Swap mid-cohort, then advance.
		activeStage = secondStage;
		engine.dispatchInput({ kind: "section-controller-resolved" });

		expect(firstStageCalls).toBe(firstHandlerSnapshot);
		expect(secondStageCalls).toBeGreaterThan(0);
	});

	test("captured exceptions are reported through onError without breaking the bridge", () => {
		const errorCaptured: Array<{ channel: string; error: unknown }> = [];
		const stage: StageChangeHandler = (() => {
			throw new Error("stage handler boom");
		}) as StageChangeHandler;
		const loading: LoadingCompleteHandler = (() => {
			throw new Error("loading handler boom");
		}) as LoadingCompleteHandler;

		teardown = attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () => stage,
			getOnLoadingComplete: () => loading,
			onError: (channel, error) => {
				errorCaptured.push({ channel, error });
			},
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({ kind: "section-controller-resolved" });
		engine.dispatchInput({
			kind: "update-readiness-signals",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
			loadedCount: 1,
			itemCount: 1,
			mode: "strict",
		});

		const stageErrors = errorCaptured.filter(
			(e) => e.channel === "onStageChange",
		);
		const loadingErrors = errorCaptured.filter(
			(e) => e.channel === "onLoadingComplete",
		);
		expect(stageErrors.length).toBeGreaterThan(0);
		expect(loadingErrors.length).toBe(1);

		// DOM events still fire even though the host callbacks threw.
		expect(dom.stageEvents.length).toBeGreaterThan(0);
		expect(dom.loadingEvents.length).toBe(1);
	});

	test("teardown removes both DOM listeners (no leak across mounts)", () => {
		const { captured: cb, stage, loading } = bindCallbackCapture();
		const dispose = attachRuntimeCallbackBridge({
			host,
			getOnStageChange: () => stage,
			getOnLoadingComplete: () => loading,
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		const beforeStageCount = cb.stageCalls.length;
		expect(beforeStageCount).toBeGreaterThan(0);

		dispose();

		// Synthetic DOM events post-teardown must not reach the
		// callbacks (engine inputs after `dispose()` of the bridge are
		// the realistic case but the engine still has a single host
		// reference, so we replay a synthetic event to verify removal).
		host.dispatchEvent(
			new CustomEvent("pie-stage-change", { detail: { stage: "ignored" } }),
		);
		host.dispatchEvent(
			new CustomEvent("pie-loading-complete", { detail: { itemCount: 0 } }),
		);

		expect(cb.stageCalls.length).toBe(beforeStageCount);
		expect(cb.loadingCalls.length).toBe(0);

		// Already torn down — no double-free in afterEach.
		teardown = null;
	});

	if (teardown) {
		teardown();
	}
});

describe("kernel uses attachRuntimeCallbackBridge", () => {
	const KERNEL_PATH = resolve(
		__dirname,
		"../src/components/shared/SectionPlayerLayoutKernel.svelte",
	);

	test("imports the helper from section-player-runtime-callbacks", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toContain(
			'import { attachRuntimeCallbackBridge } from "./section-player-runtime-callbacks.js"',
		);
	});

	test("invokes attachRuntimeCallbackBridge inside the lifecycle effect", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toMatch(/return\s+attachRuntimeCallbackBridge\s*\(/);
	});
});
