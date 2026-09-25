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
			entry: resolve(__dirname, "tool-text-to-speech.svelte"),
			name: "PieToolTextToSpeech",
			fileName: () => "tool-text-to-speech.js",
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
			},
		},
	},
});
