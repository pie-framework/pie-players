import { describe, expect, test } from "bun:test";
import { aggregateElements } from "../src/loaders/ElementLoader.js";

describe("aggregateElements", () => {
	test("normalizes element tags to versioned names", () => {
		const elements = aggregateElements([
			{
				config: {
					elements: {
						"pie-passage": "@pie-element/passage@3.2.4",
						"pie-multiple-choice": "@pie-element/multiple-choice@9.3.2",
					},
				},
			} as any,
		]);

		expect(elements).toEqual({
			"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
			"pie-multiple-choice--version-9-3-2":
				"@pie-element/multiple-choice@9.3.2",
		});
	});

	test("keeps existing versioned tags when they already match package version", () => {
		const elements = aggregateElements([
			{
				config: {
					elements: {
						"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
					},
				},
			} as any,
		]);

		expect(elements).toEqual({
			"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
		});
	});

	test("preserves existing conflict behavior for repeated original tags", () => {
		expect(() =>
			aggregateElements([
				{
					config: {
						elements: {
							"pie-passage": "@pie-element/passage@3.2.3",
						},
					},
				} as any,
				{
					config: {
						elements: {
							"pie-passage": "@pie-element/passage@3.2.4",
						},
					},
				} as any,
			]),
		).toThrow("Element version conflict: pie-passage requires both");
	});
});
