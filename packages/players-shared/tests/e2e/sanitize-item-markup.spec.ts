import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies `sanitizeItemMarkup` in a real browser engine, against the actual
 * built module — not a hand-rolled reproduction of its DOMPurify config.
 *
 * Why this suite exists rather than living entirely in
 * `tests/sanitize-item-markup.test.ts` (bun:test + happy-dom): DOMPurify
 * >=3.4.8 fails to sanitize under happy-dom. Confirmed 2026-08-06 — with no
 * config at all it returns `<script>` markup unchanged while reporting
 * `isSupported: true` and `removed: []`, and with this module's real config it
 * drops unrelated tags (an `<img>` vanished from output that never mentioned
 * images). Bisected: 3.4.7 passes under happy-dom, 3.4.8 does not. The same
 * calls behave correctly in real Chromium — verified against this exact
 * bundle before this suite was written — so the break is a happy-dom/DOMPurify
 * incompatibility, not a shipped-code regression. happy-dom is test-only, so
 * production is unaffected; the tests must not be.
 *
 * Every assertion here is one that depends on DOMPurify's sanitize() pass
 * actually running correctly: script/handler stripping, protocol rejection,
 * custom-element allow/deny, and the sanitizer-factory wiring that threads
 * through to it. `tests/sanitize-item-markup.test.ts` keeps only what never
 * touches the purifier (the empty-markup short-circuit, and the pure string
 * logic in `buildAuthoringAllowList`) — everything else moved here rather
 * than staying duplicated, because a happy-dom assertion that happens to pass
 * today is not evidence the sanitizer works; only a real browser is.
 *
 * Bundles the *compiled* `dist/security/sanitize-item-markup.js`, not the TS
 * source: the source uses `./foo.js` specifiers for sibling `.ts` files (a
 * TS 5 NodeNext authoring convention), which only resolve after `tsc` has
 * emitted real `.js` files next to them. Requires the package to be built
 * first — `bun run build:e2e:players-shared`, wired into
 * `test:e2e:players-shared` in the root package.json.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "dist/security/sanitize-item-markup.js");
// `sanitizeSvgIcon` shares `SANITIZER_FORBIDDEN_TAGS` with the markup
// sanitizer, so a change to that list has to be asserted against both
// consumers. Bundled separately because each module is its own entrypoint.
const ICON_ENTRY = path.join(PACKAGE_ROOT, "dist/security/sanitize-svg-icon.js");

let bundledCode: string;
let bundledIconCode: string;

