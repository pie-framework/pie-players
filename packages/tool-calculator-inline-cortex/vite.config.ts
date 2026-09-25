import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

export default defineConfig({
	plugins: [
		svelte({ compilerOptions: { customElement: true }, emitCss: false }),
		guardSvelteCustomElementDefines(),
		dts({ bundleTypes: false }),
	],
	build: {
		lib: {
			entry: "tool-calculator-inline-cortex.svelte",
			name: "PieToolCalculatorInlineCortex",
			fileName: "tool-calculator-inline-cortex",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				"@pie-players/pie-assessment-toolkit",
				"@pie-players/pie-players-shared/i18n/provider",
				"@pie-players/pie-players-shared/i18n/types",
			],
		},
	},
});
