import { svelte } from "@sveltejs/vite-plugin-svelte";
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
			bundleTypes: false,
			// This package has no `.ts` source — `vite.config.ts` is the only file in
			// its tsconfig program, so it cannot be excluded there without emptying it.
			// Name the component instead, so the config's declaration stops being
			// emitted into the published `dist`.
			include: ["tool-calculator-inline.svelte"],
		}),
	],
	build: {
		lib: {
			entry: "tool-calculator-inline.svelte",
			name: "PieToolCalculatorInline",
			fileName: "tool-calculator-inline",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: ["svelte", "@pie-players/pie-assessment-toolkit"],
			output: {
				globals: {
					svelte: "Svelte",
				},
			},
		},
	},
});
