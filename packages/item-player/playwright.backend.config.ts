import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const backendDemosCwd = resolve(configDir, "../../apps/backend-demos");
const backendDemosHost = process.env.BACKEND_DEMOS_HOST || "127.0.0.1";
const backendDemosPort = Number(process.env.BACKEND_DEMOS_PORT || "5600");
const defaultBaseUrl = `http://${backendDemosHost}:${backendDemosPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || defaultBaseUrl;
const parsedBaseUrl = new URL(baseURL);
const webServerCommand = `bun run --cwd "${backendDemosCwd}" dev -- --host ${parsedBaseUrl.hostname} --port ${parsedBaseUrl.port || "80"}`;

export default defineConfig({
	testDir: "./tests",
	testMatch: /backend-demo-(delivery|section)\.spec\.ts/,
	fullyParallel: false,
	forbidOnly: false,
	retries: 0,
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
		// Suppress vite's dev-only crash overlay so it can't intercept clicks.
		env: { PLAYWRIGHT_DISABLE_VITE_OVERLAY: "1" },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
