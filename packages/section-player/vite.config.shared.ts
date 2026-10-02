import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import type { PluginOption } from "vite";
import { chunkFileNamesFromSource } from "../players-shared/chunk-file-names.js";
import { escapeSourceMapCommentTextInOutput } from "../players-shared/source-map-comment-text.mjs";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { playersSharedSvelteSourceAliases } from "../players-shared/svelte-source-aliases.js";

/**
 * What the npm build (`vite.config.ts`) and the browser build
 * (`vite.config.browser.ts`) share: source resolution, the Svelte pipeline,
 * the custom-element define guard, and chunk naming. Only dependency
 * externalization, the entry set and the output directory differ between them.
 */

export const sharedAliases = () =>
	// Declared once in players-shared; see svelte-source-aliases.ts.
	playersSharedSvelteSourceAliases(
		resolve(__dirname, "../players-shared"),
		resolve,
	);

export const sharedSveltePlugins = (): PluginOption[] => [
	svelte({
		preprocess: vitePreprocess(),
		compilerOptions: {
			customElement: true,
		},
		emitCss: false,
	}),
	guardSvelteCustomElementDefines(),
	escapeSourceMapCommentTextInOutput(),
];

export const sharedChunkFileNames = chunkFileNamesFromSource(
	resolve(__dirname, "../.."),
);

export const assertNoEvalRequireInOutput = {
	name: "assert-no-eval-require-in-output",
	generateBundle(_options: unknown, bundle: Record<string, any>) {
		const evalRequirePattern = /eval\((["'])require\1\)/;
		for (const output of Object.values(bundle)) {
			if (output?.type !== "chunk" || typeof output.code !== "string") {
				continue;
			}
			if (evalRequirePattern.test(output.code)) {
				throw new Error(
					`Unsafe dynamic require pattern found in output chunk: ${output.fileName}`,
				);
			}
		}
	},
};
