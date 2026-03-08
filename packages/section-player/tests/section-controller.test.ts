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

describe("SectionController canonical view models", () => {
	test("exposes canonical item view models in composition", async () => {
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

		const composition = controller.getCompositionModel();
		expect(composition.itemViewModels?.length).toBe(1);
		expect(composition.itemViewModels?.[0]?.itemId).toBe("runtime-item-1");
		expect(composition.itemViewModels?.[0]?.canonicalItemId).toBe(
			"canonical-item-1",
		);
		expect(
			controller.getCanonicalItemViewModel("runtime-item-1")?.canonicalItemId,
		).toBe("canonical-item-1");
		expect(controller.getCanonicalItemId("runtime-item-1")).toBe("canonical-item-1");
	});

	test("exposes canonical session view model", async () => {
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
		controller.handleItemSessionChanged("canonical-item-2", {
			session: { id: "session-2", data: [{ value: "x" }] },
		});

		const sessionView = controller.getCanonicalSessionViewModel();
		expect(sessionView.itemSessionsByCanonicalId["canonical-item-2"]).toEqual({
			id: "session-2",
			data: [{ value: "x" }],
		});
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
});
