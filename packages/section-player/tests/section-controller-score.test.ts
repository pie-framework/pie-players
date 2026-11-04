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
		config: { elements: {}, models: [], markup: "<div></div>" },
	} as unknown as ItemEntity;
}

async function initialized() {
	const controller = new SectionController();
	await controller.initialize({
		section: {
			identifier: "section-1",
			assessmentItemRefs: ["item-1", "item-2", "item-3"].map(
				(itemId, index) => ({
					identifier: `canonical-${index + 1}`,
					item: makeItem(itemId),
				}),
			),
			rubricBlocks: [],
		} as unknown as AssessmentSection,
		sectionId: "section-1",
		assessmentId: "assessment-1",
		view: ["candidate"],
	});
	return controller;
}

describe("SectionController score", () => {
	test("scores every item in section order through the layout's scorer", async () => {
		const controller = await initialized();
		const ids = controller
			.getViewModel()
			.items.map((item) => controller.getCanonicalItemId(item.id || ""));
		controller.registerItemScorer(async (canonicalItemId) => {
			if (canonicalItemId === ids[1]) return false;
			if (canonicalItemId === ids[2]) throw new Error("scoring exploded");
			return [{ score: 1 }];
		});

		const { items } = await controller.score();

		expect(items).toEqual([
			{ canonicalItemId: ids[0], outcomes: [{ score: 1 }] },
			{ canonicalItemId: ids[1], outcomes: null },
			{ canonicalItemId: ids[2], outcomes: null },
		]);
	});

	test("answers null outcomes with no scorer registered", async () => {
		const controller = await initialized();
		const release = controller.registerItemScorer(async () => [{ score: 1 }]);
		release();

		const { items } = await controller.score();

		expect(items.map((item) => item.outcomes)).toEqual([null, null, null]);
	});

	test("releasing a replaced scorer keeps the scorer that replaced it", async () => {
		const controller = await initialized();
		const releaseFirst = controller.registerItemScorer(async () => [
			{ score: 0 },
		]);
		controller.registerItemScorer(async () => [{ score: 1 }]);
		releaseFirst();

		const { items } = await controller.score();

		expect(items.map((item) => item.outcomes)).toEqual([
			[{ score: 1 }],
			[{ score: 1 }],
			[{ score: 1 }],
		]);
	});
});
