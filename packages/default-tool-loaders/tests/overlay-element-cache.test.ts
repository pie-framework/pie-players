/**
 * An overlay keeps its element across toolbar renders.
 *
 * The toolbar re-renders on every policy emit and locale change, and mounts whatever
 * element a render returns. A fresh element per render is a remount, which resets the
 * ruler's position or the graph's points while the tool is open.
 */

import { describe, expect, test } from "bun:test";
import type {
	ToolContext,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

import { PACKAGED_TOOL_TAG_MAP } from "../src/packaged-capability-composition.js";
import {
	answerEliminatorToolRegistration,
	graphToolRegistration,
	protractorToolRegistration,
	rulerToolRegistration,
	ttsToolRegistration,
} from "../src/index.js";

type FakeElement = HTMLElement & {
	attrs: Map<string, string>;
	isConnected: boolean;
};

const createFakeElement = (tag: string) =>
	({
		tagName: tag.toUpperCase(),
		isConnected: false,
		attrs: new Map<string, string>(),
		style: {},
		setAttribute(name: string, value: string) {
			this.attrs.set(name, value);
		},
		removeAttribute(name: string) {
			this.attrs.delete(name);
		},
		getAttribute(name: string) {
			return this.attrs.get(name) ?? null;
		},
	}) as unknown as FakeElement;

const withFakeDocument = <T>(fn: () => T): T => {
	const previous = (globalThis as { document?: Document }).document;
	(globalThis as { document?: Document }).document = {
		createElement: (tag: string) => createFakeElement(tag),
	} as unknown as Document;
	try {
		return fn();
	} finally {
		(globalThis as { document?: Document }).document = previous;
	}
};

const context: ToolContext = {
	level: "section",
	assessment: {} as any,
	itemRef: { id: "i1" } as any,
	item: { id: "i1", config: { elements: {} } } as any,
};

const createToolbarContext = (
	toolCoordinator: unknown,
	scopeId = "s1",
): ToolbarContext =>
	({
		scope: { level: "section", scopeId },
		itemId: "i1",
		catalogId: "i1",
		language: "en-US",
		i18n: resolveInterfaceI18n(null),
		toolCoordinator,
		toolkitCoordinator: null,
		ttsService: null,
		elementToolStateStore: null,
		toggleTool: () => {},
		isToolVisible: () => true,
		subscribeVisibility: null,
		getToolRenderParams: () => ({}),
		componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
	}) as ToolbarContext;

const render = (
	registration: typeof rulerToolRegistration,
	toolbarContext: ToolbarContext,
) =>
	withFakeDocument(
		() =>
			registration.renderToolbar?.(context, toolbarContext)?.elements?.[0]
				?.element as FakeElement,
	);

const overlays = [
	rulerToolRegistration,
	protractorToolRegistration,
	graphToolRegistration,
	answerEliminatorToolRegistration,
	ttsToolRegistration,
];

describe("an overlay's element across renders", () => {
	for (const registration of overlays) {
		test(`${registration.toolId} reuses its mounted element`, () => {
			const toolbarContext = createToolbarContext({});
			const first = render(registration, toolbarContext);
			first.isConnected = true;
			expect(render(registration, toolbarContext)).toBe(first);
		});
	}

	test("re-applies the per-render attributes to the reused element", () => {
		const toolbarContext = createToolbarContext({});
		const first = render(rulerToolRegistration, toolbarContext);
		first.isConnected = true;
		first.removeAttribute("tool-id");
		const second = render(rulerToolRegistration, toolbarContext);
		expect(second).toBe(first);
		expect(second.getAttribute("tool-id")).toBe(first.attrs.get("tool-id"));
		expect(second.getAttribute("tool-id")).toContain("ruler");
	});

	test("is recreated once the cached one has left the document", () => {
		const toolbarContext = createToolbarContext({});
		const first = render(rulerToolRegistration, toolbarContext);
		expect(render(rulerToolRegistration, toolbarContext)).not.toBe(first);
	});

	test("is dropped after the toolbar unmounts it", async () => {
		const toolbarContext = createToolbarContext({});
		const first = render(rulerToolRegistration, toolbarContext);
		first.isConnected = true;
		const unmount = (first as unknown as Record<string, unknown>)
			.__pieToolElementUnmount as () => void;
		unmount();
		first.isConnected = false;
		await Promise.resolve();
		first.isConnected = true;
		expect(render(rulerToolRegistration, toolbarContext)).not.toBe(first);
	});

	test("survives an unmount when it is remounted in the same turn", async () => {
		const toolbarContext = createToolbarContext({});
		const first = render(rulerToolRegistration, toolbarContext);
		first.isConnected = true;
		(
			(first as unknown as Record<string, unknown>)
				.__pieToolElementUnmount as () => void
		)();
		await Promise.resolve();
		expect(render(rulerToolRegistration, toolbarContext)).toBe(first);
	});

	test("is separate per coordinator and per scope", () => {
		const coordinator = {};
		const first = render(
			rulerToolRegistration,
			createToolbarContext(coordinator),
		);
		first.isConnected = true;
		expect(render(rulerToolRegistration, createToolbarContext({}))).not.toBe(
			first,
		);
		expect(
			render(rulerToolRegistration, createToolbarContext(coordinator, "s2")),
		).not.toBe(first);
	});

	test("is created per render without a coordinator to key by", () => {
		const toolbarContext = createToolbarContext(null);
		const first = render(rulerToolRegistration, toolbarContext);
		first.isConnected = true;
		expect(render(rulerToolRegistration, toolbarContext)).not.toBe(first);
	});
});
