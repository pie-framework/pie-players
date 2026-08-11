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
 * Resolve the element tag for a tool from the overrides in play.
 *
 * There is no built-in map to fall back to. One lived here, naming eleven
 * capabilities, and a core module holding that catalogue is why a host could not
 * add a twelfth without editing this package — the map was overridable, but the
 * default was core-resident. The packaged map is `PACKAGED_TOOL_TAG_MAP` in
 * `@pie-players/pie-default-tool-loaders`, installed onto a registry through
 * `ToolRegistry.setComponentOverrides`.
 *
 * An unmapped toolId falls through to itself, which is only a valid tag if the
 * host's tool id already looks like one. Every packaged id is a single camelCase
 * word, so in practice an unmapped packaged tool throws here rather than
 * rendering a bogus element — the failure names the missing mapping, because
 * "custom element names must include a hyphen" is a true statement about the
 * wrong thing.
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
	const map = overrides?.toolTagMap ?? {};
	return Object.entries(map).find(([, tag]) => tag === validTag)?.[0];
};
