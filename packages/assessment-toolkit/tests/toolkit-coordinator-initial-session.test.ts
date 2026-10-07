import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerHandle,
	type SectionControllerSessionState,
} from "../src/index.js";

type Call =
	| "configureSessionPersistence"
	| "initialize"
	| "hydrate"
	| "applySession"
	| "updateInput";

function createRecordingController(
	options: { withApplySession?: boolean } = {},
) {
	const calls: Call[] = [];
	const applied: Array<{
		session: SectionControllerSessionState | null;
		mode?: string;
	}> = [];
	let session: SectionControllerSessionState = { itemSessions: {} };
	const handle: SectionControllerHandle = {
		configureSessionPersistence() {
			calls.push("configureSessionPersistence");
		},
		initialize() {
			calls.push("initialize");
		},
		updateInput() {
			calls.push("updateInput");
		},
		hydrate() {
			calls.push("hydrate");
		},
		getSession() {
			return session;
		},
	};
	if (options.withApplySession !== false) {
		handle.applySession = (next, applyOptions) => {
			calls.push("applySession");
			applied.push({ session: next, mode: applyOptions?.mode });
			session = next ?? { itemSessions: {} };
		};
	}
	return { handle, calls, applied };
}

const answered: SectionControllerSessionState = {
	currentItemIndex: 0,
	itemSessions: {
		"item-1": { id: "s-1", data: [{ id: "r1", value: ["a"] }] },
	},
};

function createCoordinator(assessmentId: string) {
	return new ToolkitCoordinator({ assessmentId, lazyInit: true });
}

describe("ToolkitCoordinator initialSession", () => {
	test("without one, a new controller hydrates after configure and initialize", async () => {
		const controller = createRecordingController();
		const coordinator = createCoordinator("initial-session-absent");
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});
		expect(controller.calls).toEqual([
			"configureSessionPersistence",
			"initialize",
			"hydrate",
		]);
	});

	test("a new controller applies it in replace mode in place of hydrate", async () => {
		const controller = createRecordingController();
		const coordinator = createCoordinator("initial-session-new");
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			initialSession: answered,
			createDefaultController: () => controller.handle,
		});
		expect(controller.calls).toEqual([
			"configureSessionPersistence",
			"initialize",
			"applySession",
		]);
		expect(controller.applied).toEqual([
			{ session: answered, mode: "replace" },
		]);
	});

	test("the ready lifecycle event and the ready hook see the applied session", async () => {
		const controller = createRecordingController();
		const seen: Array<SectionControllerSessionState | null | undefined> = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "initial-session-ready",
			lazyInit: true,
			hooks: {
				onSectionControllerReady: (_context, handle) => {
					seen.push(handle.getSession?.());
				},
			},
		});
		coordinator.onSectionControllerLifecycle((event) => {
			if (event.type === "ready") seen.push(event.controller.getSession?.());
		});
		await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			initialSession: answered,
			createDefaultController: () => controller.handle,
		});
		expect(seen).toEqual([answered, answered]);
	});

	test("a controller without applySession fails creation", async () => {
		const controller = createRecordingController({ withApplySession: false });
		const coordinator = createCoordinator("initial-session-no-apply");
		await expect(
			coordinator.getOrCreateSectionController({
				sectionId: "section-1",
				attemptId: "attempt-1",
				initialSession: answered,
				createDefaultController: () => controller.handle,
			}),
		).rejects.toThrow(/no applySession/);
		expect(controller.calls).not.toContain("hydrate");
		expect(
			coordinator.getSectionController({
				sectionId: "section-1",
				attemptId: "attempt-1",
			}),
		).toBeUndefined();
	});

	test("an existing controller takes updateInput, then the apply", async () => {
		const controller = createRecordingController();
		const coordinator = createCoordinator("initial-session-existing");
		const request = {
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		};
		await coordinator.getOrCreateSectionController(request);
		controller.calls.length = 0;
		await coordinator.getOrCreateSectionController({
			...request,
			initialSession: answered,
		});
		expect(controller.calls).toEqual(["updateInput", "applySession"]);
	});

	test("an existing controller ignores a session equal to its own", async () => {
		const controller = createRecordingController();
		const coordinator = createCoordinator("initial-session-equal");
		const request = {
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		};
		await coordinator.getOrCreateSectionController({
			...request,
			initialSession: answered,
		});
		controller.calls.length = 0;
		await coordinator.getOrCreateSectionController({
			...request,
			initialSession: structuredClone(answered),
		});
		expect(controller.calls).toEqual(["updateInput"]);
	});
});
