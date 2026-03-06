import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const patchMathRenderingModuleEval = {
	name: "patch-math-rendering-module-eval",
	enforce: "pre" as const,
	transform(code: string, id: string) {
		if (!id.includes("@pie-lib/math-rendering-module/module/index.js")) {
			return null;
		}

		return {
			code: code.replace(
				/return\s+eval\((["'])require\1\);/g,
				"return commonjsRequire;",
			),
			map: null,
		};
	},
};

export default defineConfig({
	plugins: [
		patchMathRenderingModuleEval,
		svelte({
			preprocess: vitePreprocess(),
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDir: "dist",
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: {
				"pie-section-player": resolve(__dirname, "src/pie-section-player.ts"),
				"utils/player-preload": resolve(
					__dirname,
					"src/utils/player-preload.ts",
				),
			},
			name: "PieSectionPlayer",
			fileName: (_format, entryName) => `${entryName}.js`,
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				"@datadog/browser-rum",
				"@pie-players/pie-toolbars",
				"@pie-players/pie-toolbars/components/item-toolbar-element",
				"@pie-players/pie-toolbars/components/section-toolbar-element",
			],
			output: {
				format: "es",
							},
		},
	},
});
