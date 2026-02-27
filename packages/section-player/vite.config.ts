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
			entry: resolve(__dirname, "src/pie-section-player.ts"),
			name: "PieSectionPlayer",
			fileName: () => "pie-section-player.js",
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
				"@pie-players/pie-calculator-desmos",
				"@pie-players/pie-section-tools-toolbar",
				"@pie-players/pie-tool-answer-eliminator",
				"@pie-players/pie-tool-calculator",
				"@pie-players/pie-tool-calculator-inline",
				"@pie-players/pie-tool-tts-inline",
				"@pie-players/tts-client-server",
			],
			output: {
				format: "es",
							},
		},
	},
});
