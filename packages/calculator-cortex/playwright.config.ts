import { defineConfig } from "@playwright/test";
import { viteListeningOn } from "../../scripts/lib/playwright-web-server.mjs";

const port = process.env.CALCULATOR_CORTEX_DEMO_PORT || "5617";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: "./e2e",
	// Not Playwright's default: that also claims the `*.test.ts` bun tests. See
	// AGENTS.md, "Playwright And Sandboxed Execution".
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	use: {
		baseURL,
		headless: true,
	},
	webServer: {
		command: `bunx vite demo --host 127.0.0.1 --port ${port} --strictPort`,
		wait: viteListeningOn(baseURL),
		timeout: 30_000,
	},
});
