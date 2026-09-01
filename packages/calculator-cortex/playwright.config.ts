import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	// Not Playwright's default: that also claims the `*.test.ts` bun tests. See
	// AGENTS.md, "Playwright And Sandboxed Execution".
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:5617",
		headless: true,
	},
	webServer: {
		command: "bunx vite demo --host 127.0.0.1 --port 5617 --strictPort",
		url: "http://127.0.0.1:5617",
		reuseExistingServer: false,
		timeout: 30_000,
	},
});
