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
	test("applies custom speedOptions from toolkit config", () => {
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
					settings: { speedOptions: [1.25, 1.5, 2, 2, 1] },
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
		expect(element?.speedOptions).toEqual([1.25, 1.5, 2]);
	});

	test("falls back to default speed options when config missing or invalid", () => {
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
				getToolConfig: () => ({ settings: { speedOptions: ["fast", null, -2] } }),
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
		expect(element?.speedOptions).toEqual([1.5, 2]);
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
});
