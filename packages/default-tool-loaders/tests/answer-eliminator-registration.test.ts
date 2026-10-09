/**
 * `tools.providers.answerEliminator.strategy` reaches the element the toolbar
 * renders. Without a config the element keeps its own strikethrough default.
 */

import { expect, test } from "bun:test";
import type {
	ToolContext,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

import { answerEliminatorToolRegistration } from "../src/index.js";
import { PACKAGED_TOOL_TAG_MAP } from "../src/packaged-capability-composition.js";

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

const renderStrategy = (toolConfig: Record<string, unknown> | null) => {
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
		toggleTool: () => {},
		isToolVisible: () => false,
		subscribeVisibility: null,
		componentOverrides: {
			toolTagMap: PACKAGED_TOOL_TAG_MAP,
			toolComponentFactory: () => createFakeElement(),
		},
	} as unknown as ToolbarContext;
	const element = answerEliminatorToolRegistration.renderToolbar?.(
		context,
		toolbarContext,
	)?.elements?.[0]?.element;
	return element?.getAttribute("strategy");
};

test("the answer eliminator takes its strategy from the tool config", () => {
	expect(renderStrategy({ strategy: "mask" })).toBe("mask");
});
