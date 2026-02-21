import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		paths: {
			// Host the examples app under /examples/ for custom domain or GitHub Pages
			// Custom domain: https://players.pie-framework.org/examples/
			// GitHub Pages: https://pie-framework.github.io/pie-players/examples/
			base:
				process.env.NODE_ENV === "production"
					? process.env.GITHUB_PAGES_CUSTOM_DOMAIN === "true"
						? "/examples"
						: "/pie-players/examples"
					: "",
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Ignore 404 for favicon (optional file)
				if (path === "/pie-players/examples/favicon.png") {
					return;
				}
				// Throw error for other 404s
				throw new Error(message);
			},
			// Handle dynamic routes that weren't discovered during crawl
			handleUnseenRoutes: () => {},
		},
	},
};

export default config;
