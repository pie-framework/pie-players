import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { calculatorSharedSvelteSourceAliases } from "../tool-calculator-shared/svelte-source-aliases.js";

export default defineConfig({
	// Declared once in tool-calculator-shared; see svelte-source-aliases.ts.
	resolve: {
		alias: calculatorSharedSvelteSourceAliases(
			resolve(import.meta.dirname, "../tool-calculator-shared"),
			resolve,
		),
	},
	plugins: [
		svelte({
			compilerOptions: { customElement: true },
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
		dts({
			tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			include: ["index.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(import.meta.dirname, "tool-calculator-geogebra.svelte"),
			name: "PieToolCalculatorGeoGebra",
			fileName: () => "pie-tool-calculator-geogebra.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The toolkit, players-shared and pie-context resolve from the
			// host's node_modules, so every PIE bundle a host loads shares one
			// copy of each. A pattern, because an exact-string external still
			// inlines the subpaths the calculator shells import.
			external: [
				/^@pie-players\/pie-(?:assessment-toolkit|players-shared|context)(?:\/|$)/,
			],
			output: { format: "es" },
		},
	},
});
