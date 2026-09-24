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
			outDirs: "dist",
			insertTypesEntry: true,
			include: ["**/*.ts", "**/*.svelte"],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "TtsSettingsPanel.svelte"),
			name: "PieSectionPlayerToolsTtsSettings",
			fileName: () => "section-player-tools-tts-settings.js",
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
