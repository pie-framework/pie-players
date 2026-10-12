import { describe, expect, test } from "bun:test";
import type { ToolbarContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { PACKAGED_TOOL_TAG_MAP } from "../src/packaged-capability-composition.js";
import { ttsToolRegistration } from "../src/registrations/tts.js";

const packagedOverrides = { toolTagMap: PACKAGED_TOOL_TAG_MAP };

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
		removeAttribute(name: string) {
			this.attrs.delete(name);
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

const itemContext: ToolContext = {
	level: "item",
	assessment: {} as any,
	itemRef: {} as any,
	item: {} as any,
};

describe("ttsToolRegistration speed options", () => {
	test("applies custom speedOptions from toolkit config in provided order", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-1",
				itemId: "item-1",
			},
			itemId: "item-1",
			catalogId: "item-1",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({
					speedOptions: [2, 1.25, 1.5, 2, 1],
				}),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const element = renderResult?.elements?.[0]?.element as {
			speedOptions?: unknown[];
		};
		expect(element?.speedOptions).toEqual([
			{ rate: 2, label: "2x", ariaLabel: "Speed 2x", isDefault: false },
			{
				rate: 1.25,
				label: "1.25x",
				ariaLabel: "Speed 1.25x",
				isDefault: false,
			},
			{ rate: 1.5, label: "1.5x", ariaLabel: "Speed 1.5x", isDefault: false },
			{ rate: 1, label: "Normal", ariaLabel: "Normal speed", isDefault: true },
		]);
	});

	test("applies labeled speedOptions to the inline element", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-labeled",
				itemId: "item-labeled",
			},
			itemId: "item-labeled",
			catalogId: "item-labeled",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({
					speedOptions: [
						{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
						{ rate: 1.5, label: "Fast" },
					],
				}),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const element = renderResult?.elements?.[0]?.element as {
			speedOptions?: unknown[];
		};
		expect(element?.speedOptions).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed", isDefault: false },
			{
				rate: 1,
				label: "Normal",
				ariaLabel: "Normal speed",
				isDefault: true,
			},
			{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("falls back to default speed options when config is invalid-only", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-1",
				itemId: "item-1",
			},
			itemId: "item-1",
			catalogId: "item-1",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({
					speedOptions: ["fast", null, -2],
				}),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const element = renderResult?.elements?.[0]?.element as {
			speedOptions?: unknown[];
		};
		expect(element?.speedOptions).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed", isDefault: false },
			{
				rate: 1,
				label: "Normal",
				ariaLabel: "Normal speed",
				isDefault: true,
			},
			{ rate: 1.25, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("uses explicit empty speedOptions to hide speed buttons", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-1",
				itemId: "item-1",
			},
			itemId: "item-1",
			catalogId: "item-1",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({ speedOptions: [] }),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const element = renderResult?.elements?.[0]?.element as {
			speedOptions?: unknown[];
		};
		expect(element?.speedOptions).toEqual([]);
	});

	test("keeps one element per coordinator and scope", () => {
		// A module-global cache keyed by the scoped tool id alone handed one
		// session's control to another player rendering the same item.
		const contextFor = (toolCoordinator: unknown): ToolbarContext =>
			({
				scope: { level: "item", scopeId: "item-shared", itemId: "item-shared" },
				itemId: "item-shared",
				catalogId: "item-shared",
				language: "en-US",
				toolCoordinator,
				componentOverrides: packagedOverrides,
				toolkitCoordinator: null,
				ttsService: null,
				elementToolStateStore: null,
				toggleTool: () => {},
				isToolVisible: () => false,
				subscribeVisibility: null,
			}) as ToolbarContext;
		const render = (toolbarContext: ToolbarContext) =>
			withFakeDocument(
				() =>
					ttsToolRegistration.renderToolbar(itemContext, toolbarContext)
						?.elements?.[0]?.element as unknown as { isConnected?: boolean },
			);
		const sessionA = contextFor({});
		const first = render(sessionA);
		first.isConnected = true;

		expect(render(sessionA)).toBe(first);
		expect(render(contextFor({}))).not.toBe(first);
	});

	test("creates its element through the registry's tag map", () => {
		const toolbarContext: ToolbarContext = {
			scope: { level: "item", scopeId: "item-tag", itemId: "item-tag" },
			itemId: "item-tag",
			catalogId: "item-tag",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: {
				toolTagMap: { textToSpeech: "host-read-aloud" },
			},
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};
		const element = withFakeDocument(
			() =>
				ttsToolRegistration.renderToolbar(itemContext, toolbarContext)
					?.elements?.[0]?.element,
		);
		expect(element?.tagName.toLowerCase()).toBe("host-read-aloud");
	});

	test("sync remains pure and does not initialize TTS", () => {
		let ensureCalls = 0;
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-sync-pure",
				itemId: "item-sync-pure",
			},
			itemId: "item-sync-pure",
			catalogId: "item-sync-pure",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({
					speedOptions: [1.5, 2],
				}),
				ensureTTSReady: async () => {
					ensureCalls += 1;
				},
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		expect(renderResult).not.toBeNull();
		renderResult?.sync?.();
		expect(ensureCalls).toBe(0);
	});

	test("passes one-option visibility opt-in to inline element", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-one-option",
				itemId: "item-one-option",
			},
			itemId: "item-one-option",
			catalogId: "item-one-option",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({
					speedOptions: [{ rate: 1, label: "Normal" }],
					showSingleSpeedOption: true,
				}),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const element = renderResult?.elements?.[0]?.element as {
			showSingleSpeedOption?: boolean;
		};
		expect(element?.showSingleSpeedOption).toBe(true);
	});

	test("uses left-aligned layout by default", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-layout-default",
				itemId: "item-layout-default",
			},
			itemId: "item-layout-default",
			catalogId: "item-layout-default",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({}),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const entry = renderResult?.elements?.[0];
		const element = entry?.element as {
			getAttribute: (name: string) => string | null;
		};
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(true);
		expect(element?.getAttribute("layout-mode")).toBe("left-aligned");
	});

	test("maps floating-overlay to before-buttons mount", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-layout-floating",
				itemId: "item-layout-floating",
			},
			itemId: "item-layout-floating",
			catalogId: "item-layout-floating",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({ layoutMode: "floating-overlay" }),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const entry = renderResult?.elements?.[0];
		const element = entry?.element as {
			getAttribute: (name: string) => string | null;
		};
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(false);
		expect(element?.getAttribute("layout-mode")).toBe("floating-overlay");
	});

	test("maps expanding-row to before-buttons with active controls-row expansion hint", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-layout-expanding",
				itemId: "item-layout-expanding",
			},
			itemId: "item-layout-expanding",
			catalogId: "item-layout-expanding",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({ layoutMode: "expanding-row" }),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const entry = renderResult?.elements?.[0];
		const element = entry?.element as {
			getAttribute: (name: string) => string | null;
		};
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(true);
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(false);
		expect(element?.getAttribute("layout-mode")).toBe("expanding-row");
	});

	test("maps left-aligned to before-buttons without controls-row reservation", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-layout-left",
				itemId: "item-layout-left",
			},
			itemId: "item-layout-left",
			catalogId: "item-layout-left",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({ layoutMode: "left-aligned" }),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const entry = renderResult?.elements?.[0];
		const element = entry?.element as {
			getAttribute: (name: string) => string | null;
		};
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(true);
		expect(element?.getAttribute("layout-mode")).toBe("left-aligned");
	});

	test("falls back to left-aligned when layout mode config is invalid", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-layout-invalid",
				itemId: "item-layout-invalid",
			},
			itemId: "item-layout-invalid",
			catalogId: "item-layout-invalid",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: {
				getToolConfig: () => ({ layoutMode: "bad-mode" }),
			} as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const entry = renderResult?.elements?.[0];
		const element = entry?.element as {
			getAttribute: (name: string) => string | null;
		};
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(true);
		expect(element?.getAttribute("layout-mode")).toBe("left-aligned");
	});
});

