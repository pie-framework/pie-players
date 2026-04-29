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

	test("does not double-append already-versioned latest tags", () => {
		const elements = aggregateElements([
			{
				config: {
					elements: {
						"pie-multiple-choice--version-latest":
							"@pie-element/multiple-choice@latest",
					},
				},
			} as any,
		]);

		expect(elements).toEqual({
			"pie-multiple-choice--version-latest":
				"@pie-element/multiple-choice@latest",
		});
	});

	test("keeps prerelease-encoded tags stable when version already matches", () => {
		const elements = aggregateElements([
			{
				config: {
					elements: {
						"pie-inline-choice--version-1-2-3-beta-1":
							"@pie-element/inline-choice@1.2.3-beta.1",
					},
				},
			} as any,
		]);

		expect(elements).toEqual({
			"pie-inline-choice--version-1-2-3-beta-1":
				"@pie-element/inline-choice@1.2.3-beta.1",
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
