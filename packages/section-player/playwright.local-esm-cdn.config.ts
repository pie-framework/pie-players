import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Section demos under `dev:section:cdn`, whose dev server also serves a built
 * pie-elements-ng checkout: `PIE_ELEMENTS_NG_PATH`, else the sibling
 * `../pie-elements-ng`. Not part of CI, which has no checkout.
 */
const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceRootCwd = resolve(configDir, "../..");
const pieElementsNgRoot = resolve(
	process.env.PIE_ELEMENTS_NG_PATH ||
		resolve(workspaceRootCwd, "../pie-elements-ng"),
);
if (!existsSync(pieElementsNgRoot)) {
	throw new Error(
		`pie-elements-ng not found at ${pieElementsNgRoot}; set PIE_ELEMENTS_NG_PATH`,
	);
}
// The spec reads the checkout path from here.
process.env.PIE_ELEMENTS_NG_PATH = pieElementsNgRoot;
const sectionDemosHost = process.env.SECTION_DEMOS_HOST || "127.0.0.1";
const sectionDemosPort = Number(process.env.SECTION_DEMOS_PORT || "5300");
const baseURL = `http://${sectionDemosHost}:${sectionDemosPort}`;

export default defineConfig({
	testDir: "./tests/local-esm-cdn",
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	forbidOnly: false,
	retries: 0,
	workers: 1,
	reporter: "list",
	use: {
		baseURL,
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: `bun run --cwd "${workspaceRootCwd}" dev:section:cdn -- --host ${sectionDemosHost} --port ${sectionDemosPort}`,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			PLAYWRIGHT_DISABLE_VITE_OVERLAY: "1",
			PIE_ELEMENTS_NG_PATH: pieElementsNgRoot,
			LOCAL_ESM_CDN_SKIP_BUILD: "1",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
