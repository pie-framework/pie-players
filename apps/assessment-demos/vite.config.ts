/**
 * Mix of explicit `dist/` aliases (where listed) and normal `exports` resolution.
 * See docs/development/demo-workspace-resolution.md
 */
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";

// Playwright sets PLAYWRIGHT_DISABLE_VITE_OVERLAY=1 so the dev-only crash
// overlay can't intercept clicks during E2E. Unhandled errors still surface
// in console.error output and the webServer log.
const disableErrorOverlay = process.env.PLAYWRIGHT_DISABLE_VITE_OVERLAY === "1";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5500,
		open: true,
		hmr: disableErrorOverlay ? { overlay: false } : undefined,
	},
	resolve: {
		alias: {
			"@pie-players/pie-section-player-tools-shared": resolve(
				__dirname,
				"../../packages/section-player-tools-shared/index.ts",
			),
			"@pie-players/pie-tool-calculator-desmos": resolve(
				__dirname,
				"../../packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
			),
		},
	},
});