async function bundleForBrowser(
	entry: string,
	globalName: string,
): Promise<string> {
	if (!existsSync(entry)) {
		throw new Error(
			`[sanitize-item-markup.spec] ${entry} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
		);
	}

	const result = await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName,
		target: "es2020",
		write: false,
	});

	return result.outputFiles[0].text;
}

test.beforeAll(async () => {
	bundledCode = await bundleForBrowser(ENTRY, "PieSanitizerUnderTest");
	bundledIconCode = await bundleForBrowser(
		ICON_ENTRY,
		"PieIconSanitizerUnderTest",
	);
});

async function loadSanitizer(page: Page) {
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });
}

/**
 * Runs `sanitizeItemMarkup` in the page. `markup`/`options` are serialized
 * across the `page.evaluate` boundary, so they must stay JSON-safe.
 */
function sanitizeInPage(
	page: Page,
	markup: string,
	options?: Record<string, unknown>,
) {
	return page.evaluate(
		({ markup, options }) => {
			const api = (
				window as unknown as {
					PieSanitizerUnderTest: {
						sanitizeItemMarkup: (m: string, o?: object) => string;
						createDefaultItemMarkupSanitizer: (
							o?: object,
						) => (m: string) => string;
					};
				}
			).PieSanitizerUnderTest;
			return api.sanitizeItemMarkup(markup, options);
		},
		{ markup, options },
	);
}

test.describe("sanitizeItemMarkup (real browser)", () => {
	test.beforeEach(async ({ page }) => {
		await loadSanitizer(page);
	});

	test("strips <script> tags entirely", async ({ page }) => {
		const out = await sanitizeInPage(
			page,
			"<p>Hello</p><script>alert('xss')</script><p>World</p>",
		);
		expect(out).not.toContain("<script");
		expect(out).not.toContain("alert");
		expect(out).toContain("<p>Hello</p>");
		expect(out).toContain("<p>World</p>");
	});

	test("drops event-handler attributes and keeps the element", async ({
		page,
	}) => {
		const out = await sanitizeInPage(
			page,
			'<img src="x" onerror="alert(1)"><button onclick="evil()">Go</button><svg onload="boom()"></svg>',
		);
		const lower = out.toLowerCase();
		expect(lower).not.toContain("onerror");
		expect(lower).not.toContain("onclick");
		expect(lower).not.toContain("onload");
		// The bug this guards against is real: under a broken purifier the
		// unrelated <img> vanished entirely rather than losing only its
		// handler. Confirm the element itself survives, not just the handler.
		expect(out).toContain('<img src="x">');
		expect(out).toContain(">Go</button>");
	});

	test("rejects javascript: URLs", async ({ page }) => {
		const out = await sanitizeInPage(
			page,
			'<a href="javascript:alert(1)">click</a>',
		);
		expect(out.toLowerCase()).not.toContain("javascript:");
	});

	test("preserves pie-* custom elements and their attributes", async ({
		page,
	}) => {
		const out = await sanitizeInPage(
			page,
			'<pie-multiple-choice id="q1" class="my" model-id="m1" session-id="s1"><span slot="label">pick</span></pie-multiple-choice>',
		);
		expect(out).toContain("<pie-multiple-choice");
		// pie-item contract compatibility: model lookup (updateSinglePieElement)
		// matches `pieElement.id` to `config.models[].id` by strict equality, so
		// the sanitizer must leave `id` untouched and not apply DOMPurify's
		// `user-content-` prefix via SANITIZE_NAMED_PROPS.
		expect(out).toContain('id="q1"');
		expect(out).not.toContain("user-content-");
		expect(out).toContain('model-id="m1"');
		expect(out).toContain('session-id="s1"');
	});

	test("strips unknown (non pie-*) custom elements by default", async ({
		page,
	}) => {
		const out = await sanitizeInPage(
			page,
			'<p>before</p><evil-widget onclick="x">hi</evil-widget><p>after</p>',
		);
		expect(out).not.toContain("<evil-widget");
		expect(out).toContain("<p>before</p>");
		expect(out).toContain("<p>after</p>");
	});

	test("respects an explicit allowedCustomElements list", async ({ page }) => {
		const out = await sanitizeInPage(page, "<my-widget>hello</my-widget>", {
			allowedCustomElements: ["my-widget"],
		});
		expect(out).toContain("<my-widget");
		expect(out).toContain("hello");
	});

	test("allows the authoring-mode -config variants when included in allow-list", async ({
		page,
	}) => {
		const out = await sanitizeInPage(
			page,
			'<pie-multiple-choice-config id="q1"></pie-multiple-choice-config>',
			{ allowedCustomElements: ["pie-multiple-choice-config"] },
		);
		expect(out).toContain("<pie-multiple-choice-config");
	});

	test("createDefaultItemMarkupSanitizer forwards allowedCustomElements", async ({
		page,
	}) => {
		const out = await page.evaluate(() => {
			const api = (
				window as unknown as {
					PieSanitizerUnderTest: {
						createDefaultItemMarkupSanitizer: (
							o?: object,
						) => (m: string) => string;
					};
				}
			).PieSanitizerUnderTest;
			const sanitize = api.createDefaultItemMarkupSanitizer({
				allowedCustomElements: ["my-widget"],
			});
			return sanitize("<my-widget><script>bad()</script></my-widget>");
		});
		expect(out).toContain("<my-widget");
		expect(out).not.toContain("<script");
	});

	test.describe("<style> elements", () => {
		// A <style> element is a document-global stylesheet and the item player
		// renders in light DOM, so authored CSS that survives here restyles the
		// host page, not just the item. The SVG case is the one that regressed:
		// DOMPurify's defaults drop a top-level HTML <style> on their own, but
		// its SVG profile keeps one, and an SVG <style>'s rules are just as
		// document-global. Both are asserted so neither half can quietly come
		// back.
		test("strips a top-level HTML <style> and its CSS text", async ({
			page,
		}) => {
			const out = await sanitizeInPage(
				page,
				"<style>body{display:none}</style><p>keep me</p>",
			);
			expect(out).not.toContain("<style");
			expect(out).not.toContain("display:none");
			expect(out).toContain("<p>keep me</p>");
		});

		test("strips a <style> nested in an <svg> and its CSS text", async ({
			page,
		}) => {
			const out = await sanitizeInPage(
				page,
				'<svg width="0" height="0"><style>#host-chrome{display:none}</style><circle r="5"></circle></svg><p>keep me</p>',
			);
			expect(out).not.toContain("<style");
			expect(out).not.toContain("host-chrome");
			expect(out).not.toContain("display:none");
			expect(out).toContain("<p>keep me</p>");
			// Forbidding the tag must not take the rest of the drawing with it.
			expect(out).toContain("<svg");
			expect(out).toContain("<circle");
		});

		test("authored CSS cannot reach an element outside the player", async ({
			page,
		}) => {
			// The end-to-end statement of the defect: sanitize, inject into a
			// light-DOM container, and assert host chrome elsewhere in the
			// document is untouched.
			const hostChromeDisplay = await page.evaluate(() => {
				const api = (
					window as unknown as {
						PieSanitizerUnderTest: {
							sanitizeItemMarkup: (m: string, o?: object) => string;
						};
					}
				).PieSanitizerUnderTest;

				const chrome = document.createElement("div");
				chrome.id = "host-chrome";
				chrome.textContent = "submit bar";
				document.body.appendChild(chrome);

				const item = document.createElement("div");
				document.body.appendChild(item);
				item.innerHTML = api.sanitizeItemMarkup(
					'<svg width="0" height="0"><style>#host-chrome{display:none !important}</style></svg>',
				);

				return getComputedStyle(chrome).display;
			});
			expect(hostChromeDisplay).not.toBe("none");
		});

		test("sanitizeSvgIcon strips a <style> from an icon", async ({ page }) => {
			await page.setContent("<!doctype html><html><body></body></html>");
			await page.addScriptTag({ content: bundledIconCode });
			const out = await page.evaluate(() => {
				const api = (
					window as unknown as {
						PieIconSanitizerUnderTest: {
							sanitizeSvgIcon: (icon: unknown) => string;
						};
					}
				).PieIconSanitizerUnderTest;
				return api.sanitizeSvgIcon(
					'<svg viewBox="0 0 16 16"><style>:root{--pie-text:red}</style><path d="M0 0h16v16H0z"></path></svg>',
				);
			});
			expect(out).not.toContain("<style");
			expect(out).not.toContain("--pie-text");
			expect(out).toContain("<path");
		});
	});

	test.describe("wrapOverwideContent", () => {
		const markup =
			'<img src="wide.png" alt="chart" width="1792" height="592"><table><tr><td>x</td></tr></table>';

		test("wraps overwide images and tables by default", async ({ page }) => {
			const out = await sanitizeInPage(page, markup);
			expect(out).toContain("pie-image-scroll");
			expect(out).toContain("pie-table-scroll");
			expect(out).toContain("wide.png");
			// `width` / `height` survive the allow-list and the wrapping pass.
			// Authored passages carry intrinsic dimensions (the
			// `question-passage` section demo's `<figure>` is the live case), and
			// dropping them changes layout rather than failing loudly. The
			// section-player wrapper tests cannot assert this — they run under
			// happy-dom, where DOMPurify does not sanitize at all.
			expect(out).toContain('width="1792"');
			expect(out).toContain('height="592"');
		});

		test("skips the wrappers when disabled, keeping the content", async ({
			page,
		}) => {
			// Print rendering needs this: the wrappers are `overflow-x: auto`, and
			// `overflow` clips rather than scrolls in print media, so a wide
			// image or table would be cut off at the column edge.
			const out = await sanitizeInPage(page, markup, {
				wrapOverwideContent: false,
			});
			expect(out).not.toContain("pie-image-scroll");
			expect(out).not.toContain("pie-table-scroll");
			expect(out).toContain("wide.png");
			expect(out).toContain("<table");
		});

		test("createDefaultItemMarkupSanitizer forwards the flag", async ({
			page,
		}) => {
			const out = await page.evaluate((markup) => {
				const api = (
					window as unknown as {
						PieSanitizerUnderTest: {
							createDefaultItemMarkupSanitizer: (
								o?: object,
							) => (m: string) => string;
						};
					}
				).PieSanitizerUnderTest;
				const sanitize = api.createDefaultItemMarkupSanitizer({
					wrapOverwideContent: false,
				});
				return sanitize(markup);
			}, markup);
			expect(out).not.toContain("pie-image-scroll");
		});
	});
});
