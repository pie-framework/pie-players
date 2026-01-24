import { defineConfig, devices } from "@playwright/test";

/**
 * Component-style browser tests that don't require a running dev server.
 * This is important in environments where binding localhost ports is blocked.
 */
export default defineConfig({
	testDir: "./tests/tools",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	timeout: process.env.CI ? 60_000 : 30_000,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 4,
	reporter: "html",
	use: {
		...devices["Desktop Chrome"],
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});

