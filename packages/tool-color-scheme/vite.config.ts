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
			outDirs: "dist",
			insertTypesEntry: true,
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-color-scheme.svelte"),
			name: "PieToolColorScheme",
			fileName: () => "tool-color-scheme.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The observable scheme registry must be the host's single theme module,
			// not a private copy embedded in this custom-element bundle.
			external: [/^@pie-players\/pie-theme(?:\/|$)/],
			output: {
				format: "es",
			},
		},
	},
});
