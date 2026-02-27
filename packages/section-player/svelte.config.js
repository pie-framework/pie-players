import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('svelte/compiler').CompileOptions} */
const compilerOptions = {
	customElement: true
};

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions
};

export default config;
