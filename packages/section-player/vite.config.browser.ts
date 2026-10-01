import { resolve } from "path";
import { defineConfig } from "vite";
import {
	assertNoEvalRequireInOutput,
	sharedAliases,
	sharedChunkFileNames,
	sharedSveltePlugins,
} from "./vite.config.shared.js";

/**
 * The self-contained ES module build behind the `./browser` export: the npm
 * build with nothing external, so a page loads `dist/browser/` by full URL with
 * no import map and no bundler. It sits next to `dist/`, which `vite.config.ts`
 * owns and empties first; this config owns `dist/browser/` and empties only that.
 *
 * Chunks stay split, so each lazily loaded tool downloads on first use. Chunk
 * names hash source paths rather than contents, so a self-hosted copy needs one
 * directory per version.
 *
 * This is an application build, not a library build, because library mode
 * inlines every asset as a `data:` URL and the Cortex calculator's 4.3 MB worker
 * script is one: Chromium refuses a module worker from a `data:` URL that large.
 * The entry's exports are kept as written.
 */
export default defineConfig({
	resolve: {
		alias: sharedAliases(),
	},
	plugins: [...sharedSveltePlugins(), assertNoEvalRequireInOutput],
	// A browser has no `process` to read it from.
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	base: "./",
	build: {
		outDir: "dist/browser",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		assetsInlineLimit: 0,
		modulePreload: false,
		rollupOptions: {
			input: {
				"pie-section-player": resolve(__dirname, "src/pie-section-player.ts"),
			},
			preserveEntrySignatures: "strict",
			external: [],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: sharedChunkFileNames,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
