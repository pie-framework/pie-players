import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
				rootDir: svelteRootDir(__dirname),
			},
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			// No `insertTypesEntry`: it derives the types entry from the bundle
			// entry, which is a `.svelte` file with no declarations, and writes a
			// stub over the `index.d.ts` emitted from `index.ts`.
			include: ["index.ts", "lookup.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "tool-dictionary.svelte"),
			name: "PieToolDictionary",
			fileName: () => "tool-dictionary.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// The toolkit, players-shared and pie-context resolve from the host's
			// node_modules, so every PIE bundle a host loads shares one copy of
			// each. Patterns, because an exact-string external still inlines the
			// subpaths this tool imports.
			external: [
				/^@pie-players\/pie-(?:assessment-toolkit|players-shared|context)(?:\/|$)/,
			],
			output: {
				format: "es",
			},
		},
	},
});
