import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { sharedChunkFileNames, sharedResolve, sharedSveltePlugins } from "./vite.config.shared.js";

export default defineConfig({
	resolve: sharedResolve(),
	plugins: [
		...sharedSveltePlugins(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			// No `.svelte`: a component declares as a stub that imports `svelte`,
			// which hosts do not install, and no type entry reaches one.
			include: ["src/**/*.ts", "src/**/*.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: {
				"pie-item-list": resolve(__dirname, "src/pie-item-list.ts"),
				// Registers nothing and touches no DOM, so it imports in Node.
				summarize: resolve(__dirname, "src/summarize.ts"),
			},
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The host's one item player renders expanded rows, imported on the first expansion.
			external: [/^@pie-players\/pie-item-player(?:\/|$)/],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: sharedChunkFileNames,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
