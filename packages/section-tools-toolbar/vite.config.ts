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
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "section-tools-toolbar.svelte"),
			name: "PieSectionToolsToolbar",
			fileName: () => "section-tools-toolbar.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				"@datadog/browser-rum",
				"@pie-players/pie-assessment-toolkit",
				"@pie-players/pie-tool-calculator",
				"@pie-players/pie-tool-graph",
				"@pie-players/pie-tool-periodic-table",
				"@pie-players/pie-tool-protractor",
				"@pie-players/pie-tool-line-reader",
				"@pie-players/pie-tool-magnifier",
				"@pie-players/pie-tool-ruler",
			],
			output: {
				format: "es",
							},
		},
	},
});
