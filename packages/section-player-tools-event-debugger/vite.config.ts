import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			// No `insertTypesEntry`: it derives the types entry from the bundle
			// entry, which is a `.svelte` file with no declarations, and writes a
			// stub over the `index.d.ts` emitted from `index.ts`. The stub imports
			// `svelte`, which hosts do not install, so no `.svelte` is included.
			include: ["index.ts"],
		}),
	],
	resolve: {
		alias: {
			"@pie-players/pie-section-player-tools-shared": resolve(
				__dirname,
				"../section-player-tools-shared/index.ts",
			),
		},
	},
	build: {
		lib: {
			entry: resolve(__dirname, "EventPanel.svelte"),
			name: "PieSectionPlayerToolsEventDebugger",
			fileName: () => "section-player-tools-event-debugger.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			// speech-rule-engine and its locale tables resolve from the host's
			// node_modules, so every PIE bundle a host loads shares one copy.
			external: [/^speech-rule-engine(?:\/|$)/],
			output: {
				format: "es",
			},
		},
	},
});
