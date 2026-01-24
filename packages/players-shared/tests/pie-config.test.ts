import { describe, expect, test } from "bun:test";
import {
	addRubricIfNeeded,
	elementForPackage,
	makeUniqueTags,
} from "../src/pie/config";
import type { ConfigContainerEntity } from "../src/types";

describe("elementForPackage", () => {
	test("throws when multiple element tags map to the same package name", () => {
		const config = {
			markup: "<div />",
			elements: {
				"pie-mc-a": "@pie-element/multiple-choice@1.0.0",
				"pie-mc-b": "@pie-element/multiple-choice@2.0.0",
			},
			models: [],
		};

		expect(() =>
			elementForPackage(config as any, "@pie-element/multiple-choice"),
		).toThrow("invalid item format: multiple elements for package.");
	});
});

describe("makeUniqueTags", () => {
	test("versions element tags, updates markup, and updates model.element", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup: "<pie-mc id='m1'></pie-mc>",
				elements: {
					"pie-mc": "@pie-element/multiple-choice@1.2.3",
				},
				models: [{ id: "m1", element: "pie-mc" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual({
			"pie-mc--version-1-2-3": "@pie-element/multiple-choice@1.2.3",
		});
		expect(out.config.markup).toContain("<pie-mc--version-1-2-3");
		expect(out.config.markup).toContain("</pie-mc--version-1-2-3>");
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3");
	});

	test("keeps tag unchanged when it already has the correct version", () => {
		const container: ConfigContainerEntity = {
			id: "item-1",
			config: {
				markup: "<pie-mc--version-1-2-3 id='m1'></pie-mc--version-1-2-3>",
				elements: {
					"pie-mc--version-1-2-3": "@pie-element/multiple-choice@1.2.3",
				},
				models: [{ id: "m1", element: "pie-mc--version-1-2-3" }],
			},
		};

		const out = makeUniqueTags(container);
		expect(out.config.elements).toEqual(container.config.elements);
		expect(out.config.markup).toBe(container.config.markup);
		expect(out.config.models[0].element).toBe("pie-mc--version-1-2-3");
	});
});

describe("addRubricIfNeeded", () => {
	test("adds rubric element markup when missing", () => {
		const config = {
			markup: "<pie-mc id='m1'></pie-mc>",
			elements: {
				"pie-mc": "@pie-element/multiple-choice@1.0.0",
				"pie-rubric": "@pie-element/rubric@1.0.0",
			},
			models: [
				{ id: "m1", element: "pie-mc" },
				{ id: "r1", element: "pie-rubric" },
			],
		};

		const out = addRubricIfNeeded(config as any);
		expect(out.markup).toContain("<pie-rubric id='r1'></pie-rubric>");
	});
});
