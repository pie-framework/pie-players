/**
 * The answer eliminator appears where an element declares answer masking, with
 * a name-based fallback for elements that declare nothing, narrowed to the
 * elements its host config lists, and its policy parameter `strategy` reaches
 * the element the toolbar renders.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	ToolRegistry,
	type ToolContext,
	type ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

import { answerEliminatorToolRegistration } from "../src/index.js";
import { PACKAGED_TOOL_TAG_MAP } from "../src/packaged-capability-composition.js";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const createFakeElement = () => {
	const attrs = new Map<string, string>();
	return {
		style: {},
		setAttribute: (name: string, value: string) => attrs.set(name, value),
		getAttribute: (name: string) => attrs.get(name) ?? null,
	} as unknown as HTMLElement;
};

const context: ToolContext = {
	level: "item",
	assessment: {} as any,
	itemRef: { id: "i1" } as any,
	item: { id: "i1", config: { elements: {} } } as any,
};

const renderStrategy = (parameters: Record<string, unknown> | null) => {
	const toolbarContext = {
		scope: { level: "item", scopeId: "i1" },
		itemId: "i1",
		catalogId: "i1",
		i18n: resolveInterfaceI18n(null),
		toolCoordinator: null,
		toolkitCoordinator: null,
		getToolParameters: (toolId: string) =>
			toolId === "answerEliminator" ? parameters : null,
		toggleTool: () => {},
		isToolVisible: () => false,
		subscribeVisibility: null,
		componentOverrides: {
			toolTagMap: PACKAGED_TOOL_TAG_MAP,
			toolComponentFactories: { answerEliminator: () => createFakeElement() },
		},
	} as unknown as ToolbarContext;
	const element = answerEliminatorToolRegistration.renderToolbar?.(
		context,
		toolbarContext,
	)?.elements?.[0]?.element;
	return element?.getAttribute("strategy");
};

test("the answer eliminator takes its strategy from its policy parameters", () => {
	expect(renderStrategy({ strategy: "mask" })).toBe("mask");
	expect(renderStrategy({ strategy: "erase" })).toBe("strikethrough");
	expect(renderStrategy(null)).toBe("strikethrough");
});

function itemContext(config: Record<string, unknown>): ToolContext {
	return {
		level: "item",
		assessment: {} as any,
		itemRef: { id: "i1" } as any,
		item: { id: "i1", config } as any,
	};
}

/** Passes 2 and 3 as `<pie-item-toolbar>` asks them for an item and its elements. */
function toolbarShowsEliminator(
	config: Record<string, unknown>,
	toolConfig: Record<string, unknown> | null = null,
): boolean {
	const registry = new ToolRegistry();
	registry.register(answerEliminatorToolRegistration);
	const item = itemContext(config);
	const elementContexts = ((config.models as any[]) ?? [])
		.filter((model) => typeof model?.id === "string")
		.map((model) => ({ ...item, level: "element", elementId: model.id }) as ToolContext);
	return registry
		.filterDecidedToolIds(
			[{ toolId: "answerEliminator" }],
			"item",
			[item, ...elementContexts],
			undefined,
			(toolId) => (toolId === "answerEliminator" ? toolConfig : null),
		)
		.includes("answerEliminator");
}

function define(tag: string, pieSupports?: unknown): void {
	class Element extends HTMLElement {}
	if (pieSupports !== undefined) {
		Object.defineProperty(Element, "pieSupports", { value: pieSupports });
	}
	customElements.define(tag, Element);
}

describe("answer eliminator relevance", () => {
	test("an element built outside pie-players that declares answer masking gets it", () => {
		define("acme-choice-grid--version-3-0-0", ["answer-masking"]);

		expect(
			toolbarShowsEliminator({
				elements: { "acme-choice-grid": "@acme/choice-grid@3.0.0" },
				models: [{ id: "q1", element: "acme-choice-grid" }],
			}),
		).toBe(true);
	});

	test("an element that declares nothing else does not, whatever its model holds", () => {
		define("acme-sorter");
		define("acme-other-supports", ["text-to-speech"]);

		expect(
			toolbarShowsEliminator({
				models: [
					{ id: "q1", element: "acme-sorter", choices: [{ value: "a" }] },
					{ id: "q2", element: "acme-other-supports" },
				],
			}),
		).toBe(false);
	});

	test("a declaration decides, even for an element the fallback names", () => {
		define("pie-multiple-choice--version-99-0-0", []);

		expect(
			toolbarShowsEliminator({
				elements: { "pie-multiple-choice": "@pie-element/multiple-choice@99.0.0" },
				models: [{ id: "q1", element: "pie-multiple-choice" }],
			}),
		).toBe(false);
	});

	test("one declaring element among others is enough", () => {
		define("acme-mixed-choice", ["answer-masking"]);
		define("acme-mixed-passage");

		expect(
			toolbarShowsEliminator({
				models: [
					{ id: "q1", element: "acme-mixed-passage" },
					{ id: "q2", element: "acme-mixed-choice" },
				],
			}),
		).toBe(true);
	});

	test("an undefined element is decided again once it is defined", () => {
		const config = {
			elements: { "acme-late-choice": "@acme/late-choice@1.0.0" },
			models: [{ id: "q1", element: "acme-late-choice" }],
		};
		expect(toolbarShowsEliminator(config)).toBe(false);

		define("acme-late-choice--version-1-0-0", ["answer-masking"]);
		expect(toolbarShowsEliminator(config)).toBe(true);
	});

	describe("elements that declare nothing", () => {
		for (const element of [
			"multiple-choice",
			"pie-multiple-choice",
			"pie-element-multiple-choice",
			"multiple-choice--version-13-4-0",
			"pie-element-multiple-choice--version-13-4-0-next-18",
			"ebsr",
			"pie-ebsr",
		]) {
			test(`${element} keeps the eliminator`, () => {
				expect(toolbarShowsEliminator({ models: [{ id: "q1", element }] })).toBe(true);
			});
		}

		test("a custom tag bound to @pie-element/multiple-choice keeps it", () => {
			expect(
				toolbarShowsEliminator({
					elements: { "mc-1": "@pie-element/multiple-choice@13.4.0" },
					models: [{ id: "q1", element: "mc-1" }],
				}),
			).toBe(true);
		});

		for (const element of [
			"select-text",
			"inline-choice",
			"inline-dropdown",
			"placement-ordering",
			"categorize",
			"drag-in-the-blank",
		]) {
			test(`${element} does not get it`, () => {
				expect(
					toolbarShowsEliminator({
						models: [{ id: "q1", element, choices: [{ value: "a" }] }],
					}),
				).toBe(false);
			});
		}

		test("a model that names no element does not count, whatever its choices", () => {
			expect(
				toolbarShowsEliminator({
					models: [{ id: "q1", choices: [{ value: "a" }, { value: "b" }] }],
				}),
			).toBe(false);
		});
	});
});

