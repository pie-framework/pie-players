import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
	},

	// Allow custom elements from packages that use them
	compilerOptions: {
		customElement: false,
	},

	// Configure vite-plugin-svelte to handle custom elements
	vitePlugin: {
		inspector: {
			toggleKeyCombo: "meta-shift",
			holdMode: true,
		},
		dynamicCompileOptions({ filename }) {
			// Enable custom element compilation for cross-package CE sources.
			if (
				filename.includes("pie-section-player/src/PieSectionPlayer.svelte")
			) {
				return {
					customElement: true,
				};
			}
			return {
				customElement: false,
			};
		},
	},
};

export default config;
