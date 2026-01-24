import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: "build",
			assets: "build",
			fallback: undefined,
			precompress: false,
			strict: false,
		}),
		paths: {
			base: process.env.NODE_ENV === "production" ? "/pie-players" : "",
		},
		prerender: {
			entries: ["*"],
			handleMissingId: "warn",
		},
	},
};

export default config;
