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
			include: ["index.ts", "src/**/*.ts"],
		}),
	],
	build: {
		lib: {
			// `index.ts` rather than the component: this package publishes a
			// registration and its content resolver as values, and registers the
			// element as an import side effect. A component-only entry would compile
			// the element but leave the registration unreachable.
			entry: resolve(__dirname, "index.ts"),
			name: "PieToolSignLanguage",
			fileName: () => "tool-sign-language.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The toolkit is a peer in the host's graph, not a copy inlined here:
			// two `ToolRegistry` classes would fail every `instanceof` across the
			// boundary, and the host already has it.
			external: [
				"@pie-players/pie-assessment-toolkit",
				/^@pie-players\/pie-players-shared/,
			],
			output: {
				format: "es",
			},
		},
	},
});
