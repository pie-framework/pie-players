/**
 * DOM event bridge tests (M7 PR 2).
 *
 * Asserts that every `SectionEngineOutput` of canonical kind
 * (`stage-change`, `loading-complete`, `framework-error`) translates
 * into a single DOM `CustomEvent` dispatch on the host with the legacy
 * detail shape (`runtimeId`, `sourceCe`, `timestamp`, etc.) preserved
 * bit-for-bit.
 *
 * Uses `@happy-dom/global-registrator` for the DOM surface (matches
 * the toolkit-test convention in
 * `packages/assessment-toolkit/tests/ssml-extractor-sanitization.test.ts`).
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

import type { CohortKey } from "../../../src/runtime/core/cohort.js";
import type { FrameworkErrorModel } from "../../../src/services/framework-error.js";
import { createDomEventBridge } from "../../../src/runtime/adapter/dom-event-bridge.js";

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
const FROZEN_TS = "2026-04-25T00:00:00.000Z";

function makeBridge(host: EventTarget) {
	return createDomEventBridge({
		host,
		runtimeId: "test-runtime-1",
		sourceCe: "pie-section-player",
		now: () => FROZEN_TS,
	});
}

function frameworkError(): FrameworkErrorModel {
	return {
		kind: "tool-config",
		severity: "error",
		source: "test",
		message: "boom",
		details: [],
		recoverable: false,
	};
}

describe("dom-event-bridge", () => {
	let host: HTMLElement;
	let events: { type: string; detail: unknown }[];

	beforeEach(() => {
		host = document.createElement("div");
		events = [];
		for (const name of [
			"pie-stage-change",
			"pie-loading-complete",
			"framework-error",
		]) {
			host.addEventListener(name, (event) => {
				events.push({
					type: event.type,
					detail: (event as CustomEvent).detail,
				});
			});
		}
	});

	test("dispatches `pie-stage-change` with the canonical StageChangeDetail shape", () => {
		const bridge = makeBridge(host);
		bridge.dispatch({
			kind: "stage-change",
			stage: "engine-ready",
			status: "entered",
			cohort: COHORT,
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "pie-stage-change",
			detail: {
				stage: "engine-ready",
				status: "entered",
				runtimeId: "test-runtime-1",
				sectionId: "section-A",
				attemptId: "attempt-1",
				timestamp: FROZEN_TS,
				sourceCe: "pie-section-player",
			},
		});
	});

	test("attemptId is omitted from the detail when the cohort attempt is empty", () => {
		const bridge = makeBridge(host);
		bridge.dispatch({
			kind: "stage-change",
			stage: "composed",
			status: "entered",
			cohort: { sectionId: "section-A", attemptId: "" },
		});
		expect(
			(events[0]?.detail as { attemptId?: string }).attemptId,
		).toBeUndefined();
	});

	test("dispatches `pie-loading-complete` with itemCount / loadedCount carried through", () => {
		const bridge = makeBridge(host);
		bridge.dispatch({
			kind: "loading-complete",
			cohort: COHORT,
			itemCount: 3,
			loadedCount: 3,
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "pie-loading-complete",
			detail: {
				runtimeId: "test-runtime-1",
				sectionId: "section-A",
				attemptId: "attempt-1",
				itemCount: 3,
				loadedCount: 3,
				timestamp: FROZEN_TS,
				sourceCe: "pie-section-player",
			},
		});
	});

	test("dispatches `framework-error` with the model as the detail", () => {
		const bridge = makeBridge(host);
		const model = frameworkError();
		bridge.dispatch({ kind: "framework-error", error: model });
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("framework-error");
		expect(events[0].detail).toBe(model);
	});

	test("setHost re-points subsequent dispatches at the new host", () => {
		const bridge = makeBridge(host);
		const next = document.createElement("div");
		const nextEvents: string[] = [];
		next.addEventListener("pie-stage-change", (event) => {
			nextEvents.push(event.type);
		});
		bridge.setHost(next);
		bridge.dispatch({
			kind: "stage-change",
			stage: "interactive",
			status: "entered",
			cohort: COHORT,
		});
		expect(events).toHaveLength(0);
		expect(nextEvents).toEqual(["pie-stage-change"]);
	});
});
