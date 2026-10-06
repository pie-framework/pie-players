import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const itemDemosCwd = resolve(configDir, "../../apps/item-demos");
const itemDemosHost = process.env.ITEM_DEMOS_HOST || "127.0.0.1";
const itemDemosPort = Number(process.env.ITEM_DEMOS_PORT || "5400");
const defaultBaseUrl = `http://${itemDemosHost}:${itemDemosPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || defaultBaseUrl;
const parsedBaseUrl = new URL(baseURL);
const webServerCommand = `bun run --cwd "${itemDemosCwd}" dev -- --host ${parsedBaseUrl.hostname} --port ${parsedBaseUrl.port || "80"} --strictPort`;

export default defineConfig({
	testDir: "./tests",
	// Playwright's default testMatch also claims `*.test.ts`, and those are bun
	// tests importing `bun:test` — one in testDir aborts discovery for the whole
	// suite. See AGENTS.md, "Playwright And Sandboxed Execution".
	testMatch: /.*\.spec\.ts/,
	// Owned by playwright.backend.config.ts, which serves apps/backend-demos.
	testIgnore: /backend-demo-(delivery|section)\.spec\.ts/,
	fullyParallel: false,
	forbidOnly: false,
	// One retry in CI, none locally. develop requires these suites, so a single
	// intermittent failure otherwise reds a required check; a local retry would
	// only hide the flake from whoever can debug it.
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: "list",
	use: {
		baseURL,
		screenshot: "on",
		video: "retain-on-failure",
	},
	webServer: {
		command: webServerCommand,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		// Suppress vite's dev-only crash overlay so it can't intercept clicks
		// when something throws unhandled (e.g. lazy-loaded module errors).
		env: { PLAYWRIGHT_DISABLE_VITE_OVERLAY: "1", BROWSER: "none" },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		// The esm strategy's import maps: Firefox rejects a map added after the
		// page's first module load, or after another map, so the player loads
		// through es-module-shims there.
		{
			name: "firefox",
			testMatch: /item-player-(esm-editor-runtime|multiple-choice)\.spec\.ts/,
			grep: /\besm\b/,
			use: { ...devices["Desktop Firefox"] },
		},
		// Focus order: WebKit does not focus a clicked button.
		{
			name: "firefox-focus",
			testMatch: /item-player-focus-leave-flush\.spec\.ts/,
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			testMatch: /item-player-focus-leave-flush\.spec\.ts/,
			use: { ...devices["Desktop Safari"] },
		},
	],
});
