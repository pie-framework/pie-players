import { describe, expect, test } from "bun:test";
import {
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
} from "../src/services/tool-context";
import type { ToolContext } from "../src/services/tool-context";

describe("tool-context helpers", () => {
	test("detects math content in item markup", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Solve 3 + 5 = ?</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(true);
	});

	test("does not detect math content in plain text", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<div>Read the passage and answer.</div>",
				},
			} as any,
		};

		expect(hasMathContent(context)).toBe(false);
	});

	test("detects readable text threshold", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					markup: "<p>This sentence is long enough for reading tools.</p>",
				},
			} as any,
		};

		expect(hasReadableText(context)).toBe(true);
	});

	test("detects choice interactions from item models", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [{ element: "pie-multiple-choice" }],
				},
			} as any,
		};

		expect(hasChoiceInteraction(context)).toBe(true);
	});
});
