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
			include: ["index.ts", "components/**/*.ts"],
		}),
	],
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, "index.ts"),
				"components/item-toolbar-element": resolve(
					__dirname,
					"components/item-toolbar-element.ts",
				),
				"components/section-toolbar-element": resolve(
					__dirname,
					"components/section-toolbar-element.ts",
				),
			},
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
				"@pie-players/pie-assessment-toolkit",
				"@pie-players/pie-assessment-toolkit/components/item-toolbar-element",
				"@pie-players/pie-assessment-toolkit/components/section-toolbar-element",
			],
			output: {
				format: "es",
				entryFileNames: "[name].js",
			},
		},
	},
});