describe("answer eliminator element allowlist", () => {
	beforeAll(() => {
		define("pie-element-select-text--version-3-0-0", ["answer-masking"]);
		define("pie-element-multiple-choice--version-13-0-0", ["answer-masking"]);
	});

	const selectText = {
		elements: { "pie-element-select-text": "@pie-element/select-text@3.0.0" },
		models: [{ id: "q1", element: "pie-element-select-text" }],
	};
	const mixed = {
		elements: {
			"pie-element-select-text": "@pie-element/select-text@3.0.0",
			"pie-element-multiple-choice": "@pie-element/multiple-choice@13.0.0",
		},
		models: [
			{ id: "q1", element: "pie-element-select-text" },
			{ id: "q2", element: "pie-element-multiple-choice" },
		],
	};
	const onlyMultipleChoice = { elements: ["multiple-choice"] };

	test("an element the list leaves out does not get the eliminator", () => {
		expect(toolbarShowsEliminator(selectText)).toBe(true);
		expect(toolbarShowsEliminator(selectText, onlyMultipleChoice)).toBe(false);
	});

	test("a listed element keeps it, beside one left out", () => {
		expect(toolbarShowsEliminator(mixed, onlyMultipleChoice)).toBe(true);
	});

	test("a listed element that declares nothing keeps it", () => {
		expect(
			toolbarShowsEliminator(
				{ models: [{ id: "q1", element: "multiple-choice" }] },
				onlyMultipleChoice,
			),
		).toBe(true);
	});

	test("listing does not give it to an element without answer masking", () => {
		define("pie-element-categorize--version-1-0-0");
		expect(
			toolbarShowsEliminator(
				{ models: [{ id: "q1", element: "pie-element-categorize--version-1-0-0" }] },
				{ elements: ["categorize"] },
			),
		).toBe(false);
	});

	test("a tag bound to another package does not match by its own name", () => {
		define("multiple-choice--version-2-0-0", ["answer-masking"]);
		expect(
			toolbarShowsEliminator(
				{
					elements: { "multiple-choice": "@acme/multiple-choice@2.0.0" },
					models: [{ id: "q1", element: "multiple-choice" }],
				},
				onlyMultipleChoice,
			),
		).toBe(false);
	});

	test("an empty list, or one that is not a list, allows none", () => {
		expect(toolbarShowsEliminator(mixed, { elements: [] })).toBe(false);
		expect(toolbarShowsEliminator(mixed, { elements: "multiple-choice" })).toBe(false);
	});

	test("the overlay takes the listed elements' model ids", () => {
		const elementIds = (toolConfig: Record<string, unknown> | null) => {
			const overlay = createFakeElement() as HTMLElement & {
				elementIds?: readonly string[];
			};
			const toolbarContext = {
				scope: { level: "item", scopeId: "i1" },
				itemId: "i1",
				catalogId: "i1",
				i18n: resolveInterfaceI18n(null),
				toolCoordinator: null,
				toolkitCoordinator: {
					getToolConfig: (toolId: string) =>
						toolId === "answerEliminator" ? toolConfig : null,
				},
				getToolParameters: () => null,
				toggleTool: () => {},
				isToolVisible: () => false,
				subscribeVisibility: null,
				componentOverrides: {
					toolTagMap: PACKAGED_TOOL_TAG_MAP,
					toolComponentFactories: { answerEliminator: () => overlay },
				},
			} as unknown as ToolbarContext;
			answerEliminatorToolRegistration
				.renderToolbar?.(itemContext(mixed), toolbarContext)
				?.sync?.();
			return overlay.elementIds;
		};

		expect(elementIds(onlyMultipleChoice)).toEqual(["q2"]);
		expect(elementIds(null)).toBeUndefined();
	});

	test("config validation rejects an elements value that is not a list of names", () => {
		const validate = answerEliminatorToolRegistration.validateConfig!;
		expect(validate({})).toEqual([]);
		expect(validate(onlyMultipleChoice)).toEqual([]);
		for (const elements of ["multiple-choice", [""], [3]]) {
			expect(validate({ elements })).toEqual([
				expect.objectContaining({
					code: "tools.invalidProviderConfig",
					severity: "error",
					path: "providers.answerEliminator.elements",
				}),
			]);
		}
	});
});
