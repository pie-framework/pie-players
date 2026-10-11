import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import { viteListeningOn } from "../lib/playwright-web-server.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

/** Vite's ready line as it writes it to a pipe, port in bold. */
function viteLocalLine(origin, port) {
	return `  \u001b[32m➜\u001b[39m  \u001b[1mLocal\u001b[22m:   \u001b[36m${origin}:\u001b[1m${port}\u001b[22m/\u001b[39m\n`;
}

/** What Playwright matches `wait.stdout` against. */
function matches(wait, output) {
	return wait.stdout.test(stripVTControlCharacters(output));
}

describe("viteListeningOn", () => {
	test("matches vite's Local line for the base URL's host and port", () => {
		const wait = viteListeningOn("http://127.0.0.1:5400");
		expect(matches(wait, viteLocalLine("http://127.0.0.1", 5400))).toBe(true);
	});

	test("does not match a server on another port", () => {
		const wait = viteListeningOn("http://127.0.0.1:5400");
		expect(matches(wait, viteLocalLine("http://127.0.0.1", 5401))).toBe(false);
		expect(matches(wait, viteLocalLine("http://127.0.0.1", 54000))).toBe(false);
		expect(matches(wait, viteLocalLine("http://localhost", 5400))).toBe(false);
	});

	test("does not match vite giving up on a taken port", () => {
		const wait = viteListeningOn("http://127.0.0.1:5400");
		expect(
			matches(
				wait,
				"error when starting dev server:\nError: Port 5400 is already in use\n",
			),
		).toBe(false);
	});

	test("takes the scheme's default port when the URL names none", () => {
		const wait = viteListeningOn("http://localhost");
		expect(matches(wait, viteLocalLine("http://localhost", 80))).toBe(true);
	});
});

function playwrightConfigsWithWebServer() {
	const packagesDir = path.join(REPO_ROOT, "packages");
	const configs = [];
	for (const pkg of readdirSync(packagesDir)) {
		const pkgDir = path.join(packagesDir, pkg);
		let entries;
		try {
			entries = readdirSync(pkgDir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!/^playwright(\..+)?\.config\.ts$/.test(entry)) continue;
			const file = path.join(pkgDir, entry);
			if (readFileSync(file, "utf8").includes("webServer:")) configs.push(file);
		}
	}
	return configs;
}

describe("Playwright e2e configs", () => {
	test("find the suites that start a dev server", () => {
		expect(playwrightConfigsWithWebServer().length).toBeGreaterThanOrEqual(6);
	});

	test("wait for their own dev server rather than any server on the port", async () => {
		const savedNgPath = process.env.PIE_ELEMENTS_NG_PATH;
		// The local ESM CDN config refuses to load without a checkout.
		process.env.PIE_ELEMENTS_NG_PATH = mkdtempSync(
			path.join(tmpdir(), "pie-elements-ng-"),
		);
		try {
			for (const file of playwrightConfigsWithWebServer()) {
				const { default: config } = await import(file);
				const servers = [config.webServer].flat();
				const origin = new URL(config.use.baseURL).origin;
				for (const server of servers) {
					expect({ file, url: server.url }).toEqual({ file, url: undefined });
					expect({
						file,
						ready: matches(server.wait, `  ➜  Local:   ${origin}/\n`),
					}).toEqual({ file, ready: true });
				}
			}
		} finally {
			if (savedNgPath === undefined) delete process.env.PIE_ELEMENTS_NG_PATH;
			else process.env.PIE_ELEMENTS_NG_PATH = savedNgPath;
		}
	}, 30_000);
});
