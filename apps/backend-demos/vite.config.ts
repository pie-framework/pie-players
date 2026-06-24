import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Playwright sets PLAYWRIGHT_DISABLE_VITE_OVERLAY=1 so the dev-only crash
// overlay can't intercept clicks during E2E. Unhandled errors still surface
// in console.error output and the webServer log.
const disableErrorOverlay = process.env.PLAYWRIGHT_DISABLE_VITE_OVERLAY === "1";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5600,
		open: true,
		hmr: disableErrorOverlay ? { overlay: false } : undefined,
	},
});
