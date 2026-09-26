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
		// The build entry is the component, whose declaration is a stub that
		// imports `svelte`, which hosts do not install; `index.ts` is the type
		// entry instead.
		dts({ bundleTypes: false, include: ["index.ts"] }),
	],
	build: {
		lib: {
			entry: "tool-tts-inline.svelte",
			name: "PieToolTTSInline",
			fileName: "tool-tts-inline",
			formats: ["es"],
		},
		rollupOptions: {
			// The toolkit, players-shared and pie-context resolve from the
			// host's node_modules, so every PIE bundle a host loads shares one
			// copy of each. A pattern, because an exact-string external still
			// inlines the subpaths this tool imports.
			external: [
				"svelte",
				/^@pie-players\/pie-(?:assessment-toolkit|players-shared|context)(?:\/|$)/,
			],
			output: {
				globals: {
					svelte: "Svelte",
				},
			},
		},
	},
});
