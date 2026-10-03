import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import { chunkFileNamesFromSource } from "../players-shared/chunk-file-names.js";
import { playersSharedSvelteSourceAliases } from "../players-shared/svelte-source-aliases.js";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { escapeSourceMapCommentTextInOutput } from "../players-shared/source-map-comment-text.mjs";
import { deferMathRenderingModuleEvaluation } from "../players-shared/math-rendering-module-deferral.mjs";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";

const chunkFileNames = chunkFileNamesFromSource(resolve(__dirname, "../.."));

const assertNoEvalRequireInOutput = {
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

export default defineConfig({
	resolve: {
		alias: {
			// Declared once in players-shared; see svelte-source-aliases.ts.
			...playersSharedSvelteSourceAliases(
				resolve(__dirname, "../players-shared"),
				resolve,
			),
		},
	},
	plugins: [
		deferMathRenderingModuleEvaluation(),
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
		assertNoEvalRequireInOutput,
	],
	build: {
		lib: {
			entry: {
				"pie-item-player": resolve(__dirname, "src/pie-item-player.ts"),
				preloaded: resolve(__dirname, "src/preloaded.ts"),
				"components/item-session-debugger-element": resolve(
					__dirname,
					"src/components/item-session-debugger-element.ts",
				),
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
