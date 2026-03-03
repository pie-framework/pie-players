import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
	},

	vitePlugin: {
		inspector: {
			toggleKeyCombo: "meta-shift",
			holdMode: true,
		},
	},
};

export default config;
