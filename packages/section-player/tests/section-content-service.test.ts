import { describe, expect, test } from "bun:test";
import type { AssessmentSection, ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
import { SectionContentService } from "../src/controllers/SectionContentService";

function makePassage(id: string): PassageEntity {
	return {
		id,
		name: id,
		config: {
			elements: {},
			models: [],
			markup: "<div></div>",
		},
	} as unknown as PassageEntity;
}

function makeItem(id: string, passage?: PassageEntity): ItemEntity {
	return {
		id,
		name: id,
		passage: passage || undefined,
		config: {
			elements: {},
			models: [],
			markup: "<div></div>",
		},
	} as unknown as ItemEntity;
}

describe("SectionContentService renderables", () => {
	test("builds canonical renderables with flavors", () => {
		const sharedPassage = makePassage("p1");
		const rubricPassage = makePassage("rb1");
		const item = makeItem("i1", sharedPassage);
		const section = {
			assessmentItemRefs: [{ identifier: "i1-ref", item }],
			rubricBlocks: [
				{ class: "stimulus", view: "candidate", passage: sharedPassage },
				{ class: "rubric", view: "candidate", passage: rubricPassage },
			],
		} as unknown as AssessmentSection;

		const service = new SectionContentService();
		const content = service.build(section, "candidate");

		expect(content.renderables.map((r) => `${r.flavor}:${r.entity.id}`)).toEqual([
			"passage:p1",
			"item:i1",
			"rubric:rb1",
		]);
	});
});
