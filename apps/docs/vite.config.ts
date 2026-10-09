import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				pages: "build",
				assets: "build",
				fallback: undefined,
				precompress: false,
				strict: false,
			}),
			paths: { base: "" },
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
		}),
	],
});
