import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const assertNoEvalRequireInOutput = {
	name: "assert-no-eval-require-in-output",
	generateBundle(_options: unknown, bundle: Record<string, any>) {
		const evalRequirePattern = /eval\((["'])require\1\)/;
		for (const output of Object.values(bundle)) {
			if (output?.type !== "chunk" || typeof output.code !== "string") {
				continue;
			}
			if (evalRequirePattern.test(output.code)) {
				throw new Error(
					`Unsafe dynamic require pattern found in output chunk: ${output.fileName}`,
				);
			}
		}
	},
};

export default defineConfig({
	plugins: [
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
		assertNoEvalRequireInOutput,
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
