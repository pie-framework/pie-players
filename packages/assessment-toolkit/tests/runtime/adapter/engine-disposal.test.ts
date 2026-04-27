/**
 * Engine disposal tests (M7 PR 2).
 *
 * Composes a `SectionEngineAdapter` with a real `SectionEngineCore`,
 * a fake coordinator, and a real `FrameworkErrorBus` to verify the
 * disposal path end-to-end:
 *
 *   - `dispose()` is idempotent (calling twice is a no-op).
 *   - The FSM emits `disposed` for the active cohort exactly once.
 *   - The DOM bridge dispatches `pie-stage-change` with stage
 *     `"disposed"`.
 *   - The framework-error bus loses no listeners that the bridge did
 *     not register (i.e. the bridge cleans up only its own
 *     subscription).
 *   - The coordinator's `disposeSectionController(...)` is called once
 *     for the active cohort.
 *   - The framework-error bus on the host is **not** disposed by the
 *     adapter — it stays usable for further fan-out (e.g. error banner
 *     state).
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SectionEngineAdapter } from "../../../src/runtime/adapter/SectionEngineAdapter.js";
import type { CoordinatorPort } from "../../../src/runtime/adapter/coordinator-bridge.js";
import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import { FrameworkErrorBus } from "../../../src/services/framework-error-bus.js";
import type { SectionControllerHandle } from "../../../src/services/section-controller-types.js";

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

function createFakeCoordinator(): CoordinatorPort & {
	disposeCalls: { sectionId: string; attemptId?: string }[];
	bus: FrameworkErrorBus;
} {
	const bus = new FrameworkErrorBus();
	const disposeCalls: { sectionId: string; attemptId?: string }[] = [];
	let pendingResolve: ((controller: SectionControllerHandle) => void) | null =
		null;

	const port: CoordinatorPort = {
		subscribeFrameworkErrors(listener) {
			return bus.subscribeFrameworkErrors(listener);
		},
		async getOrCreateSectionController(args) {
			const promise = new Promise<SectionControllerHandle>((resolve) => {
				pendingResolve = resolve;
			});
			queueMicrotask(() => {
				const ctrl: SectionControllerHandle = {
					subscribe: () => () => {},
				};
				pendingResolve?.(ctrl);
				pendingResolve = null;
			});
			void args;
			return promise;
		},
		async disposeSectionController(args) {
			disposeCalls.push(args);
		},
	};

	return Object.assign(port, { disposeCalls, bus });
}

describe("engine disposal", () => {
	test("dispose emits `disposed` once and disposes the section controller", async () => {
		const host = document.createElement("div");
		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent).detail as { stage: string };
			stageEvents.push(detail.stage);
		});

		const fake = createFakeCoordinator();
		const adapter = new SectionEngineAdapter({
			host,
			runtimeId: "rt-1",
			sourceCe: "pie-section-player",
			frameworkErrorBus: fake.bus,
			coordinator: fake,
		});

		await adapter.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => ({
				subscribe: () => () => {},
			}),
		});

		// The adapter requires `initialize` to advance into a non-idle
		// phase before the controller-resolved input has any effect.
		// For this test we drive `initialize` directly to mirror what
		// the kernel will do in PR 5.
		adapter.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: {} as never,
			effectiveToolsConfig: null,
			itemCount: 1,
		});
		// Replay the controller-resolved input so the FSM advances to
		// `engine-ready` (the bridge already dispatched it asynchronously
		// during resolveSectionController; the duplicate is idempotent
		// per the FSM's `phase !== booting-section` short-circuit).
		adapter.dispatchInput({ kind: "section-controller-resolved" });

		await adapter.dispose();

		expect(stageEvents).toContain("composed");
		expect(stageEvents).toContain("engine-ready");
		expect(stageEvents.filter((s) => s === "disposed")).toHaveLength(1);
		expect(fake.disposeCalls).toEqual([
			{ sectionId: "section-A", attemptId: "attempt-1" },
		]);
	});

	test("dispose is idempotent across multiple calls", async () => {
		const host = document.createElement("div");
		const fake = createFakeCoordinator();
		const adapter = new SectionEngineAdapter({
			host,
			runtimeId: "rt-1",
			sourceCe: "pie-section-player",
			frameworkErrorBus: fake.bus,
			coordinator: fake,
		});
		await adapter.resolveSectionController({
			cohort: COHORT,
			assessmentId: "assess-1",
			view: "student",
			section: { id: "section-A" },
			createDefaultController: async () => ({
				subscribe: () => () => {},
			}),
		});
		adapter.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: {} as never,
			effectiveToolsConfig: null,
			itemCount: 1,
		});

		await adapter.dispose();
		await adapter.dispose();
		await adapter.dispose();

		expect(fake.disposeCalls).toHaveLength(1);
	});

	test("the framework-error bus stays alive after engine disposal", async () => {
		const host = document.createElement("div");
		const fake = createFakeCoordinator();
		const adapter = new SectionEngineAdapter({
			host,
			runtimeId: "rt-1",
			sourceCe: "pie-section-player",
			frameworkErrorBus: fake.bus,
			coordinator: fake,
		});

		// External listener (e.g. error banner) the host owns directly.
		let externalCalls = 0;
		const detach = fake.bus.subscribeFrameworkErrors(() => {
			externalCalls += 1;
		});
		expect(fake.bus.getListenerCount()).toBeGreaterThan(0);

		await adapter.dispose();

		// External listener still in place; bus is still functional.
		expect(fake.bus.getListenerCount()).toBeGreaterThanOrEqual(1);
		fake.bus.reportFrameworkError({
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
		const fake = createFakeCoordinator();
		const adapter = new SectionEngineAdapter({
			host,
			runtimeId: "rt-1",
			sourceCe: "pie-section-player",
			frameworkErrorBus: fake.bus,
			coordinator: fake,
		});

		const stageEvents: string[] = [];
		host.addEventListener("pie-stage-change", (event) => {
			stageEvents.push(
				((event as CustomEvent).detail as { stage: string }).stage,
			);
		});

		await adapter.dispose();
		stageEvents.length = 0;

		const outputs = adapter.dispatchInput({
			kind: "initialize",
			cohort: COHORT,
			effectiveRuntime: {} as never,
			effectiveToolsConfig: null,
			itemCount: 1,
		});
		expect(outputs).toEqual([]);
		expect(stageEvents).toHaveLength(0);
	});
});
