import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		customElement: true,
	},
};

export default config;
