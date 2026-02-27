export type ComponentModuleLoader = () => Promise<unknown>;

export interface ComponentDefinition {
	tagName: string;
	ensureDefined?: ComponentModuleLoader;
	attributes?: Record<string, string>;
	props?: Record<string, unknown>;
}

export type PlayerDefinitionMap = Record<string, ComponentDefinition>;
export type LayoutDefinitionMap = Record<string, ComponentDefinition>;

export const DEFAULT_PLAYER_DEFINITIONS: PlayerDefinitionMap = {
	iife: {
		tagName: "pie-iife-player",
		ensureDefined: () => import("@pie-players/pie-iife-player"),
		attributes: {
			"bundle-host": "https://proxy.pie-api.com/bundles",
		},
	},
};

export const DEFAULT_LAYOUT_DEFINITIONS: LayoutDefinitionMap = {
	"split-panel": {
		tagName: "pie-split-panel-layout",
		ensureDefined: () =>
			import("./components/layout-elements/PieSplitPanelLayoutElement.svelte"),
	},
	vertical: {
		tagName: "pie-vertical-layout",
		ensureDefined: () =>
			import("./components/layout-elements/PieVerticalLayoutElement.svelte"),
	},
	"item-mode": {
		tagName: "pie-item-mode-layout",
		ensureDefined: () =>
			import("./components/layout-elements/PieItemModeLayoutElement.svelte"),
	},
};

export function mergeComponentDefinitions<T extends Record<string, ComponentDefinition>>(
	defaults: T,
	overrides: Partial<Record<string, ComponentDefinition>> = {},
): Record<string, ComponentDefinition> {
	const merged: Record<string, ComponentDefinition> = { ...defaults };

	for (const [key, overrideDefinition] of Object.entries(overrides)) {
		if (!overrideDefinition) continue;
		const defaultDefinition = merged[key];
		merged[key] = {
			...(defaultDefinition || { tagName: overrideDefinition.tagName }),
			...overrideDefinition,
			attributes: {
				...(defaultDefinition?.attributes || {}),
				...(overrideDefinition.attributes || {}),
			},
			props: {
				...(defaultDefinition?.props || {}),
				...(overrideDefinition.props || {}),
			},
		};
	}

	return merged;
}
