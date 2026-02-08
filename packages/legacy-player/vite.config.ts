import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
		}),
		dts({
			insertTypesEntry: true,
			include: ["src/**/*.ts", "src/**/*.svelte"],
		}),
	],
	build: {
		lib: {
			entry: "src/pie-legacy-player.ts",
			name: "PieLegacyPlayer",
			fileName: "pie-legacy-player",
			formats: ["es"],
		},
		rollupOptions: {
			external: ["@datadog/browser-rum", "@datadog/browser-logs"],
			output: {
				globals: {},
			},
		},
		sourcemap: true,
	},
});
