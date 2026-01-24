import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: "build",
			assets: "build",
			// GitHub Pages does not serve `index.html` for directory routes unless the URL ends with `/`.
			// Emit an SPA fallback so deep links like `/examples/a11y-components/foo/` still work.
			// (GitHub Pages serves `404.html` for unknown paths; SvelteKit will then route client-side.)
			fallback: "404.html",
			precompress: false,
			strict: false,
		}),
		paths: {
			// Host the examples app under GitHub Pages project subpath:
			// https://pie-framework.github.io/pie-players/examples/
			base:
				process.env.NODE_ENV === "production" ? "/pie-players/examples" : "",
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
