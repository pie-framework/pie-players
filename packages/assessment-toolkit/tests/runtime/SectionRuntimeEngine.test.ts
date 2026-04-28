/**
 * Section runtime engine — facade smoke test (M7 PR 3).
 *
 * Drives the layered facade through the canonical four-stage sequence
 * (`composed` → `engine-ready` → `interactive` → `disposed`) and asserts
 * that the same outputs are observable both via the public
 * `subscribe(...)` channel and as DOM `CustomEvent`s on a jsdom-style
 * host. Mirrors the kernel's existing emit chain so PR 5 (kernel
 * switch) is a structural delete, not a behavior change.
 *
 * Also asserts:
 *   - `getEffectiveRuntime(...)` returns the same value as a direct
 *     `resolveSectionEngineRuntimeState(...).effectiveRuntime` call —
 *     proves the facade is a pure pass-through over the resolver.
 *   - Strict and progressive readiness modes gate the
 *     `engine-ready` → `interactive` transition correctly.
 *   - Pre-`attachHost` calls (`subscribe`, `dispatchInput`) are safe
 *     no-ops, matching the documented lifecycle.
 *
 * The five-line happy path is intentionally minimal so the facade's
 * common-host wiring stays self-evident.
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

import { SectionRuntimeEngine } from "../../src/runtime/SectionRuntimeEngine.js";
import type { CohortKey } from "../../src/runtime/core/cohort.js";
import type { SectionEngineOutput } from "../../src/runtime/core/engine-output.js";
import {
	resolveSectionEngineRuntimeState,
	type EffectiveRuntime,
	type RuntimeInputs,
} from "../../src/runtime/core/engine-resolver.js";
import { FrameworkErrorBus } from "../../src/services/framework-error-bus.js";

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

const COHORT: CohortKey = { sectionId: "section-A", attemptId: "attempt-1" };
const STUB_RUNTIME = {
	onStageChange: undefined,
	onLoadingComplete: undefined,
} as unknown as EffectiveRuntime;
const STUB_TOOLS = { placement: {} };

function makeRuntimeInputs(
	overrides: Partial<RuntimeInputs> = {},
): RuntimeInputs {
	return {
		assessmentId: "assess-1",
		playerType: "iife",
		player: null,
		lazyInit: true,
		tools: null,
		accessibility: null,
		coordinator: null,
		env: null,
		toolConfigStrictness: "error",
		runtime: null,
		enabledTools: "",
		...overrides,
	};
}

interface CapturedDom {
	stageEvents: string[];
	loadingComplete: number;
	frameworkErrors: number;
}

function bindDomCapture(host: EventTarget): CapturedDom {
	const captured: CapturedDom = {
		stageEvents: [],
		loadingComplete: 0,
		frameworkErrors: 0,
	};
	host.addEventListener("pie-stage-change", (event) => {
		const detail = (event as CustomEvent).detail as { stage: string };
		captured.stageEvents.push(detail.stage);
	});
	host.addEventListener("pie-loading-complete", () => {
		captured.loadingComplete += 1;
	});
	host.addEventListener("framework-error", () => {
		captured.frameworkErrors += 1;
	});
	return captured;
}

describe("SectionRuntimeEngine facade — common-host smoke", () => {
	let engine: SectionRuntimeEngine;
	let host: HTMLElement;
	let bus: FrameworkErrorBus;
	let captured: CapturedDom;
	let outputs: SectionEngineOutput[];

	beforeEach(() => {
		engine = new SectionRuntimeEngine();
		host = document.createElement("div");
		bus = new FrameworkErrorBus();
		captured = bindDomCapture(host);
		outputs = [];

		// Five-line happy path: attach host + bus, subscribe to outputs,
		// drive the FSM through `initialize` → `controller-resolved` →
		// `update-readiness-signals` → `dispose`.
		engine.attachHost({
			host,
			sourceCe: "pie-section-player",
			frameworkErrorBus: bus,
		});
		engine.subscribe((batch) => {
			outputs.push(...batch);
		});
	});

	test("five-line happy path emits the canonical four-stage sequence via subscribe and DOM events (strict mode)", () => {
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

		const subscribeStages = outputs
			.filter((o) => o.kind === "stage-change")
			.map((o) => (o as Extract<SectionEngineOutput, { kind: "stage-change" }>).stage);
		expect(subscribeStages).toEqual([
			"composed",
			"engine-ready",
			"interactive",
			"disposed",
		]);

		expect(captured.stageEvents).toEqual([
			"composed",
			"engine-ready",
			"interactive",
			"disposed",
		]);
		expect(captured.loadingComplete).toBe(1);
		expect(captured.frameworkErrors).toBe(0);
	});

	test("strict mode: `interactive` does not advance until `allLoadingComplete`", () => {
		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({ kind: "section-controller-resolved" });

		// `interactionReady=true` alone is insufficient in strict mode.
		engine.dispatchInput({
			kind: "update-readiness-signals",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: false,
				runtimeError: false,
			},
			loadedCount: 0,
			itemCount: 1,
			mode: "strict",
		});
		expect(engine.getState().phase).toBe("engine-ready");

		// Loading completes ⇒ strict-mode `interactive` latches.
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
		expect(engine.getState().phase).toBe("interactive");
		expect(captured.stageEvents).toEqual([
			"composed",
			"engine-ready",
			"interactive",
		]);
	});

	test("progressive mode: `interactive` advances on `interactionReady` without waiting for `allLoadingComplete`", () => {
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
				allLoadingComplete: false,
				runtimeError: false,
			},
			loadedCount: 0,
			itemCount: 1,
			mode: "progressive",
		});

		expect(engine.getState().phase).toBe("interactive");
		expect(captured.stageEvents).toEqual([
			"composed",
			"engine-ready",
			"interactive",
		]);
		// `loading-complete` is gated on `allLoadingComplete`, which has
		// not flipped yet, so the canonical event has not fired.
		expect(captured.loadingComplete).toBe(0);
	});

	test("framework-error inputs fan out to the host bus, the DOM event, and subscribers", () => {
		const busHits: string[] = [];
		bus.subscribeFrameworkErrors((model) => {
			busHits.push(model.message);
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({
			kind: "framework-error",
			error: {
				kind: "tool-config",
				severity: "error",
				source: "engine-smoke",
				message: "boom",
				details: [],
				recoverable: false,
			},
		});

		expect(busHits).toEqual(["boom"]);
		expect(captured.frameworkErrors).toBe(1);
		const errorOutputs = outputs.filter((o) => o.kind === "framework-error");
		expect(errorOutputs).toHaveLength(1);
	});
});

describe("SectionRuntimeEngine facade — getEffectiveRuntime parity", () => {
	test("returns the same value as a direct resolveSectionEngineRuntimeState call", () => {
		const engine = new SectionRuntimeEngine();
		const inputs = makeRuntimeInputs({
			env: { mode: "review" },
			runtime: { onFrameworkError: () => {} },
		});
		const stub = (resolverArgs: {
			effectiveRuntime: Record<string, unknown>;
			playerType: string;
			env: Record<string, unknown> | null;
		}) => ({ tag: resolverArgs.playerType });

		const fromFacade = engine.getEffectiveRuntime(inputs, {
			resolvePlayerRuntime: stub,
		});
		const fromResolver = resolveSectionEngineRuntimeState(inputs, {
			resolvePlayerRuntime: stub,
		}).effectiveRuntime;

		expect(fromFacade).toEqual(fromResolver);
	});

	test("pre-attach callers are safe no-ops", () => {
		const engine = new SectionRuntimeEngine();
		const subscribed: SectionEngineOutput[][] = [];
		const dispose = engine.subscribe((batch) =>
			subscribed.push(Array.from(batch)),
		);
		expect(typeof dispose).toBe("function");
		dispose();

		// Dispatch before `attachHost` returns an empty output array
		// rather than throwing.
		const result = engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		expect(result).toEqual([]);

		// And the FSM state is still the initial idle snapshot.
		expect(engine.getState().phase).toBe("idle");
	});
});
