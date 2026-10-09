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
const ICON_ENTRY = path.join(
	PACKAGE_ROOT,
	"dist/security/sanitize-svg-icon.js",
);

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

	test("an allowedCustomElements entry cannot admit a forbidden tag", async ({
		page,
	}) => {
		const out = await sanitizeInPage(page, "<script>bad()</script><p>ok</p>", {
			allowedCustomElements: ["script"],
		});
		expect(out).toBe("<p>ok</p>");
	});

	test.describe("MathML", () => {
		const unchanged = {
			stack:
				'<math><mstack stackalign="right" charalign="center" charspacing="loose"><mscarries location="n" crossout="updiagonalstrike" position="1"><mscarry location="nw" crossout="none"><mn>1</mn></mscarry><none/></mscarries><mn>19</mn><msgroup position="0" shift="1"><msrow position="0"><mo>+</mo><mn>3</mn></msrow></msgroup><msline position="0" length="2" leftoverhang="1" rightoverhang="1" mslinethickness="thin"></msline><mn>22</mn></mstack></math>',
			longDivision:
				'<math><mlongdiv longdivstyle="lefttop"><mn>4</mn><mn>12</mn><mn>48</mn><msline length="1"></msline><mn>8</mn></mlongdiv></math>',
			lineBreak:
				'<math><mi>a</mi><mspace linebreak="newline"></mspace><mi>b</mi></math>',
			annotation:
				'<math><semantics><mi>x</mi><annotation encoding="application/x-tex">x</annotation></semantics></math>',
			prescripts:
				"<math><mmultiscripts><mi>C</mi><none/><none/><mprescripts/><mn>14</mn><none/></mmultiscripts></math>",
			prefixed:
				"<mml:math><mml:mfrac><mml:mn>1</mml:mn><mml:mn>2</mml:mn></mml:mfrac></mml:math>",
		};

		for (const [name, markup] of Object.entries(unchanged)) {
			test(`keeps ${name} markup`, async ({ page }) => {
				const out = await sanitizeInPage(page, markup);
				// Serialization closes void MathML elements explicitly.
				expect(out).toBe(
					markup.replace(/<(none|mprescripts)\/>/g, "<$1></$1>"),
				);
			});
		}

		test("drops annotation-xml with its HTML", async ({ page }) => {
			const out = await sanitizeInPage(
				page,
				'<math><semantics><mi>x</mi><annotation-xml encoding="text/html"><img src="x" onerror="bad()"></annotation-xml></semantics></math>',
			);
			expect(out).not.toContain("annotation-xml");
			expect(out).not.toContain("onerror");
		});
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

	test.describe("style attributes", () => {
		// DOMPurify lists `style` among its URI-safe attributes, so it permits the
		// attribute and inspects nothing inside it. These assert the declaration
		// filter that closes the two things that reach the page through it: a
		// URL-fetching function, and `position: fixed` leaving the item's box.
		test("drops a declaration carrying url()", async ({ page }) => {
			const out = await sanitizeInPage(
				page,
				'<p style="color: red; background-image: url(https://evil.test/beacon.png)">x</p>',
			);
			expect(out).not.toContain("evil.test");
			expect(out).not.toContain("url(");
			// The rest of the declarations survive — the attribute is filtered,
			// not dropped.
			expect(out).toContain("color: red");
		});

		test("drops url() hidden behind a CSS escape", async ({ page }) => {
			// `\75 rl(` is `url(`. A raw-string filter misses it; the CSSOM
			// normalizes the function name before the check runs.
			const out = await sanitizeInPage(
				page,
				'<p style="background-image: \\75 rl(https://evil.test/beacon.png)">x</p>',
			);
			expect(out).not.toContain("evil.test");
			expect(out.toLowerCase()).not.toContain("url(");
		});

		test("drops url() hidden behind a comment or a quoted semicolon", async ({
			page,
		}) => {
			const commented = await sanitizeInPage(
				page,
				'<p style="background: /*x*/url(https://evil.test/a.png)">x</p>',
			);
			expect(commented).not.toContain("evil.test");

			// A naive split on ";" mis-slices this one; the surviving fragment
			// must not carry the URL either.
			const quoted = await sanitizeInPage(
				page,
				"<p style=\"background-image: url('https://evil.test/a;b.png')\">x</p>",
			);
			expect(quoted).not.toContain("evil.test");
		});

		test("drops position: fixed and keeps the other declarations", async ({
			page,
		}) => {
			const out = await sanitizeInPage(
				page,
				'<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgb(255, 255, 255)">x</div>',
			);
			expect(out).not.toContain("fixed");
			expect(out).toContain("width: 100vw");
		});

		test("keeps position: absolute, which MathJax assistive MathML needs", async ({
			page,
		}) => {
			// mjx-assistive-mml carries `position: absolute; width: 1px;
			// height: 1px; overflow: hidden` to expose MathML to a screen reader
			// while hiding it visually. Filtering it would take that with it.
			const out = await sanitizeInPage(
				page,
				'<span style="position: absolute; width: 1px; height: 1px; overflow: hidden">math</span>',
			);
			expect(out).toContain("position: absolute");
			expect(out).toContain("overflow: hidden");
		});

		test("keeps position: sticky, which cannot leave its containing block", async ({
			page,
		}) => {
			const out = await sanitizeInPage(
				page,
				'<div style="position: sticky; top: 0">header</div>',
			);
			expect(out).toContain("position: sticky");
		});

		test("leaves an ordinary style attribute byte-identical", async ({
			page,
		}) => {
			// The fast path matters for more than cost: authored markup keeps its
			// own spelling, so a shorthand stays a shorthand rather than being
			// expanded into longhands by a CSSOM round-trip.
			const out = await sanitizeInPage(
				page,
				'<p style="color: red; margin: 0 auto; --pie-authored: 4px">x</p>',
			);
			expect(out).toContain(
				'style="color: red; margin: 0 auto; --pie-authored: 4px"',
			);
		});

		test("authored CSS cannot fetch from another origin", async ({ page }) => {
			// The end-to-end statement of the defect: sanitize, inject into the
			// live document, and assert the browser made no request to the
			// attacker origin.
			const requested: string[] = [];
			page.on("request", (request) => {
				if (request.url().includes("evil.test")) requested.push(request.url());
			});

			await page.evaluate(() => {
				const api = (
					window as unknown as {
						PieSanitizerUnderTest: {
							sanitizeItemMarkup: (m: string, o?: object) => string;
						};
					}
				).PieSanitizerUnderTest;
				const item = document.createElement("div");
				document.body.appendChild(item);
				item.innerHTML = api.sanitizeItemMarkup(
					'<p style="background-image: url(https://evil.test/beacon.png)">x</p>',
				);
			});
			// A style-driven fetch is triggered by layout, so force one and give
			// the request a chance to appear before asserting it never did.
			await page.evaluate(() => document.body.getBoundingClientRect().height);
			await page.waitForTimeout(250);

			expect(requested).toEqual([]);
		});

		test("sanitizeSvgIcon filters an icon's style attribute", async ({
			page,
		}) => {
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
					'<svg viewBox="0 0 16 16"><rect width="16" height="16" style="fill: red; background-image: url(https://evil.test/beacon.png)"></rect></svg>',
				);
			});
			expect(out).not.toContain("evil.test");
			expect(out).toContain("fill: red");
		});
	});

	test.describe("authored color markers", () => {
		// The classification itself is tested where it lives, in
		// @pie-element/shared-utils. These assert the wiring: item markup gets
		// the same markers element model HTML does. (PIE-1119)

		/** The markers on each marked element of the sanitized markup, in order. */
		function markersInPage(page: Page, markup: string) {
			return page.evaluate((markup) => {
				const api = (
					window as unknown as {
						PieSanitizerUnderTest: {
							sanitizeItemMarkup: (m: string) => string;
						};
					}
				).PieSanitizerUnderTest;
				const template = document.createElement("template");
				template.innerHTML = api.sanitizeItemMarkup(markup);
				return [
					...template.content.querySelectorAll(
						"[data-pie-authored-ink], [data-pie-authored-fill], [data-pie-authored-border]",
					),
				].map((el) => ({
					tag: el.localName,
					ink: el.hasAttribute("data-pie-authored-ink"),
					fill: el.getAttribute("data-pie-authored-fill"),
					border: el.hasAttribute("data-pie-authored-border"),
				}));
			}, markup);
		}

		test("marks authored ink, fills and borders", async ({ page }) => {
			const marked = await markersInPage(
				page,
				'<p style="color: rgb(81, 82, 84); background-color: rgb(255, 255, 255)">x</p>' +
					'<table><tbody><tr bgcolor="lightgrey"><td style="border: 1px solid black">x</td></tr></tbody></table>' +
					'<span style="color: var(--pie-text); background-color: transparent">x</span>',
			);
			expect(marked).toEqual([
				{ tag: "p", ink: true, fill: "light", border: false },
				{ tag: "tr", ink: false, fill: "shade", border: false },
				{ tag: "td", ink: false, fill: null, border: true },
			]);
		});

		test("marks a fill the style filter keeps from a shorthand it filters", async ({
			page,
		}) => {
			const marked = await markersInPage(
				page,
				'<div style="background: #ddd url(https://evil.test/a.png)">x</div>',
			);
			expect(marked).toEqual([
				{ tag: "div", ink: false, fill: "shade", border: false },
			]);
		});

		test("drops !important from a marked declaration only", async ({ page }) => {
			// An inline !important outranks the scheme stylesheet's own.
			const priorities = await page.evaluate(() => {
				const api = (
					window as unknown as {
						PieSanitizerUnderTest: {
							sanitizeItemMarkup: (m: string) => string;
						};
					}
				).PieSanitizerUnderTest;
				const template = document.createElement("template");
				template.innerHTML = api.sanitizeItemMarkup(
					'<span style="color: red !important; font-weight: bold !important">x</span>',
				);
				const span = template.content.querySelector("span") as HTMLElement;
				return {
					color: span.style.getPropertyPriority("color"),
					fontWeight: span.style.getPropertyPriority("font-weight"),
				};
			});
			expect(priorities).toEqual({ color: "", fontWeight: "important" });
		});

		test("recomputes markers the author wrote", async ({ page }) => {
			const marked = await markersInPage(
				page,
				'<p data-pie-authored-fill="light" data-pie-authored-border style="background-color: navy">x</p>' +
					'<p data-pie-authored-ink>x</p>',
			);
			expect(marked).toEqual([
				{ tag: "p", ink: false, fill: "shade", border: false },
			]);
		});

		test("keeps the markers inside the overwide wrappers", async ({ page }) => {
			const out = await sanitizeInPage(
				page,
				'<table><tbody><tr><th style="background-color: rgb(221, 221, 221)">h</th></tr></tbody></table>',
			);
			expect(out).toContain("pie-table-scroll");
			expect(out).toContain('data-pie-authored-fill="shade"');
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
