import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	ItemEntity,
	PassageEntity,
} from "@pie-players/pie-players-shared";
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
				{ class: "stimulus", view: ["candidate"], passage: sharedPassage },
				{ class: "rubric", view: ["candidate"], passage: rubricPassage },
			],
		} as unknown as AssessmentSection;

		const service = new SectionContentService();
		const content = service.build(section, "candidate");

		expect(
			content.renderables.map((r) => `${r.flavor}:${r.entity.id}`),
		).toEqual(["passage:p1", "item:i1", "rubric:rb1"]);
	});

	test("synthesizes ids when item and passage ids are missing", () => {
		const itemWithoutId = {
			name: "untitled-item",
			passage: {
				name: "passage-without-id",
				config: {
					elements: {},
					models: [],
					markup: "<div></div>",
				},
			},
			config: {
				elements: {},
				models: [],
				markup: "<div></div>",
			},
		} as unknown as ItemEntity;
		const rubricWithoutId = {
			name: "rubric-without-id",
			config: {
				elements: {},
				models: [],
				markup: "<div></div>",
			},
		} as unknown as PassageEntity;
		const section = {
			assessmentItemRefs: [{ item: itemWithoutId }],
			rubricBlocks: [
				{ class: "rubric", view: ["candidate"], passage: rubricWithoutId },
			],
		} as unknown as AssessmentSection;

		const service = new SectionContentService();
		const content = service.build(section, "candidate");

		expect(content.items[0]?.id).toBeTruthy();
		expect(content.adapterItemRefs[0]?.item?.id).toBe(content.items[0]?.id);
		expect(content.adapterItemRefs[0]?.identifier).toBeTruthy();
		expect(content.passages[0]?.id).toBeTruthy();
		expect(content.renderables.every((r) => Boolean(r.entity.id))).toBe(true);
	});
});

describe("SectionContentService authored ids", () => {
	// A bson ObjectId serialized without conversion, as a host once passed one.
	const objectId = { buffer: { 0: 106, 1: 66, 11: 116 } };
	const build = (section: unknown) =>
		new SectionContentService().build(
			section as AssessmentSection,
			"candidate",
		);

	test("refuses an item passage id that is not a string, by its path", () => {
		const passage = { ...makePassage("p1"), id: objectId };
		const section = {
			assessmentItemRefs: [
				{ identifier: "i1", item: makeItem("i1", passage as never) },
			],
		};

		expect(() => build(section)).toThrow(
			new TypeError(
				"Section assessmentItemRefs[0].item.passage.id must be a string, got object",
			),
		);
	});

	test("refuses a rubric block passage id that is not a string", () => {
		const section = {
			assessmentItemRefs: [],
			rubricBlocks: [
				{
					class: "stimulus",
					view: ["candidate"],
					passage: { ...makePassage("p1"), id: [1] },
				},
			],
		};

		expect(() => build(section)).toThrow(
			"Section rubricBlocks[0].passage.id must be a string, got array",
		);
	});

	test("refuses an item id that is not a string, ahead of its identifier", () => {
		const section = {
			assessmentItemRefs: [
				{ identifier: objectId, item: { ...makeItem("i1"), id: objectId } },
			],
		};

		expect(() => build(section)).toThrow(
			"Section assessmentItemRefs[0].item.id must be a string, got object",
		);
	});

	test("refuses an item ref identifier that is not a string", () => {
		const section = {
			assessmentItemRefs: [{ identifier: objectId, item: makeItem("i1") }],
		};

		expect(() => build(section)).toThrow(
			"Section assessmentItemRefs[0].identifier must be a string, got object",
		);
	});

	test("reads numeric ids as their decimal strings", () => {
		const passage = { ...makePassage("p1"), id: 7 };
		const section = {
			assessmentItemRefs: [
				{
					identifier: 42,
					item: { ...makeItem("i1", passage as never), id: 42 },
				},
			],
		};
		const content = build(section);

		expect(content.items.map((item) => item.id)).toEqual(["42"]);
		expect(content.passages.map((entry) => entry.id)).toEqual(["7"]);
		expect(content.adapterItemRefs[0]?.identifier).toBe("42");
	});

	test("falls back past a blank passage id to its identifier", () => {
		const passage = { ...makePassage("p1"), id: "  ", identifier: "p-ident" };
		const section = {
			assessmentItemRefs: [
				{ identifier: "i1", item: makeItem("i1", passage as never) },
			],
		};

		expect(build(section).passages.map((entry) => entry.id)).toEqual([
			"p-ident",
		]);
	});
});
