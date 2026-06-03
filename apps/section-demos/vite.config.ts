/**
 * Workspace resolution: many `@pie-players/*` imports are aliased to each package’s
 * built `dist/` output so local dev matches npm consumers. See
 * docs/development/demo-workspace-resolution.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local ESM CDN plugin for testing packages locally before publishing
// Enable with: LOCAL_ESM_CDN=true bun run dev
async function createLocalEsmCdnPlugin() {
	// Only load if explicitly enabled
	if (process.env.LOCAL_ESM_CDN !== "true") {
		return null;
	}

	const siblingRepoPath = path.resolve(__dirname, "../../../pie-elements-ng");
	const playersRepoPath = path.resolve(__dirname, "../..");

	// Check if sibling repo exists
	if (!fs.existsSync(siblingRepoPath)) {
		console.log(
			"[local-esm-cdn] Sibling pie-elements-ng not found, skipping plugin",
		);
		return null;
	}

	try {
		// Import from local-esm-cdn in this repo
		const adapterPath = path.resolve(
			__dirname,
			"../local-esm-cdn/dist/adapters/vite.js",
		);
		const { createVitePlugin } = await import(adapterPath);

		console.log("[local-esm-cdn] Plugin enabled - testing prod-like CDN mode");

		// Configure the local ESM CDN Vite plugin
		return createVitePlugin({
			pieElementsNgRoot: siblingRepoPath,
			piePlayersRoot: playersRepoPath,
			esmShBaseUrl: "https://esm.sh",
			debug: process.env.LOCAL_ESM_CDN_DEBUG === "true",
		});
	} catch (err) {
		console.warn("[local-esm-cdn] Failed to load plugin:", err);
		return null;
	}
}

export default (async () => {
	const localEsmCdn = await createLocalEsmCdnPlugin();

	return defineConfig({
		plugins: [sveltekit(), tailwindcss(), localEsmCdn].filter(Boolean),
		server: {
			port: 5300,
			open: true,
			proxy: {
				// Same-origin proxy for FontAwesome 6 Pro served by Renaissance.
				// Renaissance's CDN ships the CSS but doesn't send CORS headers
				// on the underlying woff2/ttf files, which fails when the
				// stylesheet's `@font-face` rules are evaluated cross-origin.
				// Routing through Vite makes the fetches same-origin so the
				// browser skips the CORS check entirely. Dev-only — production
				// hosts must arrange their own same-origin path or get
				// Renaissance to add `Access-Control-Allow-Origin`.
				"/_fa-pro": {
					target: "https://ui.renaissance.com",
					changeOrigin: true,
					rewrite: (p) => p.replace(/^\/_fa-pro/, "/fonts/Font_Awesome_6_Pro"),
				},
				// Same-origin proxy for the Renaissance Roboto bundle. Same
				// rationale as `/_fa-pro` above: the CSS loads cross-origin
				// fine but the .ttf / .woff2 it references is CORS-blocked.
				"/_roboto": {
					target: "https://ui.renaissance.com",
					changeOrigin: true,
					rewrite: (p) => p.replace(/^\/_roboto/, "/fonts/Roboto"),
				},
			},
		},
		resolve: {
			alias: {
				"@pie-players/tts-client-server": resolve(
					__dirname,
					"../../packages/tts-client-server/dist/index.js",
				),
				"@pie-players/pie-calculator-desmos": resolve(
					__dirname,
					"../../packages/calculator-desmos/dist/index.js",
				),
				"@pie-players/pie-tool-calculator-desmos": resolve(
					__dirname,
					"../../packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
				),
				"@pie-players/pie-tool-text-to-speech": resolve(
					__dirname,
					"../../packages/tool-text-to-speech/dist/tool-text-to-speech.js",
				),
				"@pie-players/pie-section-player-tools-shared": resolve(
					__dirname,
					"../../packages/section-player-tools-shared/index.ts",
				),
				"@pie-players/pie-tool-tts-inline": resolve(
					__dirname,
					"../../packages/tool-tts-inline/dist/tool-tts-inline.js",
				),
				"@pie-players/pie-tool-answer-eliminator": resolve(
					__dirname,
					"../../packages/tool-answer-eliminator/dist/tool-answer-eliminator.js",
				),
				"@pie-players/pie-tool-annotation-toolbar": resolve(
					__dirname,
					"../../packages/tool-annotation-toolbar/dist/tool-annotation-toolbar.js",
				),
				"@pie-players/pie-tool-theme": resolve(
					__dirname,
					"../../packages/tool-color-scheme/dist/tool-color-scheme.js",
				),
				"@pie-players/pie-tool-graph": resolve(
					__dirname,
					"../../packages/tool-graph/dist/tool-graph.js",
				),
				"@pie-players/pie-tool-periodic-table": resolve(
					__dirname,
					"../../packages/tool-periodic-table/dist/tool-periodic-table.js",
				),
				"@pie-players/pie-tool-protractor": resolve(
					__dirname,
					"../../packages/tool-protractor/dist/tool-protractor.js",
				),
				"@pie-players/pie-tool-line-reader": resolve(
					__dirname,
					"../../packages/tool-line-reader/dist/tool-line-reader.js",
				),
				"@pie-players/pie-tool-ruler": resolve(
					__dirname,
					"../../packages/tool-ruler/dist/tool-ruler.js",
				),
			},
		},
	});
})();
