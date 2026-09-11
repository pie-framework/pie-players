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
			// No `insertTypesEntry`: it derives the types entry from the bundle
			// entry, which is a `.svelte` file with no declarations, and writes a
			// stub over the `index.d.ts` emitted from `index.ts`.
			include: ["index.ts", "lookup.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-picture-dictionary.svelte"),
			name: "PieToolPictureDictionary",
			fileName: () => "tool-picture-dictionary.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [],
			output: {
				format: "es",
			},
		},
	},
});
