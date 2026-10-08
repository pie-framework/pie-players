/**
 * Engine disposal tests.
 *
 * Composes a `SectionEngineAdapter` with a real `SectionEngineCore` and
 * a real `FrameworkErrorBus` to verify the disposal path end-to-end:
 *
 *   - `dispose()` is idempotent (calling twice is a no-op).
 *   - The FSM emits `disposed` for the active cohort exactly once.
 *   - The DOM bridge dispatches `pie-stage-change` with stage
 *     `"disposed"`.
 *   - The framework-error bus on the host is **not** disposed by the
 *     adapter — it stays usable for further fan-out (e.g. error banner
 *     state).
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SectionEngineAdapter } from "../../../src/runtime/adapter/SectionEngineAdapter.js";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import { FrameworkErrorBus } from "../../../src/services/framework-error-bus.js";

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

function createAdapter(host: EventTarget, bus = new FrameworkErrorBus()) {
	return new SectionEngineAdapter({
		host,
		runtimeId: "rt-1",
		sourceCe: "pie-section-player",
		frameworkErrorBus: bus,
	});
}

function initialize(adapter: SectionEngineAdapter): void {
	adapter.dispatchInput({
		kind: "initialize",
		cohort: COHORT,
		effectiveRuntime: {} as never,
		effectiveToolsConfig: null,
		itemCount: 1,
	});
}

describe("engine disposal", () => {
	test("dispose emits `disposed` once", async () => {
		const host = document.createElement("div");
		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent).detail as { stage: string };
			stageEvents.push(detail.stage);
		});

		const adapter = createAdapter(host);
		initialize(adapter);
		adapter.dispatchInput({ kind: "section-controller-resolved" });

		await adapter.dispose();

		expect(stageEvents).toContain("composed");
		expect(stageEvents).toContain("engine-ready");
		expect(stageEvents.filter((s) => s === "disposed")).toHaveLength(1);
	});

	test("dispose is idempotent across multiple calls", async () => {
		const host = document.createElement("div");
		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent).detail as { stage: string };
			stageEvents.push(detail.stage);
		});
		const adapter = createAdapter(host);
		initialize(adapter);

		await adapter.dispose();
		await adapter.dispose();
		await adapter.dispose();

		expect(stageEvents.filter((s) => s === "disposed")).toHaveLength(1);
	});

	test("the framework-error bus stays alive after engine disposal", async () => {
		const host = document.createElement("div");
		const bus = new FrameworkErrorBus();
		const adapter = createAdapter(host, bus);

		// External listener (e.g. error banner) the host owns directly.
		let externalCalls = 0;
		const detach = bus.subscribeFrameworkErrors(() => {
			externalCalls += 1;
		});
		expect(bus.getListenerCount()).toBeGreaterThan(0);

		await adapter.dispose();

		// External listener still in place; bus is still functional.
		expect(bus.getListenerCount()).toBeGreaterThanOrEqual(1);
		bus.reportFrameworkError({
			kind: "tool-config",
			severity: "error",
			source: "test",
			message: "after dispose",
			details: [],
			recoverable: false,
		});
		expect(externalCalls).toBe(1);

		detach();
	});

	test("inputs after dispose are no-ops", async () => {
		const host = document.createElement("div");
		const bus = new FrameworkErrorBus();
		const adapter = createAdapter(host, bus);

		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			stageEvents.push(
				((event as CustomEvent).detail as { stage: string }).stage,
			);
		});

		const frameworkErrorEvents: unknown[] = [];
		host.addEventListener("framework-error", (event) => {
			frameworkErrorEvents.push((event as CustomEvent).detail);
		});
		const busHits: unknown[] = [];
		bus.subscribeFrameworkErrors((model) => {
			busHits.push(model);
		});

		await adapter.dispose();
		stageEvents.length = 0;
		frameworkErrorEvents.length = 0;
		busHits.length = 0;

		const initOutputs = adapter.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: {} as never,
			effectiveToolsConfig: null,
			itemCount: 1,
		});
		expect(initOutputs).toEqual([]);
		expect(stageEvents).toHaveLength(0);

		// `framework-error` is the FSM input most likely to slip past
		// a future refactor that lifted `this.disposed` out of the
		// adapter on the assumption "the transition function handles
		// all phase gating": the pure `transition()` function emits
		// `framework-error` regardless of phase (see
		// `engine-transition.ts` `case "framework-error"`), so the
		// adapter's `dispose` guard at
		// `SectionEngineAdapter.dispatchInput` is what prevents the
		// bridges from fanning out post-dispose. Pin that boundary
		// here.
		const errorOutputs = adapter.dispatchInput({
			kind: "framework-error",
			error: {
				kind: "tool-config",
				severity: "error",
				source: "engine-disposal-test",
				message: "ignored after dispose",
				details: [],
				recoverable: false,
			},
		});
		expect(errorOutputs).toEqual([]);
		expect(frameworkErrorEvents).toHaveLength(0);
		expect(busHits).toHaveLength(0);
	});
});
