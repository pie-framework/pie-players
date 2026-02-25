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
	build: {
		lib: {
			entry: resolve(__dirname, "SectionSessionPanel.svelte"),
			name: "PieSectionPlayerToolsSessionDebugger",
			fileName: () => "section-player-tools-session-debugger.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: ["@pie-players/pie-assessment-toolkit"],
			output: {
				format: "es",
			},
		},
	},
});
