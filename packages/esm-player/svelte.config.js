import adapter from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		customElement: true,
	},
	kit: {
		adapter,
	},
};

export default config;
