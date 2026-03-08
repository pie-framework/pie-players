import { expect, test } from "@playwright/test";
import { createReadinessDetail } from "../src/components/shared/section-player-readiness.js";

test.describe("section player readiness semantics", () => {
	test("keeps interaction-safe and final-ready moments separate", async () => {
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

	test("marks final ready only when section-ready and all loading complete", async () => {
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

	test("is deterministic for equivalent readiness signal sets", async () => {
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

	test("strict mode gates interaction-ready until all loading complete", async () => {
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
});
