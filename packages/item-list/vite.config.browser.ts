import { resolve } from "path";
import { defineConfig } from "vite";
import { sharedChunkFileNames, sharedResolve, sharedSveltePlugins } from "./vite.config.shared.js";

/**
 * The self-contained ES module build behind the `./browser` export: the npm build with nothing
 * external, so a page loads `dist/browser/` by full URL with no import map and no bundler. It sits
 * next to `dist/`, which `vite.config.ts` owns and empties first; this config owns `dist/browser/`
 * and empties only that.
 *
 * Chunks stay split, so the item player downloads only when a row first expands. Chunk names hash
 * source paths rather than contents, so a self-hosted copy needs one directory per version. An
 * application build rather than a library build, as for the section player, keeps the entry's
 * exports as written and any asset as a file.
 */
export default defineConfig({
	resolve: sharedResolve(),
	plugins: sharedSveltePlugins(),
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
				"pie-item-list": resolve(__dirname, "src/pie-item-list.ts"),
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
