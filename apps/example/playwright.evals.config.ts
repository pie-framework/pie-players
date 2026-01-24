import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	// Evals live in a separate directory so they never run via the default e2e suite.
	testDir: "./tests/evals",
	// Keep evals deterministic and less resource-hungry: run sequentially by default.
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "html",
	use: {
		baseURL: "http://127.0.0.1:5200",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "bun run dev --host 127.0.0.1 --port 5200",
		url: "http://127.0.0.1:5200",
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
	},
});
