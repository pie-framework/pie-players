import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	// Keep tests fast locally, but avoid CI flakiness by limiting workers there.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// Hard cap per-test runtime so failures never hang indefinitely.
	timeout: process.env.CI ? 60_000 : 30_000,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 4,
	reporter: "html",
	expect: {
		// Default expectation timeout; individual waits can override.
		timeout: process.env.CI ? 20_000 : 10_000,
	},
	use: {
		baseURL: "http://127.0.0.1:5200",
		trace: "on-first-retry",
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
