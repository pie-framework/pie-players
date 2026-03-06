import { svelte } from "@sveltejs/vite-plugin-svelte";
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
		patchMathRenderingModuleEval,
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
		assertNoEvalRequireInOutput,
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/pie-item-player.ts"),
			name: "PieItemPlayerElement",
			fileName: () => "pie-item-player.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [],
			output: {
				format: "es",
			},
		},
	},
});
