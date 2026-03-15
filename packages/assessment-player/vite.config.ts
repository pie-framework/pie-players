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
				"pie-assessment-player": resolve(
					__dirname,
					"src/pie-assessment-player.ts",
				),
			},
			name: "PieAssessmentPlayer",
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
				"@pie-players/pie-assessment-toolkit",
				"@pie-players/pie-players-shared",
				"@pie-players/pie-players-shared/types",
				"@pie-players/pie-section-player",
				"@pie-players/pie-section-player/components/section-player-splitpane-element",
				"@pie-players/pie-section-player/components/section-player-vertical-element",
			],
			output: {
				format: "es",
			},
		},
	},
});
