import { describe, expect, test } from "bun:test";
import { createDefaultToolRegistry } from "../src/services/createDefaultToolRegistry";
import type { ToolContext } from "../src/services/tool-context";
import type { ToolbarContext } from "../src/services/ToolRegistry";
import {
	createToolElement,
	DEFAULT_TOOL_TAG_MAP,
	resolveToolTag,
} from "../src/tools/tool-tag-map";

const createFakeElement = (tag: string) =>
	({
		tagName: tag.toUpperCase(),
		attrs: new Map<string, string>(),
		setAttribute(name: string, value: string) {
			this.attrs.set(name, value);
		},
		getAttribute(name: string) {
			return this.attrs.get(name) || null;
		},
	}) as any;

const withFakeDocument = <T>(fn: () => T): T => {
	const previousDocument = (globalThis as any).document;
	(globalThis as any).document = {
		createElement: (tag: string) => createFakeElement(tag),
	};
	try {
		return fn();
	} finally {
		(globalThis as any).document = previousDocument;
	}
};

const itemContext: ToolContext = {
	level: "item",
	assessment: {} as any,
	itemRef: {} as any,
	item: {} as any,
};

describe("tool-tag-map", () => {
	test("resolves canonical tags for default tools", () => {
		expect(resolveToolTag("calculator")).toBe("pie-tool-calculator");
		expect(resolveToolTag("textToSpeech")).toBe("pie-tool-text-to-speech");
		expect(resolveToolTag("highlighter")).toBe("pie-tool-annotation-toolbar");
	});

	test("allows per-tool tag override", () => {
		const tag = resolveToolTag("calculator", {
			toolTagMap: { calculator: "custom-calculator" },
		});
		expect(tag).toBe("custom-calculator");
	});

	test("createToolElement uses custom factory when provided", () => {
		const el = withFakeDocument(() =>
			createToolElement(
				"calculator",
				itemContext,
				{},
				{
					toolComponentFactory: ({ tagName }) => {
						const out = document.createElement(tagName) as any;
						out.setAttribute("data-factory", "yes");
						return out;
					},
				},
			),
		);
		expect(el.getAttribute("data-factory")).toBe("yes");
	});
});

describe("createDefaultToolRegistry component overrides", () => {
	test("applies custom tool tag map during toolbar render", () => {
		const registry = createDefaultToolRegistry({
			toolTagMap: {
				...DEFAULT_TOOL_TAG_MAP,
				calculator: "custom-calculator",
			},
		});

		const toolbarContext: ToolbarContext = {
			itemId: "item-1",
			catalogId: "item-1",
			language: "en",
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
			ensureTTSReady: null,
		};

		const renderResult = withFakeDocument(() =>
			registry.renderForToolbar("calculator", itemContext, toolbarContext),
		);
		expect(renderResult?.overlayElement?.tagName.toLowerCase()).toBe(
			"custom-calculator",
		);
	});
});
