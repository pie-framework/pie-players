import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";
import type { ToolContext } from "../services/tool-context.js";
import type { ToolbarContext } from "../services/ToolRegistry.js";

export type ToolTagMap = Record<string, string>;

export type ToolComponentFactory = (args: {
	toolId: string;
	tagName: string;
	context: ToolContext;
	toolbarContext: ToolbarContext;
}) => HTMLElement;

export type ToolComponentFactoryMap = Record<string, ToolComponentFactory>;

export interface ToolComponentOverrides {
	toolTagMap?: Partial<ToolTagMap>;
	toolComponentFactory?: ToolComponentFactory;
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
}

/**
 * Canonical default web component tag mapping for toolkit tools.
 * Integrators can override any entry via ToolComponentOverrides.
 */
export const DEFAULT_TOOL_TAG_MAP: ToolTagMap = {
	calculator: "pie-tool-calculator",
	textToSpeech: "pie-tool-text-to-speech",
	ruler: "pie-tool-ruler",
	protractor: "pie-tool-protractor",
	answerEliminator: "pie-tool-answer-eliminator",
	highlighter: "pie-tool-annotation-toolbar",
	lineReader: "pie-tool-line-reader",
	colorScheme: "pie-tool-color-scheme",
	annotationToolbar: "pie-tool-annotation-toolbar",
	graph: "pie-tool-graph",
	periodicTable: "pie-tool-periodic-table",
};

export const resolveToolTag = (
	toolId: string,
	overrides?: ToolComponentOverrides,
): string => {
	const mapped =
		overrides?.toolTagMap?.[toolId] ?? DEFAULT_TOOL_TAG_MAP[toolId] ?? toolId;
	return validateCustomElementTag(mapped, `tool component tag for "${toolId}"`);
};

const createDefaultToolElement = (tagName: string): HTMLElement =>
	document.createElement(tagName);

export const createToolElement = (
	toolId: string,
	context: ToolContext,
	toolbarContext: ToolbarContext,
	overrides?: ToolComponentOverrides,
): HTMLElement => {
	const tagName = resolveToolTag(toolId, overrides);
	const factoryForTool = overrides?.toolComponentFactories?.[toolId];
	const factory = factoryForTool ?? overrides?.toolComponentFactory;
	return factory
		? factory({ toolId, tagName, context, toolbarContext })
		: createDefaultToolElement(tagName);
};

export const toToolIdFromTag = (
	tagName: string,
	overrides?: ToolComponentOverrides,
): string | undefined => {
	const validTag = validateCustomElementTag(tagName, "tool component tag");
	const map = { ...DEFAULT_TOOL_TAG_MAP, ...overrides?.toolTagMap };
	return Object.entries(map).find(([, tag]) => tag === validTag)?.[0];
};
