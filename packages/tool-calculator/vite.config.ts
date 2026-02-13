import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDir: "dist",
			insertTypesEntry: true,
			// Only generate types for the entry point
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-calculator.svelte"),
			name: "PieToolCalculator",
			fileName: () => "pie-tool-calculator.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: true,
		rollupOptions: {
			external: [
				"@datadog/browser-rum",
				"@pie-players/pie-calculator-desmos",
				"@pie-players/tts-client-server",
				"@pie-players/pie-assessment-toolkit",
			],
			output: {
				format: "es",
				inlineDynamicImports: true,
			},
		},
	},
});
