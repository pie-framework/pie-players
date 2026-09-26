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
				// MathLive and the Compute Engine each get a chunk of their own. A
				// Vite 7 host tests every module against
				// /new\s+URL.+import\.meta\.url/s, which in a large build on Node 26
				// overflows V8's regexp stack once about 4M characters follow a
				// module's first `new URL`; as one runtime chunk, 5.9M followed
				// MathLive's. scripts/check-bundle-safety.mjs holds every dist module
				// to half that.
				codeSplitting: {
					groups: [
						{
							name: "mathlive",
							test: /[\\/]node_modules[\\/]mathlive[\\/].+\.m?js$/,
						},
						{
							name: "compute-engine",
							test: /[\\/]node_modules[\\/]@cortex-js[\\/]compute-engine[\\/]/,
						},
					],
				},
			},
		},
	},
});
