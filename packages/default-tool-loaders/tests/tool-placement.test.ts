import { describe, expect, test } from "bun:test";
import { createToolsConfig } from "@pie-players/pie-assessment-toolkit";
import { createPackagedToolRegistry } from "../src/packaged-tool-registry";
import {
	PACKAGED_TOOL_PLACEMENT,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "../src/tool-placement";

describe("packaged tool placement", () => {
	test("keeps packaged placement unchanged for exhaustive hosts", () => {
		expect(PACKAGED_TOOL_PLACEMENT).toMatchObject({
			assessment: ["theme"],
			section: ["theme"],
			item: [
				"textToSpeech",
				"highlighter",
				"annotationToolbar",
				"graph",
				"periodicTable",
				"dictionary",
				"pictureDictionary",
			],
			passage: [
				"textToSpeech",
				"highlighter",
				"annotationToolbar",
				"lineReader",
			],
			rubric: [
				"textToSpeech",
				"highlighter",
				"annotationToolbar",
				"lineReader",
			],
			element: expect.arrayContaining([
				"calculator",
				"answerEliminator",
				"textToSpeech",
				"ruler",
				"protractor",
				"highlighter",
				"annotationToolbar",
				"graph",
				"periodicTable",
				"dictionary",
				"pictureDictionary",
			]),
		});
	});

	test("offers a section-player preferred placement without duplicate tool surfaces", () => {
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT).toEqual({
			section: [
				"theme",
				"graph",
				"periodicTable",
				"lineReader",
				"ruler",
				"protractor",
				"dictionary",
				"pictureDictionary",
			],
			item: [
				"calculator",
				"textToSpeech",
				"answerEliminator",
				"annotationToolbar",
			],
			passage: ["textToSpeech", "annotationToolbar"],
		});

		for (const toolIds of Object.values(
			SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
		)) {
			expect(new Set(toolIds).size).toBe(toolIds.length);
		}
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.item).not.toContain("ruler");
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.item).not.toContain(
			"protractor",
		);
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.item).not.toContain(
			"highlighter",
		);
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage).not.toContain(
			"ruler",
		);
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage).not.toContain(
			"protractor",
		);
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage).not.toContain(
			"highlighter",
		);
	});

	test("validates the preferred placement with packaged tools", () => {
		const result = createToolsConfig({
			source: "tool-placement.test",
			strictness: "error",
			toolRegistry: createPackagedToolRegistry(),
			tools: {
				placement: SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
			},
		});

		expect(result.config.placement).toEqual(
			SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
		);
		expect(result.diagnostics).toEqual([]);
	});
});
