/**
 * The assessment controller's default persistence. Each learner is a new
 * controller on the same device, whose `localStorage` this file stands in for.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { AssessmentController } from "../src/controller/AssessmentController";

const stored = new Map<string, string>();
const localStorage = {
	getItem: (key: string) => stored.get(key) ?? null,
	setItem: (key: string, value: string) => void stored.set(key, value),
	removeItem: (key: string) => void stored.delete(key),
};
const runWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
	configurable: true,
	value: { localStorage },
});

afterEach(() => stored.clear());

afterAll(() => {
	if (runWindow) Object.defineProperty(globalThis, "window", runWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

const ASSESSMENT_ID = "default-persistence";

/** A learner starting the attempt, moving to the second section when `advance`. */
async function deliver(attemptId: string | undefined, advance?: boolean) {
	const controller = new AssessmentController({
		assessmentId: ASSESSMENT_ID,
		attemptId,
		assessment: {
			sections: [
				{ identifier: "one", assessmentItemRefs: [] },
				{ identifier: "two", assessmentItemRefs: [] },
			],
		},
	});
	await controller.initialize();
	const resumedOn = controller.getRuntimeState().currentSectionIndex;
	if (advance) {
		await controller.navigateNext();
		await controller.persist();
	}
	await controller.dispose();
	return { resumedOn };
}

const sessionKeys = () =>
	[...stored.keys()].filter((key) =>
		key.startsWith(`pie:assessment-controller:v1:${ASSESSMENT_ID}:`),
	);

describe("assessment controller default persistence", () => {
	test("resumes an attempt stored under the same attempt id", async () => {
		await deliver("attempt-1", true);

		expect((await deliver("attempt-1")).resumedOn).toBe(1);
		expect(sessionKeys()).toEqual([
			`pie:assessment-controller:v1:${ASSESSMENT_ID}:attempt-1`,
		]);
	});

	test("without an attempt id stores nothing, so the next learner starts at the beginning", async () => {
		await deliver(undefined, true);
		expect(sessionKeys()).toEqual([]);

		expect((await deliver(undefined)).resumedOn).toBe(0);
	});

	test("without an attempt id reads nothing stored under the old shared key", async () => {
		// The key a missing attempt id used to share.
		await deliver("default", true);

		expect((await deliver(undefined)).resumedOn).toBe(0);
	});
});
