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
			outDirs: "dist",
			// `index.types.ts` is the types entry. `insertTypesEntry` would write a
			// re-export of `index.ts` over it, and the components `index.ts`
			// exports declare as stubs importing `svelte`, which hosts do not
			// install.
			include: [
				"index.types.ts",
				"floating-panel.ts",
				"section-controller.ts",
				"section-controller-subscription.ts",
				"svelte-shims.d.ts",
			],
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
