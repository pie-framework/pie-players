import { describe, expect, test } from "bun:test";
import { applyElementOverrides } from "../src/pie/overrides";

describe("applyElementOverrides", () => {
	test("rewrites the cloned runtime config consistently with the canonical version tag", () => {
		const config = {
			markup:
				'<pie-choice.preview--version-1-0-0 id="choice-1"></pie-choice.preview--version-1-0-0><pie-choice.preview--version-1-0-0-extra id="other-1"></pie-choice.preview--version-1-0-0-extra>',
			elements: {
				"pie-choice.preview--version-1-0-0":
					"@pie-element/multiple-choice/browser@1.0.0",
				"pie-choice.preview--version-1-0-0-extra": "@pie-element/other@1.0.0",
			},
			models: [
				{
					id: "choice-1",
					element: "pie-choice.preview--version-1-0-0",
					prompt: "Choose one",
				},
				{
					id: "other-1",
					element: "pie-choice.preview--version-1-0-0-extra",
				},
			],
		};
		const authoredConfig = structuredClone(config);

		const result = applyElementOverrides(config, {
			"@pie-element/multiple-choice": "1.2.3-alpha.1+build.5",
		});

		expect(result).not.toBe(config);
		expect(config).toEqual(authoredConfig);
		expect(result.elements).toEqual({
			"pie-choice.preview--version-1-2-3-alpha-1-build-5":
				"@pie-element/multiple-choice/browser@1.2.3-alpha.1+build.5",
			"pie-choice.preview--version-1-0-0-extra": "@pie-element/other@1.0.0",
		});
		expect(result.markup).toBe(
			'<pie-choice.preview--version-1-2-3-alpha-1-build-5 id="choice-1"></pie-choice.preview--version-1-2-3-alpha-1-build-5><pie-choice.preview--version-1-0-0-extra id="other-1"></pie-choice.preview--version-1-0-0-extra>',
		);
		expect(result.models).toEqual([
			{
				id: "choice-1",
				element: "pie-choice.preview--version-1-2-3-alpha-1-build-5",
				prompt: "Choose one",
			},
			{
				id: "other-1",
				element: "pie-choice.preview--version-1-0-0-extra",
			},
		]);
	});
});
