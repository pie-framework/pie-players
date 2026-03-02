import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const sectionDemosCwd = resolve(configDir, "../../apps/section-demos");
const sectionDemosHost = process.env.SECTION_DEMOS_HOST || "127.0.0.1";
const sectionDemosPort = Number(process.env.SECTION_DEMOS_PORT || "5300");
const defaultBaseUrl = `http://${sectionDemosHost}:${sectionDemosPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || defaultBaseUrl;
const parsedBaseUrl = new URL(baseURL);
const webServerCommand = `bun --bun run --cwd "${sectionDemosCwd}" dev -- --host ${parsedBaseUrl.hostname} --port ${parsedBaseUrl.port || "80"}`;

export default defineConfig({
	testDir: "./tests",
	testMatch: /.*\.spec\.ts/,
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
		reuseExistingServer: true,
		timeout: 120_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
