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
			// Custom domain (players.pie-framework.org) doesn't need base path
			// Fallback to /pie-players for GitHub Pages without custom domain
			base: process.env.GITHUB_PAGES_CUSTOM_DOMAIN === "true" ? "" : (process.env.NODE_ENV === "production" ? "/pie-players" : ""),
		},
		prerender: {
			entries: ["*"],
			handleMissingId: "warn",
			handleHttpError: ({ path, message }) => {
				// Ignore 404 for /examples/ (served by separate app)
				if (path === "/examples/" || path.startsWith("/examples/")) {
					return;
				}
				// Throw error for other 404s
				throw new Error(message);
			},
		},
	},
};

export default config;
