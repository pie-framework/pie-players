import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { viteListeningOn } from "../../scripts/lib/playwright-web-server.mjs";

/**
 * The delivery-cost harness (`perf/`): measurements, not assertions, so no
 * gate runs it. `bun run perf:delivery-cost` builds section-demos for
 * production and serves the build, since a dev server's unbundled modules
 * would be counted as the host's requests. The harness sets the tablet
 * emulation itself, per browser context.
 */
const configDir = dirname(fileURLToPath(import.meta.url));
const sectionDemosDir = resolve(configDir, "../../apps/section-demos");
const host = process.env.SECTION_DEMOS_HOST || "127.0.0.1";
const port = Number(process.env.SECTION_DEMOS_PORT || "5310");
const baseURL = `http://${host}:${port}`;

export default defineConfig({
	testDir: "./perf",
	testMatch: /.*\.perf\.ts/,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: "list",
	timeout: 60 * 60_000,
	use: { baseURL, browserName: "chromium" },
	webServer: {
		command: `bun run --cwd "${sectionDemosDir}" preview --host ${host} --port ${port} --strictPort`,
		wait: viteListeningOn(baseURL),
		timeout: 60_000,
		env: { BROWSER: "none" },
	},
});
