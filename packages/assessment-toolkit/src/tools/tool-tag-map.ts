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
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
}

/**
 * Resolve the element tag for a tool from the overrides in play. Core holds no
 * tag map; the packaged one is `PACKAGED_TOOL_TAG_MAP` in
 * `@pie-players/pie-default-tool-loaders`, installed through
 * `ToolRegistry.setComponentOverrides`.
 *
 * An unmapped toolId is its own tag when it contains a hyphen. Otherwise this
 * throws an error naming the missing mapping.
 */
export const resolveToolTag = (
	toolId: string,
	overrides?: ToolComponentOverrides,
): string => {
	const mapped = overrides?.toolTagMap?.[toolId];
	if (mapped === undefined && !toolId.includes("-")) {
		throw new Error(
			`No element tag is mapped for tool "${toolId}". Install a tag map on the registry via setComponentOverrides({ toolTagMap }) — for the packaged capabilities, PACKAGED_TOOL_TAG_MAP from "@pie-players/pie-default-tool-loaders".`,
		);
	}
	return validateCustomElementTag(
		mapped ?? toolId,
		`tool component tag for "${toolId}"`,
	);
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
	const factory = overrides?.toolComponentFactories?.[toolId];
	return factory
		? factory({ toolId, tagName, context, toolbarContext })
		: createDefaultToolElement(tagName);
};
