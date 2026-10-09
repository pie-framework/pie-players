import { describe, expect, test } from "bun:test";
import { AssessmentController } from "../src/controller/AssessmentController";
import type { AssessmentSession } from "../src/types";

type Write = { section: number; release: () => void; fail: (error: Error) => void };

/** A strategy whose writes stay pending until the test settles them. */
function deferredStore() {
	const writes: Write[] = [];
	const stored: number[] = [];
	return {
		writes,
		stored,
		strategy: {
			loadSession: () => null,
			saveSession: (_context: unknown, session: AssessmentSession) => {
				const section = session.navigationState.currentSectionIndex;
				return new Promise<void>((resolve, reject) => {
					writes.push({
						section,
						release: () => { stored.push(section); resolve(); },
						fail: reject,
					});
				});
			},
		},
	};
}

function makeController(store: ReturnType<typeof deferredStore>, errors: string[] = []) {
	return new AssessmentController({
		assessmentId: "order-assessment",
		attemptId: "order-attempt",
		assessment: { sections: [{ identifier: "one", assessmentItemRefs: [] }, { identifier: "two", assessmentItemRefs: [] }] },
		hooks: {
			createAssessmentSessionPersistence: () => store.strategy,
			onError: (_error, context) => { errors.push(context.phase); },
		},
	});
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("assessment controller persistence order", () => {
	test("a newer save starts only after the older one settles, so it lands last", async () => {
		const store = deferredStore();
		const controller = makeController(store);
		await controller.initialize();
		const older = controller.persist();
		await flush();
		controller.navigateNext();
		const newer = controller.persist();
		await flush();
		expect(store.writes.map((w) => w.section)).toEqual([0]);
		store.writes[0]!.release();
		await older;
		await flush();
		store.writes[1]!.release();
		await newer;
		expect(store.stored).toEqual([0, 1]);
	});

	test("a failed save reports once and does not block the next one", async () => {
		const store = deferredStore();
		const errors: string[] = [];
		const controller = makeController(store, errors);
		await controller.initialize();
		const failing = controller.persist();
		const next = controller.persist();
		await flush();
		store.writes[0]!.fail(new Error("offline"));
		await failing;
		await flush();
		store.writes[1]!.release();
		await next;
		expect(errors).toEqual(["session-save"]);
		expect(store.stored).toEqual([0]);
	});

	test("submit announces success only after its save succeeds", async () => {
		const store = deferredStore();
		const controller = makeController(store);
		await controller.initialize();
		const events: string[] = [];
		controller.subscribe((event) => events.push(event.type));
		const submission = controller.submit();
		await flush();
		expect(controller.getRuntimeState().submitted).toBe(false);
		expect(events).not.toContain("assessment-submission-state-changed");
		store.writes[0]!.release();
		await submission;
		expect(controller.getRuntimeState().submitted).toBe(true);
		expect(events).toContain("assessment-submission-state-changed");
	});

	test("a rejected submit rejects its caller, stays unsubmitted and can be retried", async () => {
		const store = deferredStore();
		const errors: string[] = [];
		const controller = makeController(store, errors);
		await controller.initialize();
		const events: string[] = [];
		controller.subscribe((event) => events.push(event.type));
		const failure = new Error("rejected");
		const first = controller.submit();
		await flush();
		store.writes[0]!.fail(failure);
		await expect(first).rejects.toBe(failure);
		expect(controller.getRuntimeState().submitted).toBe(false);
		expect(events).not.toContain("assessment-submission-state-changed");
		expect(errors).toEqual(["session-save"]);
		const retry = controller.submit();
		await flush();
		store.writes[1]!.release();
		await retry;
		expect(controller.getRuntimeState().submitted).toBe(true);
	});
});
