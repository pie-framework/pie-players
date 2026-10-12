import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: { rootDir: svelteRootDir(__dirname) },
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			// Only generate types for the entry point
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "index.ts"),
			name: "PieToolCalculator",
			fileName: () => "pie-tool-calculator.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				"@pie-players/pie-tool-calculator-shared/calculator-element",
			],
			output: {
				format: "es",
			},
		},
	},
});
