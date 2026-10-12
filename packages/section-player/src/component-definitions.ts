import "@pie-players/pie-item-player";
import {
	DEFAULT_BUNDLE_HOST,
	DEFAULT_ESM_CDN_URL,
} from "@pie-players/pie-players-shared";

export interface ComponentDefinition {
	tagName: string;
	attributes?: Record<string, string>;
	props?: Record<string, unknown>;
}

export type PlayerDefinitionMap = Record<string, ComponentDefinition>;

export const DEFAULT_PLAYER_DEFINITIONS: PlayerDefinitionMap = {
	iife: {
		tagName: "pie-item-player",
		attributes: {
			strategy: "iife",
		},
		props: {
			loaderOptions: {
				bundleHost: DEFAULT_BUNDLE_HOST,
			},
		},
	},
	esm: {
		tagName: "pie-item-player",
		attributes: {
			strategy: "esm",
		},
		props: {
			loaderOptions: {
				esmCdnUrl: DEFAULT_ESM_CDN_URL,
			},
		},
	},
	preloaded: {
		tagName: "pie-item-player",
		attributes: {
			strategy: "preloaded",
		},
	},
};
