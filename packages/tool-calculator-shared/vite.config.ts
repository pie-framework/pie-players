import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/**
 * Builds `./calculator-element`, the one published entry. Hosts resolve it at
 * runtime through the packaged tool loaders and the Desmos package, so Svelte
 * is bundled and nothing resolves against a host copy.
 *
 * The shells in `components.ts` are not built here: the vendor wrappers compile
 * them from source (see `svelte-source-aliases.ts`).
 */
export default defineConfig({
	plugins: [
		svelte({ compilerOptions: { customElement: true }, emitCss: false }),
		dts({
			tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
			outDirs: "dist",
			include: ["calculator-element.ts", "svelte-shims.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: {
				"calculator-element": resolve(
					import.meta.dirname,
					"calculator-element.ts",
				),
			},
			name: "PieToolCalculatorShared",
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
			// copy of each.
			external: [
				/^@pie-players\/pie-(?:assessment-toolkit|players-shared|context)(?:\/|$)/,
			],
			output: { format: "es" },
		},
	},
});
