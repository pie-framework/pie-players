import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * The IIFE adapter's integrity check in Chromium: the browser's SRI refuses a
 * tampered bundle, the adapter's diagnosis names the served digest, and the
 * retry loop stops. Bundles the built `dist/loaders/iife-adapter.js`, so
 * `bun run build:e2e:players-shared` runs first.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "dist/loaders/iife-adapter.js");
const PAGE_ORIGIN = "https://host.pie.test";
const BUNDLE_URL = "https://bundles.pie.test/bundles/abc/player.js";
const ELEMENTS = { "pie-passage": "@pie-element/passage@2.10.5" };

let bundledCode: string;

test.beforeAll(async () => {
	if (!existsSync(ENTRY)) {
		throw new Error(
			`[bundle-integrity.spec] ${ENTRY} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
		);
	}
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieIifeUnderTest",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

function sri(body: string): string {
	return `sha384-${createHash("sha384").update(body).digest("base64")}`;
}

/** Serves `body` as the bundle and returns a counter of its requests. */
async function openPage(page: Page, body: string): Promise<{ hits: number }> {
	const counter = { hits: 0 };
	await page.route("https://bundles.pie.test/**", (route) => {
		counter.hits += 1;
		return route.fulfill({
			status: 200,
			contentType: "application/javascript",
			headers: { "access-control-allow-origin": "*" },
			body,
		});
	});
	await page.route(`${PAGE_ORIGIN}/**`, (route) =>
		route.fulfill({
			status: 200,
			contentType: "text/html",
			body: `<!doctype html><html><head></head><body><script>${bundledCode.replaceAll("</script", "<\\/script")}</script></body></html>`,
		}),
	);
	await page.goto(`${PAGE_ORIGIN}/`);
	return counter;
}

type LoadOutcome = {
	reasons: Array<Record<string, unknown>>;
	events: Array<Record<string, unknown>>;
	ran: unknown;
	scriptAttributes: { integrity: string | null; crossorigin: string | null };
};

function loadInPage(
	page: Page,
	config: Record<string, unknown>,
): Promise<LoadOutcome> {
	return page.evaluate(
		async ({ config, elements, bundleUrl }) => {
			const events: Array<Record<string, unknown>> = [];
			window.addEventListener("pie-bundle-integrity-failed", (event) =>
				events.push({ ...(event as CustomEvent).detail }),
			);
			const api = (window as any).PieIifeUnderTest;
			const backend = api.createIifeBackend({
				kind: "iife",
				bundleHost: "https://bundles.pie.test/bundles/",
				bundleInfo: { url: bundleUrl },
				bundleRetry: { retryDelayMs: 50, timeoutMs: 1500 },
				...config,
			});
			let reasons: Array<Record<string, unknown>> = [];
			try {
				await backend.load(elements, {
					doc: document,
					whenDefinedTimeoutMs: 100,
				});
			} catch (error) {
				reasons = [...((error as any).reasons?.values() ?? [])];
			}
			const script = document.querySelector("script[data-pie-bundle]");
			return {
				reasons,
				events,
				ran: (window as any).__ran,
				scriptAttributes: {
					integrity: script?.getAttribute("integrity") ?? null,
					crossorigin: script?.getAttribute("crossorigin") ?? null,
				},
			};
		},
		{ config, elements: ELEMENTS, bundleUrl: BUNDLE_URL },
	);
}

test.describe("IIFE bundle integrity (Chromium)", () => {
	test("refuses a tampered bundle, names its digest and stops retrying", async ({
		page,
	}) => {
		const served = "window.__ran = true;";
		const expected = sri("window.__ran = 'original';");
		const counter = await openPage(page, served);
		const outcome = await loadInPage(page, {
			integrity: { [BUNDLE_URL]: expected },
		});

		expect(outcome.ran).toBeUndefined();
		expect(outcome.reasons).toHaveLength(1);
		expect(outcome.reasons[0]).toMatchObject({
			kind: "integrity-failed",
			tag: "pie-passage",
			cause: "mismatch",
			expected,
			actual: sri(served),
		});
		expect(outcome.events).toEqual([
			{
				url: `${BUNDLE_URL}?elements=pie-passage`,
				cause: "mismatch",
				expected,
				actual: sri(served),
			},
		]);
		// The script request and the diagnostic fetch; a retry would add more.
		expect(counter.hits).toBeLessThanOrEqual(2);
	});

	test("runs a bundle whose bytes match, with SRI and CORS on its script", async ({
		page,
	}) => {
		const served = "window.__ran = true; window.pie = { default: {} };";
		await openPage(page, served);
		const outcome = await loadInPage(page, {
			integrity: { [BUNDLE_URL]: sri(served) },
		});

		expect(outcome.ran).toBe(true);
		expect(outcome.scriptAttributes).toEqual({
			integrity: sri(served),
			crossorigin: "anonymous",
		});
		expect(outcome.events).toEqual([]);
		expect(outcome.reasons[0]).toMatchObject({ kind: "package-not-in-bundle" });
	});

	test("requireIntegrity refuses a bundle without a hash before requesting it", async ({
		page,
	}) => {
		const counter = await openPage(page, "window.__ran = true;");
		const outcome = await loadInPage(page, { requireIntegrity: true });

		expect(counter.hits).toBe(0);
		expect(outcome.ran).toBeUndefined();
		expect(outcome.reasons[0]).toMatchObject({
			kind: "integrity-failed",
			cause: "missing",
		});
		expect(outcome.events).toHaveLength(1);
	});
});
