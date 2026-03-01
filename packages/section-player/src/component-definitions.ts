export type ComponentModuleLoader = () => Promise<unknown>;

export interface ComponentDefinition {
	tagName: string;
	ensureDefined?: ComponentModuleLoader;
	attributes?: Record<string, string>;
	props?: Record<string, unknown>;
}

export type PlayerDefinitionMap = Record<string, ComponentDefinition>;

export const DEFAULT_PLAYER_DEFINITIONS: PlayerDefinitionMap = {
	iife: {
		tagName: "pie-item-player",
		ensureDefined: () => import("@pie-players/pie-item-player"),
		attributes: {
			strategy: "iife",
		},
		props: {
			loaderOptions: {
				bundleHost: "https://proxy.pie-api.com/bundles",
			},
		},
	},
	esm: {
		tagName: "pie-item-player",
		ensureDefined: () => import("@pie-players/pie-item-player"),
		attributes: {
			strategy: "esm",
		},
		props: {
			loaderOptions: {
				esmCdnUrl: "https://esm.sh",
			},
		},
	},
	fixed: {
		tagName: "pie-item-player",
		ensureDefined: () => import("@pie-players/pie-item-player"),
		attributes: {
			strategy: "preloaded",
		},
	},
};