describe("ttsToolRegistration sanitizeConfig", () => {
	const sanitize = ttsToolRegistration.sanitizeConfig as (
		cfg: Record<string, unknown>,
	) => Record<string, unknown>;

	test("normalizes speedOptions", () => {
		const out = sanitize({
			enabled: true,
			speedOptions: [2, 1, "x", 1.5],
		});
		expect(out.speedOptions).toEqual([
			{ rate: 2, label: "2x", ariaLabel: "Speed 2x", isDefault: false },
			{ rate: 1, label: "Normal", ariaLabel: "Normal speed", isDefault: true },
			{ rate: 1.5, label: "1.5x", ariaLabel: "Speed 1.5x", isDefault: false },
		]);
	});

	test("preserves one-option visibility setting in sanitizeConfig", () => {
		const out = sanitize({ showSingleSpeedOption: true });
		expect(out.showSingleSpeedOption).toBe(true);
	});

	test("preserves explicit empty speedOptions", () => {
		const out = sanitize({ speedOptions: [] });
		expect(out.speedOptions).toEqual([]);
	});

	test("preserves labeled speedOptions in sanitizeConfig", () => {
		const out = sanitize({
			speedOptions: [
				{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
				{
					rate: 1,
					label: "Normal",
					ariaLabel: "Normal speed",
					default: true,
				},
				{ rate: 1.5, label: "Fast" },
				{ rate: 1.5, label: "Duplicate" },
			],
		});
		expect(out.speedOptions).toEqual([
			{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed", isDefault: false },
			{ rate: 1, label: "Normal", ariaLabel: "Normal speed", isDefault: true },
			{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed", isDefault: false },
		]);
	});

	test("leaves layoutMode to runtime resolution", () => {
		expect(sanitize({ layoutMode: "bad-mode" }).layoutMode).toBe("bad-mode");
	});
});

describe("ttsToolRegistration content language", () => {
	const renderWithLanguage = (language: string | undefined) => {
		const toolbarContext: ToolbarContext = {
			scope: { level: "item", scopeId: "item-lang", itemId: "item-lang" },
			itemId: "item-lang",
			catalogId: "item-lang",
			language,
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: { getToolConfig: () => ({}) } as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};
		const renderResult = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		return renderResult?.elements?.[0]?.element as {
			getAttribute(name: string): string | null;
		};
	};

	// A read takes the toolkit's `content-language`, as a selection read does.
	test("names no language on the control, whatever the toolbar names", () => {
		expect(renderWithLanguage("es-MX").getAttribute("language")).toBeNull();
		expect(renderWithLanguage(undefined).getAttribute("language")).toBeNull();
	});
});

describe("ttsToolRegistration element wiring", () => {
	const createEventTargetElement = (tag: string) =>
		Object.assign(new EventTarget(), createFakeElement(tag));

	const render = (overrides: Partial<ToolbarContext>) => {
		const toolbarContext: ToolbarContext = {
			scope: { level: "item", scopeId: "item-wiring", itemId: "item-wiring" },
			itemId: "item-wiring",
			catalogId: "item-wiring",
			language: "en-US",
			toolCoordinator: null,
			componentOverrides: packagedOverrides,
			toolkitCoordinator: { getToolConfig: () => ({}) } as any,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
			...overrides,
		};
		const previousDocument = (globalThis as { document?: Document }).document;
		(globalThis as { document?: Document }).document = {
			createElement: (tag: string) => createEventTargetElement(tag),
		} as unknown as Document;
		try {
			return ttsToolRegistration.renderToolbar(itemContext, toolbarContext);
		} finally {
			(globalThis as { document?: Document }).document = previousDocument;
		}
	};

	test("names the item as the catalog when the toolbar names no catalog", () => {
		const element = render({ itemId: "item-77", catalogId: undefined })
			?.elements?.[0]?.element as unknown as {
			getAttribute(name: string): string | null;
		};
		expect(element.getAttribute("catalog-id")).toBe("item-77");
	});

	test("prefers the toolbar's catalog over the item", () => {
		const element = render({ itemId: "item-77", catalogId: "catalog-9" })
			?.elements?.[0]?.element as unknown as {
			getAttribute(name: string): string | null;
		};
		expect(element.getAttribute("catalog-id")).toBe("catalog-9");
	});

	test("relays the element's active-change event until unsubscribed", () => {
		const result = render({});
		const element = result?.elements?.[0]?.element as unknown as EventTarget;
		const seen: boolean[] = [];
		const unsubscribe = result?.subscribeActive?.((active) => {
			seen.push(active);
		});
		const announce = (detail: unknown) =>
			element.dispatchEvent(
				new CustomEvent("pie-tool-active-change", { detail }),
			);

		announce({ active: true });
		announce({ active: false });
		announce({});
		expect(seen).toEqual([true, false, false]);

		unsubscribe?.();
		announce({ active: true });
		expect(seen).toEqual([true, false, false]);
	});

	test("renders an unknown layoutMode as left-aligned", () => {
		const result = render({
			toolkitCoordinator: {
				getToolConfig: () => ({ layoutMode: "bad-mode" }),
			} as any,
		});
		const entry = result?.elements?.[0];
		const element = entry?.element as unknown as {
			getAttribute(name: string): string | null;
		};
		expect(element.getAttribute("layout-mode")).toBe("left-aligned");
		expect(entry?.layoutHints?.headerOverlay?.showWhenToolActive).toBe(true);
	});
});
