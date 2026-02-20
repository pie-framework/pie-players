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
			outDir: "dist",
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: {
				"pie-assessment-player": resolve(__dirname, "src/pie-assessment-player.ts"),
				"player/index": resolve(__dirname, "src/player/index.ts"),
				"reference-layout/index": resolve(
					__dirname,
					"src/reference-layout/index.ts",
				),
			},
			name: "PieAssessmentPlayer",
			fileName: (_, entryName) => `${entryName}.js`,
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: (id) =>
				id === "@datadog/browser-rum" || id.startsWith("@pie-players/"),
			output: {
				format: "es",
							},
		},
	},
});
