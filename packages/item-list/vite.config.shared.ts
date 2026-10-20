import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defaultClientConditions, type PluginOption, type UserConfig } from "vite";
import { chunkFileNamesFromSource } from "../players-shared/chunk-file-names.js";
import { escapeSourceMapCommentTextInOutput } from "../players-shared/source-map-comment-text.mjs";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";
import { playersSharedSvelteSourceAliases } from "../players-shared/svelte-source-aliases.js";

/**
 * What the npm build (`vite.config.ts`) and the browser build (`vite.config.browser.ts`) share:
 * source resolution, the Svelte pipeline, the custom-element define guard, and chunk naming.
 */

export const sharedResolve = (): UserConfig["resolve"] => ({
	conditions: ["pie-browser-esm", ...defaultClientConditions],
	// Declared once in players-shared; see svelte-source-aliases.ts.
	alias: playersSharedSvelteSourceAliases(resolve(__dirname, "../players-shared"), resolve),
});

export const sharedSveltePlugins = (): PluginOption[] => [
	svelte({
		compilerOptions: {
			customElement: true,
			rootDir: svelteRootDir(__dirname),
		},
		emitCss: false,
	}),
	guardSvelteCustomElementDefines(),
	escapeSourceMapCommentTextInOutput(),
];

export const sharedChunkFileNames = chunkFileNamesFromSource(resolve(__dirname, "../.."));
