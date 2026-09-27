import { defineConfig } from "@playwright/test";

const port = process.env.CALCULATOR_CORTEX_DEMO_PORT || "5617";

export default defineConfig({
	testDir: "./e2e",
	// Not Playwright's default: that also claims the `*.test.ts` bun tests. See
	// AGENTS.md, "Playwright And Sandboxed Execution".
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		headless: true,
	},
	webServer: {
		command: `bunx vite demo --host 127.0.0.1 --port ${port} --strictPort`,
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: false,
		timeout: 30_000,
	},
});
