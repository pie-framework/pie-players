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
			include: ["**/*.ts", "**/*.svelte"],
		}),
	],
	resolve: {
		alias: {
			"@pie-players/pie-section-player-tools-shared": resolve(
				__dirname,
				"../section-player-tools-shared/index.ts",
			),
		},
	},
	build: {
		lib: {
			entry: resolve(__dirname, "EventPanel.svelte"),
			name: "PieSectionPlayerToolsEventDebugger",
			fileName: () => "section-player-tools-event-debugger.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			output: {
				format: "es",
			},
		},
	},
});
