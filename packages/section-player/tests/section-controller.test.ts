import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	ItemEntity,
} from "@pie-players/pie-players-shared";
import { SectionController } from "../src/controllers/SectionController";

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: {
			elements: {},
			models: [],
			markup: "<div></div>",
		},
	} as unknown as ItemEntity;
}

describe("SectionController external contract", () => {
	test("exposes runtime state for current section snapshot", async () => {
		const controller = new SectionController();
		const item = makeItem("runtime-item-1");
		const section = {
			identifier: "section-1",
			assessmentItemRefs: [{ identifier: "canonical-item-1", item }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;

		await controller.initialize({
			section,
			sectionId: "section-1",
			assessmentId: "assessment-1",
			view: "candidate",
		});

		const runtimeState = controller.getRuntimeState();
		expect(runtimeState).not.toBeNull();
		expect(runtimeState?.sectionId).toBe("section-1");
		expect(runtimeState?.sectionIdentifier).toBe("section-1");
		expect(runtimeState?.currentItemIndex).toBe(-1);
		expect(runtimeState?.itemIdentifiers).toEqual(["canonical-item-1"]);
		expect(runtimeState?.currentItemId).toBe("");
		expect(runtimeState?.loadingComplete).toBe(false);
		expect(runtimeState?.totalRegistered).toBe(0);
		expect(runtimeState?.totalLoaded).toBe(0);
		expect(runtimeState?.itemsComplete).toBe(false);
		expect(runtimeState?.completedCount).toBe(0);
		expect(runtimeState?.totalItems).toBe(1);
	});

	test("exposes persistence session state", async () => {
		const controller = new SectionController();
		const item = makeItem("runtime-item-2");
		const section = {
			identifier: "section-2",
			assessmentItemRefs: [{ identifier: "canonical-item-2", item }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;

		await controller.initialize({
			section,
			sectionId: "section-2",
			assessmentId: "assessment-2",
			view: "candidate",
		});
		controller.updateItemSession("canonical-item-2", {
			session: { id: "session-2", data: [{ value: "x" }] },
		});

		const sessionState = controller.getSession();
		expect(sessionState).not.toBeNull();
		expect(sessionState?.currentItemIndex).toBe(0);
		expect(sessionState?.itemSessions["canonical-item-2"]).toEqual(
			expect.objectContaining({
				itemIdentifier: "canonical-item-2",
				session: {
					id: "session-2",
					data: [{ value: "x" }],
				},
			}),
		);
	});

	test("preserves item sessions across updateInput for existing controller", async () => {
		const controller = new SectionController();
		const item = makeItem("runtime-item-4");
		const section = {
			identifier: "section-4",
			assessmentItemRefs: [{ identifier: "canonical-item-4", item }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;

		await controller.initialize({
			section,
			sectionId: "section-4",
			assessmentId: "assessment-4",
			view: "candidate",
		});
		controller.updateItemSession("canonical-item-4", {
			session: { id: "session-4", data: [{ value: "persisted" }] },
		});

		await controller.updateInput({
			section: {
				...section,
				title: "Section 4 updated",
			},
			sectionId: "section-4",
			assessmentId: "assessment-4",
			view: "candidate",
		});

		const session = controller.getSession();
		expect(session?.itemSessions["canonical-item-4"]).toEqual(
			expect.objectContaining({
				itemIdentifier: "canonical-item-4",
				session: {
					id: "session-4",
					data: [{ value: "persisted" }],
				},
			}),
		);
	});

	test("broadcasts section-navigation-change from controller stream on input transitions", async () => {
		const controller = new SectionController();
		const events: Array<{
			previousSectionId?: string;
			currentSectionId?: string;
			reason?: string;
		}> = [];
		const unsubscribe = controller.subscribe((event) => {
			if (event.type !== "section-navigation-change") return;
			events.push({
				previousSectionId: event.previousSectionId,
				currentSectionId: event.currentSectionId,
				reason: event.reason,
			});
		});
		const sectionOne = {
			identifier: "section-1",
			assessmentItemRefs: [{ identifier: "canonical-item-1", item: makeItem("runtime-item-1") }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;
		const sectionTwo = {
			identifier: "section-2",
			assessmentItemRefs: [{ identifier: "canonical-item-2", item: makeItem("runtime-item-2") }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;

		await controller.initialize({
			section: sectionOne,
			sectionId: "section-1",
			assessmentId: "assessment-1",
			view: "candidate",
		});
		await controller.updateInput({
			section: sectionTwo,
			sectionId: "section-2",
			assessmentId: "assessment-1",
			view: "candidate",
		});
		unsubscribe();

		expect(events.length).toBeGreaterThanOrEqual(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				previousSectionId: undefined,
				currentSectionId: "section-1",
				reason: "input-change",
			}),
		);
		expect(events.at(-1)).toEqual(
			expect.objectContaining({
				previousSectionId: "section-1",
				currentSectionId: "section-2",
				reason: "input-change",
			}),
		);
	});

	test("does not replay historical events to late subscribers", async () => {
		const controller = new SectionController();
		const section = {
			identifier: "section-3",
			assessmentItemRefs: [{ identifier: "canonical-item-3", item: makeItem("runtime-item-3") }],
			rubricBlocks: [],
		} as unknown as AssessmentSection;
		await controller.initialize({
			section,
			sectionId: "section-3",
			assessmentId: "assessment-3",
			view: "candidate",
		});
		controller.handleContentRegistered({
			itemId: "runtime-item-3",
			canonicalItemId: "canonical-item-3",
			contentKind: "item",
		});
		controller.handleContentLoaded({
			itemId: "runtime-item-3",
			canonicalItemId: "canonical-item-3",
			contentKind: "item",
		});

		const seenTypes: string[] = [];
		const unsubscribe = controller.subscribe((event) => {
			seenTypes.push(event.type);
		});
		expect(seenTypes).toEqual([]);
		controller.navigateToItem(0);
		unsubscribe();

		expect(seenTypes).toEqual(["item-selected"]);
		const runtimeState = controller.getRuntimeState();
		expect(runtimeState).toEqual(
			expect.objectContaining({
				loadingComplete: true,
				totalRegistered: 1,
				totalLoaded: 1,
			}),
		);
	});
});
