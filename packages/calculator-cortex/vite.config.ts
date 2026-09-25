import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	base: "./",
	plugins: [
		svelte({ emitCss: false }),
		dts({
			tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			// No `.svelte`: a component declares as a stub that imports `svelte`,
			// which hosts do not install, and no type entry reaches one.
			include: ["src/**/*.ts", "svelte-shims.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(import.meta.dirname, "src/index.ts"),
			name: "PieCalculatorCortex",
			fileName: () => "index.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: ["@pie-players/pie-calculator"],
			output: {
				format: "es",
				chunkFileNames: "chunks/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash][extname]",
			},
		},
	},
});
