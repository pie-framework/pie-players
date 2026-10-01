import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { createHash } from "node:crypto";
import { resolve } from "path";
import type { PluginOption } from "vite";
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

const sanitizeChunkKey = (value: string) =>
	value
		.replace(/\\/g, "/")
		.replace(/^.*\/node_modules\//, "npm/")
		.replace(/^.*\/src\//, "src/")
		.replace(/-[a-f0-9]{8,}(?=\.js($|[/.]))/gi, "")
		.replace(/-[a-f0-9]{8,}(?=\/|$)/gi, "")
		.replace(/[^a-zA-Z0-9/_-]/g, "-")
		.replace(/\/+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/$/, "")
		.replace(/\//g, "__");

const getChunkSourceKey = (chunkInfo: {
	name: string;
	facadeModuleId?: string | null;
	moduleIds?: string[];
}) => {
	const moduleSource =
		chunkInfo.facadeModuleId ??
		(Array.isArray(chunkInfo.moduleIds) ? chunkInfo.moduleIds[0] : undefined);
	const sourceKey = sanitizeChunkKey(moduleSource || chunkInfo.name || "chunk");
	const chunkName = sanitizeChunkKey(chunkInfo.name || "chunk");
	const sourceHash = createHash("sha1")
		.update(sourceKey)
		.digest("hex")
		.slice(0, 8);
	return `${chunkName}-${sourceHash}`;
};

export const sharedChunkFileNames = (chunkInfo: {
	name: string;
	facadeModuleId?: string | null;
	moduleIds?: string[];
}) => `chunks/${getChunkSourceKey(chunkInfo)}.js`;

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
