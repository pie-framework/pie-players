import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-annotation-toolbar.svelte"),
			name: "PieToolAnnotationToolbar",
			fileName: () => "tool-annotation-toolbar.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		cssMinify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The toolkit, players-shared, pie-context and speech-rule-engine
			// resolve from the host's node_modules, so every PIE bundle a host
			// loads shares one copy of each. Patterns, because an exact-string
			// external still inlines the subpaths this tool imports.
			external: [
				/^@pie-players\/pie-(?:assessment-toolkit|players-shared|context)(?:\/|$)/,
				/^speech-rule-engine(?:\/|$)/,
			],
			output: {
				format: "es",
			},
		},
	},
});
