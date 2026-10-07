import { describe, expect, test } from "bun:test";
import type {
	AdvancedItemConfig,
	AssessmentSection,
	PieContent,
} from "@pie-players/pie-players-shared/types";
import { SectionContentService } from "../src/controllers/SectionContentService";
import { sectionFromItem } from "../src/item-section/index";

const pie: PieContent = {
	id: "item-42",
	elements: { "pie-multiple-choice": "@pie-element/multiple-choice@11.0.0" },
	models: [{ id: "q1", element: "pie-multiple-choice" }],
	markup: '<pie-multiple-choice id="q1"></pie-multiple-choice>',
};

const passage: PieContent = {
	id: "passage-7",
	elements: { "pie-passage": "@pie-element/passage@5.0.0" },
	models: [{ id: "p1", element: "pie-passage" }],
	markup: '<pie-passage id="p1"></pie-passage>',
};

const session = { id: "session-1", data: [{ id: "q1", value: ["a"] }] };

describe("sectionFromItem", () => {
	test("wraps a PieContent config in a one-item section", () => {
		const result = sectionFromItem(pie);
		const section: AssessmentSection = result.section;
		expect(section).toEqual({
			identifier: "item-42",
			assessmentItemRefs: [
				{ identifier: "item-42", item: { id: "item-42", config: pie } },
			],
		});
		expect(result.session).toBeNull();
	});

	test("keys the item session by the config id", () => {
		const { session: sectionSession } = sectionFromItem(pie, { session });
		expect(sectionSession).toEqual({
			currentItemIndex: 0,
			itemSessions: { "item-42": session },
		});
	});

	test("takes a section id and an item vId", () => {
		const { section } = sectionFromItem(pie, {
			sectionId: "section-1",
			itemVId: "vid-42",
		});
		expect(section.identifier).toBe("section-1");
		expect(section.assessmentItemRefs?.[0]?.itemVId).toBe("vid-42");
	});

	test("maps an advanced config, keeping its extras on the item config", () => {
		const instructorResources: [PieContent] = [{ ...pie, id: "resource-1" }];
		const defaultExtraModels = { q1: { partialScoring: true } };
		const config: AdvancedItemConfig = {
			id: "item-advanced",
			pie,
			passage,
			instructorResources,
			defaultExtraModels,
		};
		const before = structuredClone(config);
		const item = sectionFromItem(config).section.assessmentItemRefs?.[0]?.item;
		expect(item).toEqual({
			id: "item-advanced",
			config: { ...pie, instructorResources, defaultExtraModels },
			passage: { id: "passage-7", config: passage },
		});
		expect(item).not.toHaveProperty("baseId");
		expect(item).not.toHaveProperty("version");
		expect(config).toEqual(before);
	});

	test("keeps a default extra models value already on pie", () => {
		const own = { q1: { partialScoring: false } };
		const item = sectionFromItem({
			id: "item-advanced",
			pie: { ...pie, defaultExtraModels: own },
			defaultExtraModels: { q1: { partialScoring: true } },
		}).section.assessmentItemRefs?.[0]?.item;
		expect(item?.config.defaultExtraModels).toBe(own);
	});

	test("the section player renders the item under the config id, with its passage", () => {
		const { section } = sectionFromItem({ id: "item-advanced", pie, passage });
		const content = new SectionContentService().build(section, "candidate");
		expect(content.items.map((item) => item.id)).toEqual(["item-advanced"]);
		expect(content.passages.map((entry) => entry.id)).toEqual(["passage-7"]);
		expect(content.adapterItemRefs[0]?.identifier).toBe("item-advanced");
	});
});
