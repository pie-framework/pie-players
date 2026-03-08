import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		svelte({
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
			entry: resolve(__dirname, "index.ts"),
			name: "PieSectionPlayerToolsShared",
			fileName: () => "index.js",
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
