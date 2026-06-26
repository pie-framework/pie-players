import { describe, expect, test } from "bun:test";
import { createPackagedToolRegistry } from "../src/services/createDefaultToolRegistry";
import { createToolsConfig } from "../src/services/create-tools-config";
import {
	DEFAULT_TOOL_PLACEMENT,
	PACKAGED_TOOL_PLACEMENT,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "../src/services/tool-config-defaults";
import { normalizeToolsConfig } from "../src/services/tools-config-normalizer";

describe("tool config defaults", () => {
	test("keeps toolkit defaults opt-in", () => {
		expect(DEFAULT_TOOL_PLACEMENT).toEqual({
			assessment: [],
			section: [],
			item: [],
			passage: [],
			rubric: [],
			element: [],
		});
		expect(normalizeToolsConfig(undefined).placement).toEqual({
			section: [],
			item: [],
			passage: [],
		});
	});

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
			source: "tool-config-defaults.test",
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
