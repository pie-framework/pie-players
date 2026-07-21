import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	resolve: {
		alias: {
			"@pie-players/pie-players-shared/ui/use-zoom-compensation": resolve(
				__dirname,
				"../players-shared/src/ui/use-zoom-compensation.svelte.ts",
			),
		},
	},
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
		}),
		dts({ rollupTypes: false }),
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
