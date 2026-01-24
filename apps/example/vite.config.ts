import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { createLogger, defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local ESM CDN plugin
async function createLocalEsmCdnPlugin() {
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

		// Configure the local ESM CDN Vite plugin.
		//
		// Automatic HMR: The plugin watches both pie-elements-ng and pie-players dist files
		// and triggers full-reload HMR when changes are detected.
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

const PIE_WORKSPACE_PACKAGES = [
	"@pie-framework/pie-assessment-player",
	"@pie-framework/pie-assessment-toolkit",
	"@pie-framework/pie-iife-player",
	"@pie-framework/pie-players-shared",
	"@pie-framework/pie-tool-toolbar",
	"@pie-framework/pie-tool-answer-eliminator",
	"@pie-framework/pie-tool-calculator",
	"@pie-framework/pie-tool-color-scheme",
	"@pie-framework/pie-tool-graph",
	"@pie-framework/pie-tool-line-reader",
	"@pie-framework/pie-tool-magnifier",
	"@pie-framework/pie-tool-periodic-table",
	"@pie-framework/pie-tool-protractor",
	"@pie-framework/pie-tool-ruler",
	"@pie-framework/pie-tool-annotation-toolbar",
	"@pie-framework/pie-tool-text-to-speech",
];

const logger = createLogger("info", { allowClearScreen: false });
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
	if (typeof msg === "string" && msg.includes("Use of eval in")) {
		return;
	}
	originalWarn(msg, options);
};

export default defineConfig(async () => {
	const localEsmCdn = await createLocalEsmCdnPlugin();

	return {
		// Keep build output clean; the example app vendors large prebuilt packages
		// that emit known eval warnings.
		logLevel: "error",
		plugins: [
			// Disable Lightning CSS optimization to avoid @property warnings from DaisyUI.
			tailwindcss({ optimize: false }),
			sveltekit(),
			localEsmCdn, // Serves /@pie-element/* routes from sibling repo if available
		].filter(Boolean),
		customLogger: logger,
		esbuild: {
			// Silence eval warnings originating from bundled dist outputs.
			logOverride: {
				"direct-eval": "silent",
			},
		},
		// Ensure workspace packages remain "live" in dev:
		// - avoid Vite dependency pre-bundling caching them
		// - watch file changes under monorepo root
		optimizeDeps: {
			exclude: PIE_WORKSPACE_PACKAGES,
		},
		resolve: {
			// Important for monorepos: treat linked workspace packages as their real paths.
			// This helps the dev server notice updates to their dist outputs.
			preserveSymlinks: false,
		},
		server: {
			port: 5200,
			fs: {
				allow: [".."],
			},
		},
		build: {
			// The example app bundles large player packages; keep output clean.
			chunkSizeWarningLimit: 6000,
		},
	};
});
