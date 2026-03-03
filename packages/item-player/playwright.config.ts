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
const webServerCommand = `bun run --cwd "${itemDemosCwd}" dev -- --host ${parsedBaseUrl.hostname} --port ${parsedBaseUrl.port || "80"}`;

export default defineConfig({
	testDir: "./tests",
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
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
