/**
 * Engine readiness tests (M7).
 *
 * Canonical guardrail for `runtime/core/engine-readiness.ts`. The
 * section-player suite still owns
 * `tests/section-player-readiness-events.spec.ts` as a Playwright DOM
 * test that exercises the layout CE end-to-end; this file is a pure
 * unit test (bun test) since the readiness derivation is pure.
 */

import { describe, expect, test } from "bun:test";
import { createReadinessDetail } from "../../../src/runtime/core/engine-readiness.js";

describe("engine-readiness: createReadinessDetail (progressive)", () => {
	test("keeps interaction-safe and final-ready moments separate", () => {
		const interactionDetail = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: false,
				runtimeError: false,
			},
		});
		expect(interactionDetail.interactionReady).toBe(true);
		expect(interactionDetail.allLoadingComplete).toBe(false);
		expect(interactionDetail.phase).toBe("interaction-ready");
	});

	test("marks final ready only when section-ready and all loading complete", () => {
		const notReady = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: false,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
		});
		expect(notReady.allLoadingComplete).toBe(false);

		const finalReady = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
		});
		expect(finalReady.allLoadingComplete).toBe(true);
		expect(finalReady.phase).toBe("ready");
	});

	test("is deterministic for equivalent readiness signal sets", () => {
		const first = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
		});
		const second = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
		});
		expect(second).toEqual(first);
	});

	test("runtimeError takes precedence over every other phase", () => {
		const detail = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: true,
			},
		});
		expect(detail.phase).toBe("error");
	});

	test("emits bootstrapping when nothing is ready yet", () => {
		const detail = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: false,
				interactionReady: false,
				allLoadingComplete: false,
				runtimeError: false,
			},
		});
		expect(detail.phase).toBe("bootstrapping");
	});
});

describe("engine-readiness: strict-mode gate", () => {
	test("strict mode gates interaction-ready until all loading complete", () => {
		const strictPending = createReadinessDetail({
			mode: "strict",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: false,
				runtimeError: false,
			},
		});
		expect(strictPending.interactionReady).toBe(false);
		expect(strictPending.allLoadingComplete).toBe(false);
		expect(strictPending.phase).toBe("loading");

		const strictReady = createReadinessDetail({
			mode: "strict",
			signals: {
				sectionReady: true,
				interactionReady: true,
				allLoadingComplete: true,
				runtimeError: false,
			},
		});
		expect(strictReady.interactionReady).toBe(true);
		expect(strictReady.allLoadingComplete).toBe(true);
		expect(strictReady.phase).toBe("ready");
	});

	test("strict mode still surfaces runtimeError immediately", () => {
		const detail = createReadinessDetail({
			mode: "strict",
			signals: {
				sectionReady: false,
				interactionReady: false,
				allLoadingComplete: false,
				runtimeError: true,
			},
		});
		expect(detail.phase).toBe("error");
	});

	test("reason is preserved verbatim into the detail", () => {
		const detail = createReadinessDetail({
			mode: "progressive",
			signals: {
				sectionReady: true,
				interactionReady: false,
				allLoadingComplete: false,
				runtimeError: false,
			},
			reason: "items-loading",
		});
		expect(detail.reason).toBe("items-loading");
	});
});
