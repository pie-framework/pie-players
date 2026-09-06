import { describe, expect, test } from "bun:test";
import { AssessmentController } from "../src/controller/AssessmentController";
import type { AssessmentPlayerHooks } from "../src/types";

function makeController(hooks: AssessmentPlayerHooks = {}) {
	return new AssessmentController({
		assessmentId: "lifecycle-assessment",
		attemptId: "lifecycle-attempt",
		assessment: { sections: [{ identifier: "one", assessmentItemRefs: [] }, { identifier: "two", assessmentItemRefs: [] }] },
		hooks: {
			createAssessmentSessionPersistence: () => ({ loadSession: () => null, saveSession: () => {} }),
			...hooks,
		},
	});
}

describe("assessment controller lifecycle", () => {
	for (const failure of ["plan", "load"] as const) {
		test(`a rejected ${failure} reaches the caller and reports one error without readiness`, async () => {
			const expected = new Error(`Rejected ${failure}`);
			const phases: string[] = [];
			let ready = 0;
			const controller = makeController({
				...(failure === "plan"
					? { createAssessmentDeliveryPlan: () => { throw expected; } }
					: { createAssessmentSessionPersistence: () => ({ loadSession: () => { throw expected; }, saveSession: () => {} }) }),
				onError: (_error, context) => { phases.push(context.phase); },
				onAssessmentControllerReady: () => { ready += 1; },
			});
			await expect(controller.initialize()).rejects.toBe(expected);
			expect(controller.getRuntimeState().readiness).toBe("error");
			expect(ready).toBe(0);
			expect(phases).toEqual([failure === "plan" ? "delivery-plan-create" : "session-load"]);
		});
	}

	test("disposal prevents a pending load from applying or signalling readiness", async () => {
		let release!: () => void;
		let loadStarted!: () => void;
		const started = new Promise<void>((resolve) => { loadStarted = resolve; });
		const delayed = new Promise<void>((resolve) => { release = resolve; });
		let ready = 0;
		let disposed = 0;
		const errors: unknown[] = [];
		const events: unknown[] = [];
		const controller = makeController({
			createAssessmentSessionPersistence: () => ({
				async loadSession() { loadStarted(); await delayed; return null; },
				saveSession() {},
			}),
			onAssessmentControllerReady: () => { ready += 1; },
			onAssessmentControllerDispose: () => { disposed += 1; },
			onError: (error) => { errors.push(error); },
		});
		controller.subscribe((event) => events.push(event));
		const initialization = controller.initialize();
		await started;
		await controller.dispose();
		await controller.dispose();
		release();
		await expect(initialization).rejects.toMatchObject({ name: "AbortError" });
		expect(controller.getSession()).toBeNull();
		expect(controller.navigateNext()).toBe(false);
		expect(ready).toBe(0);
		expect(disposed).toBe(1);
		expect(events).toEqual([]);
		expect(errors).toEqual([]);
	});

	test("repeated initialization does not reload the attempt", async () => {
		let loads = 0;
		const controller = makeController({
			createAssessmentSessionPersistence: () => ({
				loadSession() { loads += 1; return null; }, saveSession() {},
			}),
		});
		await Promise.all([controller.initialize(), controller.initialize()]);
		await controller.initialize();
		expect(loads).toBe(1);
		expect(controller.getRuntimeState().readiness).toBe("ready");
	});

	test("retiring from a session-applied listener cannot recreate disposed state", async () => {
		const controller = makeController({
			createAssessmentSessionPersistence: () => ({
				loadSession: () => controller.getSession(), saveSession() {},
			}),
		});
		controller.subscribe((event) => {
			if (event.type === "assessment-session-applied") void controller.dispose();
		});
		await expect(controller.initialize()).rejects.toMatchObject({ name: "AbortError" });
		expect(controller.getSession()).toBeNull();
		expect(controller.getRuntimeState().readiness).not.toBe("ready");
	});
});
