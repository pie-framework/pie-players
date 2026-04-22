import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { wrapOverwideImages } from "../src/security/wrap-overwide-images.js";

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("wrapOverwideImages", () => {
	test("wraps a bare <img> in a .pie-image-scroll span", () => {
		const out = wrapOverwideImages('<p>See diagram:</p><img src="/x.png" alt="cell">');
		expect(out).toContain('<span class="pie-image-scroll"');
		expect(out).toContain("tabindex=\"0\"");
		expect(out).toContain("role=\"region\"");
		expect(out).toContain('aria-label="Scrollable image: cell"');
		expect(out).toContain('src="/x.png"');
		expect(out).toContain('alt="cell"');
	});

	test("wraps every <img> when multiple are present", () => {
		const out = wrapOverwideImages(
			'<img src="/a.png" alt="a"><p>between</p><img src="/b.png" alt="b">',
		);
		const matches = out.match(/class="pie-image-scroll"/g) ?? [];
		expect(matches.length).toBe(2);
	});

	test("preserves alt, src, class, id, and data-* attributes on the image", () => {
		const html =
			'<img id="diag1" src="/d.png" alt="diagram" class="authored" data-foo="bar" data-baz="qux">';
		const out = wrapOverwideImages(html);
		expect(out).toContain('id="diag1"');
		expect(out).toContain('src="/d.png"');
		expect(out).toContain('alt="diagram"');
		expect(out).toContain('class="authored"');
		expect(out).toContain('data-foo="bar"');
		expect(out).toContain('data-baz="qux"');
	});

	test("falls back to a generic aria-label when alt is missing or blank", () => {
		const outNoAlt = wrapOverwideImages('<img src="/x.png">');
		expect(outNoAlt).toContain('aria-label="Scrollable image"');
		const outBlankAlt = wrapOverwideImages('<img src="/x.png" alt="   ">');
		expect(outBlankAlt).toContain('aria-label="Scrollable image"');
	});

	test("is idempotent — does not double-wrap images it has already wrapped", () => {
		const once = wrapOverwideImages('<img src="/x.png" alt="a">');
		const twice = wrapOverwideImages(once);
		const matches = twice.match(/class="pie-image-scroll"/g) ?? [];
		expect(matches.length).toBe(1);
	});

	test("leaves images inside PIE custom elements alone", () => {
		const html =
			'<pie-multiple-choice><img src="/internal.png" alt="inside"></pie-multiple-choice><img src="/outside.png" alt="outside">';
		const out = wrapOverwideImages(html);
		// inside image untouched
		expect(out).toMatch(
			/<pie-multiple-choice[^>]*>\s*<img[^>]*src="\/internal.png"[^>]*>\s*<\/pie-multiple-choice>/,
		);
		// outside image wrapped
		expect(out).toMatch(
			/<span class="pie-image-scroll"[^>]*>\s*<img[^>]*src="\/outside.png"/,
		);
		// wrapper never appears inside the custom element
		const wrappedInsidePattern =
			/<pie-multiple-choice[^>]*>[^<]*<span class="pie-image-scroll"/;
		expect(wrappedInsidePattern.test(out)).toBe(false);
	});

	test("leaves images nested deep inside a PIE custom element alone", () => {
		const html =
			'<pie-prompt><figure><img src="/deep.png" alt="deep"></figure></pie-prompt>';
		const out = wrapOverwideImages(html);
		expect(out).not.toContain("pie-image-scroll");
		expect(out).toContain('<img src="/deep.png" alt="deep">');
	});

	test("returns empty string for empty input", () => {
		expect(wrapOverwideImages("")).toBe("");
		expect(wrapOverwideImages(undefined as unknown as string)).toBe("");
		expect(wrapOverwideImages(null as unknown as string)).toBe("");
	});

	test("returns markup unchanged when there is no <img>", () => {
		const html = "<p>just text <strong>here</strong></p>";
		expect(wrapOverwideImages(html)).toBe(html);
	});
});
