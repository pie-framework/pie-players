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
				"annotationToolbar",
				"graph",
				"periodicTable",
				"dictionary",
				"pictureDictionary",
				// The Spanish variants place beside their base capabilities and are granted
				// separately, so an exhaustive host offers both and the PNP decides.
				"dictionarySpanish",
				"pictureDictionarySpanish",
			],
			passage: ["textToSpeech", "annotationToolbar", "lineReader"],
			rubric: ["textToSpeech", "annotationToolbar", "lineReader"],
			element: expect.arrayContaining([
				"calculator",
				"answerEliminator",
				"textToSpeech",
				"ruler",
				"protractor",
				"annotationToolbar",
				"graph",
				"periodicTable",
				"dictionary",
				"pictureDictionary",
				"dictionarySpanish",
				"pictureDictionarySpanish",
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
				"dictionarySpanish",
				"pictureDictionarySpanish",
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
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage).not.toContain(
			"ruler",
		);
		expect(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT.passage).not.toContain(
			"protractor",
		);
		// `highlighter` used to be excluded here by hand: it mounted the same element
		// as `annotationToolbar` behind a second identically-labelled button, so an
		// exhaustive host showed two. The capability is gone, so assert the stronger
		// thing — no placement list names it at all.
		const everyPlacedId = [
			...Object.values(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT).flat(),
			...Object.values(PACKAGED_TOOL_PLACEMENT).flat(),
		];
		expect(everyPlacedId).not.toContain("highlighter");
		expect(everyPlacedId).toContain("annotationToolbar");
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
