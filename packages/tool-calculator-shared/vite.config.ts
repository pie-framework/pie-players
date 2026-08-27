import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		svelte({ emitCss: false }),
		dts({
			tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			include: [
				"index.ts",
				"CalculatorTool.svelte",
				"CalculatorInlineTool.svelte",
				"svelte-shims.d.ts",
			],
		}),
	],
	build: {
		lib: {
			entry: resolve(import.meta.dirname, "index.ts"),
			name: "PieToolCalculatorShared",
			fileName: () => "index.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				/^svelte(?:\/.*)?$/,
				"@pie-players/pie-assessment-toolkit",
				"@pie-players/pie-assessment-toolkit/tools/client",
				"@pie-players/pie-players-shared/i18n/provider",
				"@pie-players/pie-players-shared/i18n/types",
			],
			output: { format: "es" },
		},
	},
});
