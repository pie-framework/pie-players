/**
 * Legacy event bridge tests (M7 PR 2).
 *
 * Asserts that `readiness-change`, `interaction-ready`, and `ready`
 * outputs translate into the matching DOM events with the
 * `EngineReadinessDetail` carried through unchanged. This guarantees
 * the kernel's existing `dispatch("readiness-change", detail)` /
 * `dispatch("interaction-ready", detail)` / `dispatch("ready", detail)`
 * payloads stay byte-identical when PR 5 deletes the kernel's `$effect`
 * cluster and routes those outputs through the engine.
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

import type { EngineReadinessDetail } from "../../../src/runtime/core/engine-readiness.js";
import { createLegacyEventBridge } from "../../../src/runtime/adapter/legacy-event-bridge.js";

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

const READINESS_LOADING: EngineReadinessDetail = {
	phase: "loading",
	interactionReady: false,
	allLoadingComplete: false,
	reason: "policy:progressive",
};

const READINESS_INTERACTION: EngineReadinessDetail = {
	phase: "interaction-ready",
	interactionReady: true,
	allLoadingComplete: false,
	reason: "policy:progressive",
};

const READINESS_READY: EngineReadinessDetail = {
	phase: "ready",
	interactionReady: true,
	allLoadingComplete: true,
	reason: "policy:progressive",
};

describe("legacy-event-bridge", () => {
	let host: HTMLElement;
	let events: { type: string; detail: unknown }[];

	beforeEach(() => {
		host = document.createElement("div");
		events = [];
		for (const name of ["readiness-change", "interaction-ready", "ready"]) {
			host.addEventListener(name, (event) => {
				events.push({
					type: event.type,
					detail: (event as CustomEvent).detail,
				});
			});
		}
	});

	test("forwards readiness-change with the detail untouched", () => {
		const bridge = createLegacyEventBridge({ host });
		bridge.dispatch({ kind: "readiness-change", detail: READINESS_LOADING });
		expect(events).toEqual([
			{ type: "readiness-change", detail: READINESS_LOADING },
		]);
	});

	test("forwards interaction-ready and ready with the detail untouched", () => {
		const bridge = createLegacyEventBridge({ host });
		bridge.dispatch({
			kind: "interaction-ready",
			detail: READINESS_INTERACTION,
		});
		bridge.dispatch({ kind: "ready", detail: READINESS_READY });
		expect(events).toEqual([
			{ type: "interaction-ready", detail: READINESS_INTERACTION },
			{ type: "ready", detail: READINESS_READY },
		]);
	});

	test("ignores canonical outputs (the dom-event-bridge owns those)", () => {
		const bridge = createLegacyEventBridge({ host });
		bridge.dispatch({
			kind: "stage-change",
			stage: "interactive",
			status: "entered",
			cohort: { sectionId: "section-A", attemptId: "attempt-1" },
		});
		bridge.dispatch({
			kind: "loading-complete",
			cohort: { sectionId: "section-A", attemptId: "attempt-1" },
			itemCount: 1,
			loadedCount: 1,
		});
		bridge.dispatch({
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
		expect(events).toHaveLength(0);
	});

	test("setHost re-points subsequent dispatches at the new host", () => {
		const bridge = createLegacyEventBridge({ host });
		const next = document.createElement("div");
		const nextEvents: string[] = [];
		next.addEventListener("readiness-change", (event) => {
			nextEvents.push(event.type);
		});
		bridge.setHost(next);
		bridge.dispatch({ kind: "readiness-change", detail: READINESS_LOADING });
		expect(events).toHaveLength(0);
		expect(nextEvents).toEqual(["readiness-change"]);
	});
});
