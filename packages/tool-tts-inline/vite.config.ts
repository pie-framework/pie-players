import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
		}),
		guardSvelteCustomElementDefines(),
		dts({ bundleTypes: false }),
	],
	build: {
		lib: {
			entry: "tool-tts-inline.svelte",
			name: "PieToolTTSInline",
			fileName: "tool-tts-inline",
			formats: ["es"],
		},
		rollupOptions: {
			external: ["svelte", "@pie-players/pie-assessment-toolkit"],
			output: {
				globals: {
					svelte: "Svelte",
				},
			},
		},
	},
});
