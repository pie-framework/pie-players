import { describe, expect, test } from "bun:test";
import { calculatorToolRegistration } from "../src/tools/registrations/calculator";
import type { ToolContext } from "../src/services/tool-context";
import type { ToolbarContext } from "../src/services/ToolRegistry";

const createFakeElement = (tag: string) =>
	({
		tagName: tag.toUpperCase(),
		attrs: new Map<string, string>(),
		setAttribute(name: string, value: string) {
			this.attrs.set(name, value);
		},
		removeAttribute(name: string) {
			this.attrs.delete(name);
		},
		getAttribute(name: string) {
			return this.attrs.get(name) || null;
		},
	}) as any;

const withFakeDocument = <T>(fn: () => T): T => {
	const previousDocument = (globalThis as { document?: Document }).document;
	(globalThis as { document?: Document }).document = {
		createElement: (tag: string) => createFakeElement(tag),
	} as unknown as Document;
	try {
		return fn();
	} finally {
		(globalThis as { document?: Document }).document = previousDocument;
	}
};

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

	test("renderToolbar consumes resolved calculator render params", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: { id: "i1" } as any,
			item: { id: "i1", config: {} } as any,
		};
		const toolbarContext = {
			scope: { level: "item", scopeId: "i1" },
			itemId: "i1",
			catalogId: "i1",
			language: "en-US",
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
			getToolRenderParams: () => ({
				calculatorType: "basic",
				availableTypes: ["basic"],
			}),
		} as ToolbarContext;

		const result = withFakeDocument(() =>
			calculatorToolRegistration.renderToolbar(context, toolbarContext),
		);
		const element = result.elements?.[0]?.element as
			| (HTMLElement & {
					calculatorType?: string;
					availableTypes?: string[];
			  })
			| undefined;

		expect(result.button?.label).toBe("Basic Calculator");
		expect(result.button?.ariaLabel).toBe("Open basic calculator");
		expect(element?.calculatorType).toBe("basic");
		expect(element?.availableTypes).toEqual(["basic"]);
		expect(element?.getAttribute("calculator-type")).toBe("basic");
	});
});
