import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

export default defineConfig({
	plugins: [
		svelte({ compilerOptions: { customElement: true }, emitCss: false }),
		guardSvelteCustomElementDefines(),
		// The build entry is the component, whose declaration is a stub that
		// imports `svelte`, which hosts do not install; `index.ts` is the type
		// entry instead.
		dts({ bundleTypes: false, include: ["index.ts"] }),
	],
	build: {
		lib: {
			entry: "tool-calculator-inline-geogebra.svelte",
			name: "PieToolCalculatorInlineGeoGebra",
			fileName: "tool-calculator-inline-geogebra",
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
