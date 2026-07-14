import { describe, expect, test } from "bun:test";
import { transformMarkupForAuthoring } from "../src/pie/authoring-tag.js";

describe("transformMarkupForAuthoring", () => {
	test("treats dotted and prefix tag names as exact authored identities", () => {
		const markup = [
			'<pie-choice.v2 id="exact"></pie-choice.v2>',
			'<pie-choiceXv2 id="near"></pie-choiceXv2>',
			'<pie-choice.v2-extra id="prefix"></pie-choice.v2-extra>',
		].join("");

		expect(
			transformMarkupForAuthoring(markup, {
				"pie-choice.v2": "@pie-element/choice@1.0.0",
			}),
		).toBe(
			[
				'<pie-choice.v2-config id="exact"></pie-choice.v2-config>',
				'<pie-choiceXv2 id="near"></pie-choiceXv2>',
				'<pie-choice.v2-extra id="prefix"></pie-choice.v2-extra>',
			].join(""),
		);
	});
});
