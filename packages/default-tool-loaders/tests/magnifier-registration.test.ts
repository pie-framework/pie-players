/**
 * The magnifier takes its starting zoom from its policy parameters, and passes
 * nothing on when the parameter is not a magnification.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type {
	ToolContext,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

import { magnificationToolRegistration } from "../src/index.js";
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

const context: ToolContext = {
	level: "section",
	assessment: {} as any,
};

const renderZoom = (parameters: Record<string, unknown> | null) => {
	const toolbarContext = {
		scope: { level: "section", scopeId: "s1" },
		i18n: resolveInterfaceI18n(null),
		toolCoordinator: null,
		toolkitCoordinator: null,
		getToolParameters: (toolId: string) =>
			toolId === "magnification" ? parameters : null,
		toggleTool: () => {},
		isToolVisible: () => false,
		subscribeVisibility: null,
		componentOverrides: {
			toolTagMap: PACKAGED_TOOL_TAG_MAP,
			toolComponentFactories: {
				magnification: () => document.createElement("div"),
			},
		},
	} as unknown as ToolbarContext;
	const element = magnificationToolRegistration.renderToolbar?.(
		context,
		toolbarContext,
	)?.elements?.[0]?.element;
	return element?.getAttribute("zoom");
};

test("the magnifier takes its starting zoom from its policy parameters", () => {
	expect(renderZoom({ zoom: 3 })).toBe("3");
	expect(renderZoom({ zoom: 1 })).toBeNull();
	expect(renderZoom({ zoom: "4" })).toBeNull();
	expect(renderZoom(null)).toBeNull();
});
