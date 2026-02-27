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
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-protractor.svelte"),
			name: "PieToolProtractor",
			fileName: () => "tool-protractor.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: ["@datadog/browser-rum"],
			onwarn(warning, warn) {
				if (
					typeof warning.message === "string" &&
					warning.message.includes(
						"contains an annotation that Rollup cannot interpret due to the position of the comment",
					)
				) {
					return;
				}
				warn(warning);
			},
			output: {
				format: "es",
							},
		},
	},
});
