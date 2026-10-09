/**
 * Section runtime engine — facade smoke test.
 *
 * Drives the layered facade through the canonical four-stage sequence
 * (`composed` → `engine-ready` → `interactive` → `disposed`) and asserts
 * that the same outputs are observable both via the public
 * `subscribe(...)` channel and as DOM `CustomEvent`s on a jsdom-style
 * host, matching the kernel's emit chain.
 *
 * Also asserts:
 *   - Strict and progressive readiness modes gate the
 *     `engine-ready` → `interactive` transition correctly.
 *   - A runtime error before `interactive` ends the chain as `failed`, and
 *     the events bubble out of the host.
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
import type { EffectiveRuntime } from "../../src/runtime/core/engine-resolver.js";

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

interface CapturedDom {
	stageEvents: string[];
	loadingComplete: number;
}

function bindDomCapture(host: EventTarget): CapturedDom {
	const captured: CapturedDom = {
		stageEvents: [],
		loadingComplete: 0,
	};
	host.addEventListener("pie-stage-change", (event) => {
		const detail = (event as CustomEvent).detail as { stage: string };
		captured.stageEvents.push(detail.stage);
	});
	host.addEventListener("pie-loading-complete", () => {
		captured.loadingComplete += 1;
	});
	return captured;
}

describe("SectionRuntimeEngine facade — common-host smoke", () => {
	let engine: SectionRuntimeEngine;
	let host: HTMLElement;
	let captured: CapturedDom;
	let outputs: SectionEngineOutput[];

	beforeEach(() => {
		engine = new SectionRuntimeEngine();
		host = document.createElement("div");
		captured = bindDomCapture(host);
		outputs = [];

		// Five-line happy path: attach host, subscribe to outputs, drive the
		// FSM through `initialize` → `controller-resolved` →
		// `update-readiness-signals` → `dispose`.
		engine.attachHost({ host, sourceCe: "pie-section-player" });
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
			itemCount: 1,
			mode: "strict",
		});
		engine.dispatchInput({ kind: "dispose" });

		const subscribeStages = outputs
			.filter((o) => o.kind === "stage-change")
			.map(
				(o) =>
					(o as Extract<SectionEngineOutput, { kind: "stage-change" }>).stage,
			);
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

	test("a runtime error before `interactive` fails the chain, and the events bubble", () => {
		const parent = document.createElement("div");
		parent.appendChild(host);
		const bubbled: string[] = [];
		parent.addEventListener("pie-stage-change", (event) => {
			const { stage, status } = (event as CustomEvent).detail as {
				stage: string;
				status: string;
			};
			bubbled.push(`${stage}:${status}`);
		});

		engine.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: STUB_RUNTIME,
			effectiveToolsConfig: STUB_TOOLS,
			itemCount: 1,
		});
		engine.dispatchInput({
			kind: "update-readiness-signals",
			signals: {
				sectionReady: false,
				interactionReady: false,
				allLoadingComplete: false,
				runtimeError: true,
			},
			itemCount: 1,
			mode: "strict",
		});
		engine.dispose();

		expect(bubbled).toEqual([
			"composed:entered",
			"engine-ready:failed",
			"interactive:skipped",
			"disposed:entered",
		]);
	});
});

describe("SectionRuntimeEngine facade — pre-attach", () => {
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
