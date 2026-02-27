import { describe, expect, test } from "bun:test";
import { calculatorToolRegistration } from "../src/tools/registrations/calculator";
import type { ToolContext } from "../src/services/tool-context";

describe("calculator tool registration", () => {
	test("supports only item level", () => {
		expect(calculatorToolRegistration.supportedLevels).toEqual(["item"]);
	});

	test("is visible for element context with math content", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					elements: {
						"el-1": "<div>Compute 7 * 8</div>",
					},
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(true);
	});

	test("is visible when math is in model prompt", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [
						{
							id: "el-1",
							element: "multiple-choice",
							prompt: "<div>Solve 12 / 3</div>",
						},
					],
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(true);
	});

	test("is not visible for element context without math content", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					elements: {
						"el-1": "<div>Explain the passage in your own words.</div>",
					},
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(false);
	});
});
