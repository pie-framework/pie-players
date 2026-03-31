import { describe, expect, test } from "bun:test";
import type { ToolbarContext } from "../src/services/ToolRegistry";
import type { ToolContext } from "../src/services/tool-context";
import {
	TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP,
	ttsToolRegistration,
} from "../src/tools/registrations/tts";

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
			toolkitCoordinator: {
				getToolConfig: () => ({
					settings: { speedOptions: [2, 1.25, 1.5, 2, 1] },
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
			speedOptions?: number[];
		};
		expect(element?.speedOptions).toEqual([2, 1.25, 1.5]);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { speedOptions: ["fast", null, -2, 1] } }),
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
			speedOptions?: number[];
		};
		expect(element?.speedOptions).toEqual([0.8, 1.25]);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { speedOptions: [] } }),
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
			speedOptions?: number[];
		};
		expect(element?.speedOptions).toEqual([]);
	});

	test("evicts cached inline element on unmount callback", () => {
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
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const firstRender = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const firstElement = firstRender?.elements?.[0]?.element as {
			[key: string]: unknown;
		};
		expect(typeof firstElement?.[TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP]).toBe("function");
		(firstElement?.[TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP] as () => void)();

		const secondRender = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const secondElement = secondRender?.elements?.[0]?.element;
		expect(secondElement).not.toBe(firstElement as any);
	});

	test("recreates stale disconnected cached element", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-disconnected",
				itemId: "item-disconnected",
			},
			itemId: "item-disconnected",
			catalogId: "item-disconnected",
			language: "en-US",
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		const firstRender = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const firstElement = firstRender?.elements?.[0]?.element as {
			isConnected?: boolean;
		};
		firstElement.isConnected = false;

		const secondRender = withFakeDocument(() =>
			ttsToolRegistration.renderToolbar(itemContext, toolbarContext),
		);
		const secondElement = secondRender?.elements?.[0]?.element;
		expect(secondElement).not.toBe(firstElement as any);
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
			toolkitCoordinator: {
				getToolConfig: () => ({
					settings: { speedOptions: [1.5, 2] },
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: {} }),
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
		const element = entry?.element as { getAttribute: (name: string) => string | null };
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { layoutMode: "floating-overlay" } }),
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
		const element = entry?.element as { getAttribute: (name: string) => string | null };
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { layoutMode: "expanding-row" } }),
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
		const element = entry?.element as { getAttribute: (name: string) => string | null };
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(true);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { layoutMode: "left-aligned" } }),
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
		const element = entry?.element as { getAttribute: (name: string) => string | null };
		expect(entry?.mount).toBe("before-buttons");
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
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
			toolkitCoordinator: {
				getToolConfig: () => ({ settings: { layoutMode: "bad-mode" } }),
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
		const element = entry?.element as { getAttribute: (name: string) => string | null };
		expect(entry?.layoutHints?.controlsRow?.reserveSpace).toBe(false);
		expect(entry?.layoutHints?.controlsRow?.showWhenToolActive).toBe(false);
		expect(element?.getAttribute("layout-mode")).toBe("left-aligned");
	});

});

describe("ttsToolRegistration sanitizeConfig", () => {
	test("normalizes speedOptions in settings and top-level", () => {
		const sanitize = ttsToolRegistration.provider?.sanitizeConfig as (
			cfg: Record<string, unknown>,
		) => Record<string, unknown>;
		const out = sanitize({
			enabled: true,
			speedOptions: [2, 1, "x", 1.5],
			settings: { speedOptions: [0.8, 1, 1.25] },
		});
		expect(out.speedOptions).toEqual([2, 1.5]);
		expect((out.settings as { speedOptions: number[] }).speedOptions).toEqual([0.8, 1.25]);
	});

	test("preserves explicit empty speedOptions in settings", () => {
		const sanitize = ttsToolRegistration.provider?.sanitizeConfig as (
			cfg: Record<string, unknown>,
		) => Record<string, unknown>;
		const out = sanitize({
			settings: { speedOptions: [] },
		});
		expect((out.settings as { speedOptions: number[] }).speedOptions).toEqual([]);
	});
});
