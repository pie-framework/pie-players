/**
 * Engine disposal tests.
 *
 * Composes a `SectionEngineAdapter` with a real `SectionEngineCore` to
 * verify the disposal path end-to-end:
 *
 *   - `dispose()` is idempotent (calling twice is a no-op).
 *   - The FSM emits `disposed` for the active cohort exactly once, as a
 *     `pie-stage-change` on the host.
 *   - Inputs after disposal emit nothing.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SectionEngineAdapter } from "../../../src/runtime/adapter/SectionEngineAdapter.js";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";

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

function createAdapter(host: EventTarget) {
	return new SectionEngineAdapter({
		host,
		runtimeId: "rt-1",
		sourceCe: "pie-section-player",
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
	test("dispose emits `disposed` once", () => {
		const host = document.createElement("div");
		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent).detail as { stage: string };
			stageEvents.push(detail.stage);
		});

		const adapter = createAdapter(host);
		initialize(adapter);
		adapter.dispatchInput({ kind: "section-controller-resolved" });

		adapter.dispose();

		expect(stageEvents).toContain("composed");
		expect(stageEvents).toContain("engine-ready");
		expect(stageEvents.filter((s) => s === "disposed")).toHaveLength(1);
	});

	test("dispose is idempotent across multiple calls", () => {
		const host = document.createElement("div");
		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent).detail as { stage: string };
			stageEvents.push(detail.stage);
		});
		const adapter = createAdapter(host);
		initialize(adapter);

		adapter.dispose();
		adapter.dispose();
		adapter.dispose();

		expect(stageEvents.filter((s) => s === "disposed")).toHaveLength(1);
	});

	test("inputs after dispose are no-ops", () => {
		const host = document.createElement("div");
		const adapter = createAdapter(host);

		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			stageEvents.push(
				((event as CustomEvent).detail as { stage: string }).stage,
			);
		});

		adapter.dispose();
		stageEvents.length = 0;

		const initOutputs = adapter.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: {} as never,
			effectiveToolsConfig: null,
			itemCount: 1,
		});
		expect(initOutputs).toEqual([]);
		expect(stageEvents).toHaveLength(0);
	});
});
