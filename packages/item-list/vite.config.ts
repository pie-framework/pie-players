import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defaultClientConditions, defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { chunkFileNamesFromSource } from "../players-shared/chunk-file-names.js";
import { escapeSourceMapCommentTextInOutput } from "../players-shared/source-map-comment-text.mjs";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";
import { playersSharedSvelteSourceAliases } from "../players-shared/svelte-source-aliases.js";

const chunkFileNames = chunkFileNamesFromSource(resolve(__dirname, "../.."));

export default defineConfig({
	resolve: {
		conditions: ["pie-browser-esm", ...defaultClientConditions],
		alias: {
			// Declared once in players-shared; see svelte-source-aliases.ts.
			...playersSharedSvelteSourceAliases(
				resolve(__dirname, "../players-shared"),
				resolve,
			),
		},
	},
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
				rootDir: svelteRootDir(__dirname),
			},
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
		escapeSourceMapCommentTextInOutput(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			// No `.svelte`: a component declares as a stub that imports `svelte`,
			// which hosts do not install, and no type entry reaches one.
			include: ["src/**/*.ts", "src/**/*.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: {
				"pie-item-list": resolve(__dirname, "src/pie-item-list.ts"),
				// Registers nothing and touches no DOM, so it imports in Node.
				summarize: resolve(__dirname, "src/summarize.ts"),
			},
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
