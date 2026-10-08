/**
 * The coordinator's default section persistence, as a controller drives it:
 * `hydrate()` loads from the strategy it was configured with, `persist()` saves
 * to it. Each learner is a new coordinator on the same device.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
	type SectionControllerHandle,
	type SectionControllerSessionState,
	type SectionSessionPersistenceConfig,
	ToolkitCoordinator,
} from "../src/index.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

afterEach(() => localStorage.clear());

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const ASSESSMENT_ID = "default-persistence";

const answered: SectionControllerSessionState = {
	currentItemIndex: 0,
	itemSessions: {
		"item-1": { id: "s-1", data: [{ id: "r1", value: ["a"] }] },
	},
};

/** A learner opening section-1, answering it when given `answer`. */
async function deliver(attemptId: string | undefined, answer?: boolean) {
	let persistence: SectionSessionPersistenceConfig | null = null;
	let session: SectionControllerSessionState = { itemSessions: {} };
	const handle: SectionControllerHandle = {
		configureSessionPersistence(config) {
			persistence = config;
		},
		async hydrate() {
			if (!persistence) return;
			const stored = await persistence.strategy.loadSession(persistence.context);
			if (stored) session = stored;
		},
		async persist() {
			if (!persistence) return;
			await persistence.strategy.saveSession(persistence.context, session);
		},
		getSession: () => session,
	};
	const coordinator = new ToolkitCoordinator({
		assessmentId: ASSESSMENT_ID,
		lazyInit: true,
	});
	await coordinator.getOrCreateSectionController({
		sectionId: "section-1",
		attemptId,
		createDefaultController: () => handle,
	});
	const resumed = session;
	if (answer) {
		session = answered;
		await handle.persist?.();
	}
	return { resumed };
}

const storedKeys = () =>
	Object.keys(localStorage).filter((key) =>
		key.startsWith(`pie:section-controller:v1:${ASSESSMENT_ID}:`),
	);

describe("ToolkitCoordinator default section persistence", () => {
	test("resumes a section stored under the same attempt id", async () => {
		await deliver("attempt-1", true);

		const { resumed } = await deliver("attempt-1");
		expect(resumed).toEqual(answered);
		expect(storedKeys()).toEqual([
			`pie:section-controller:v1:${ASSESSMENT_ID}:section-1:attempt-1`,
		]);
	});

	test("without an attempt id stores nothing, so the next learner starts empty", async () => {
		await deliver(undefined, true);
		expect(storedKeys()).toEqual([]);

		const { resumed } = await deliver(undefined);
		expect(resumed).toEqual({ itemSessions: {} });
	});

	test("without an attempt id reads nothing stored under the old shared key", async () => {
		localStorage.setItem(
			`pie:section-controller:v1:${ASSESSMENT_ID}:section-1:default`,
			JSON.stringify(answered),
		);

		const { resumed } = await deliver(undefined);
		expect(resumed).toEqual({ itemSessions: {} });
	});
});
