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
			entry: resolve(__dirname, "tool-ruler.svelte"),
			name: "PieToolRuler",
			fileName: () => "tool-ruler.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [],
			onwarn(warning, warn) {
				if (
					typeof warning.message === "string" &&
					warning.message.includes(
						"contains an annotation that Rollup cannot interpret due to the position of the comment",
					)
				) {
					return;
				}
				warn(warning);
			},
			output: {
				format: "es",
			},
		},
	},
});
