import { describe, expect, test } from "bun:test";
import {
	createToolElement,
	resolveToolTag,
	type ToolbarContext,
	type ToolContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
import { createPackagedToolRegistry } from "../src/packaged-tool-registry";
import { PACKAGED_TOOL_TAG_MAP } from "../src/tool-tag-map";

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

describe("packaged tool tag map", () => {
	test("maps each packaged capability to its element tag", () => {
		const overrides = { toolTagMap: PACKAGED_TOOL_TAG_MAP };
		expect(resolveToolTag("calculator", overrides)).toBe("pie-tool-calculator");
		expect(resolveToolTag("textToSpeech", overrides)).toBe(
			"pie-tool-text-to-speech",
		);
		expect(resolveToolTag("annotationToolbar", overrides)).toBe(
			"pie-tool-annotation-toolbar",
		);
		// The removed `highlighter` capability mounted this same element behind a
		// second button; nothing maps that id any more.
		expect("highlighter" in PACKAGED_TOOL_TAG_MAP).toBe(false);
		expect(resolveToolTag("theme", overrides)).toBe("pie-tool-theme");
		expect("colorScheme" in PACKAGED_TOOL_TAG_MAP).toBe(false);
	});

	test("the toolkit carries no packaged tag map to fall back to", () => {
		// The catalogue lived in core, which is why a host could not add a
		// capability without editing that package. Asking for a packaged tag with no
		// map installed now names the missing mapping rather than rendering a bogus
		// element or reporting a hyphen rule the caller did not break.
		expect(() => resolveToolTag("calculator")).toThrow(
			/No element tag is mapped for tool "calculator"/,
		);
		// A host whose tool id already looks like a tag needs no mapping.
		expect(resolveToolTag("host-own-tool")).toBe("host-own-tool");
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
					toolTagMap: PACKAGED_TOOL_TAG_MAP,
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

describe("createPackagedToolRegistry component overrides", () => {
	test("selects the provider-specific packaged calculator tag", () => {
		const defaultRegistry = createPackagedToolRegistry();
		const geogebraRegistry = createPackagedToolRegistry({
			calculatorProviderConfig: {
				provider: { id: "calculator-geogebra" },
			},
		});
		const toolbarContext: ToolbarContext = {
			scope: { level: "item", scopeId: "item-1", itemId: "item-1" },
			itemId: "item-1",
			catalogId: "item-1",
			language: "en",
			i18n: resolveInterfaceI18n(null),
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderTag = (
			registry: ReturnType<typeof createPackagedToolRegistry>,
		) =>
			withFakeDocument(() =>
				registry
					.renderForToolbar("calculator", itemContext, toolbarContext)
					?.elements?.find((entry) => entry.mount === "after-buttons")
					?.element?.tagName.toLowerCase(),
			);

		expect(renderTag(defaultRegistry)).toBe("pie-tool-calculator");
		expect(renderTag(geogebraRegistry)).toBe("pie-tool-calculator-geogebra");
	});

	test("applies custom tool tag map during toolbar render", () => {
		const registry = createPackagedToolRegistry({
			toolTagMap: { calculator: "custom-calculator" },
		});

		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-1",
				itemId: "item-1",
			},
			itemId: "item-1",
			catalogId: "item-1",
			language: "en",
			i18n: resolveInterfaceI18n(null),
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			registry.renderForToolbar("calculator", itemContext, toolbarContext),
		);
		expect(
			renderResult?.elements
				?.find((entry) => entry.mount === "after-buttons")
				?.element?.tagName.toLowerCase(),
		).toBe("custom-calculator");
	});
});
