import { defineConfig, devices } from "@playwright/test";

/**
 * No `webServer`/`baseURL` here, unlike the item-player/section-player/
 * assessment-player configs. Those drive a real running app over HTTP; this
 * suite only needs a real browser engine to run a bundled module against a
 * blank page via `page.setContent` + `page.addScriptTag`. See
 * `tests/e2e/markup-processor.spec.ts` for why that distinction matters here
 * specifically: DOMPurify's behavior under happy-dom cannot be trusted, so
 * this is the one place that behavior must be verified for real. Mirrors
 * `packages/players-shared/playwright.config.ts`.
 */
export default defineConfig({
	testDir: "./tests/e2e",
	// Not Playwright's default: that also claims the `*.test.ts` bun tests. See
	// AGENTS.md, "Playwright And Sandboxed Execution".
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	forbidOnly: false,
	retries: 0,
	workers: 1,
	reporter: "list",
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
