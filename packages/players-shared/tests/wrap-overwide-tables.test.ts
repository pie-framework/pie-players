import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { wrapOverwideTables } from "../src/security/wrap-overwide-tables.js";

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

describe("wrapOverwideTables", () => {
	test("wraps a bare <table> in a .pie-table-scroll div", () => {
		const out = wrapOverwideTables(
			"<p>Below is the data:</p><table><tr><td>cell</td></tr></table>",
		);
		expect(out).toContain('<div class="pie-table-scroll"');
		expect(out).toContain('tabindex="0"');
		expect(out).toContain('role="region"');
		expect(out).toContain('aria-label="Scrollable table"');
		expect(out).toContain("<table>");
		expect(out).toContain("<td>cell</td>");
	});

	test("wraps every <table> when multiple are present", () => {
		const out = wrapOverwideTables(
			"<table><tr><td>a</td></tr></table><p>between</p><table><tr><td>b</td></tr></table>",
		);
		const matches = out.match(/class="pie-table-scroll"/g) ?? [];
		expect(matches.length).toBe(2);
	});

	test("preserves table attributes and inner structure", () => {
		const html =
			'<table id="grid1" class="data" data-foo="bar" summary="x"><thead><tr><th>H</th></tr></thead><tbody><tr><td>v</td></tr></tbody></table>';
		const out = wrapOverwideTables(html);
		expect(out).toContain('id="grid1"');
		expect(out).toContain('class="data"');
		expect(out).toContain('data-foo="bar"');
		expect(out).toContain("<thead>");
		expect(out).toContain("<tbody>");
		expect(out).toContain("<th>H</th>");
		expect(out).toContain("<td>v</td>");
	});

	test("derives aria-label from the table caption", () => {
		const out = wrapOverwideTables(
			"<table><caption>Population by year</caption><tr><td>1</td></tr></table>",
		);
		expect(out).toContain('aria-label="Scrollable table: Population by year"');
	});

	test("prefers explicit aria-label on the <table> over caption", () => {
		const out = wrapOverwideTables(
			'<table aria-label="Stats"><caption>Caption text</caption><tr><td>1</td></tr></table>',
		);
		expect(out).toContain('aria-label="Scrollable table: Stats"');
		expect(out).not.toContain("Scrollable table: Caption text");
	});

	test("resolves aria-labelledby to the labelling element's text", () => {
		const out = wrapOverwideTables(
			'<h3 id="t-label">Country populations</h3><table aria-labelledby="t-label"><tr><td>1</td></tr></table>',
		);
		expect(out).toContain('aria-label="Scrollable table: Country populations"');
	});

	test("falls back to a generic aria-label when no caption / aria label is present", () => {
		const out = wrapOverwideTables("<table><tr><td>only</td></tr></table>");
		expect(out).toContain('aria-label="Scrollable table"');
	});

	test("is idempotent — does not double-wrap tables it has already wrapped", () => {
		const once = wrapOverwideTables("<table><tr><td>a</td></tr></table>");
		const twice = wrapOverwideTables(once);
		const matches = twice.match(/class="pie-table-scroll"/g) ?? [];
		expect(matches.length).toBe(1);
	});

	test("leaves tables inside PIE custom elements alone", () => {
		const html =
			"<pie-multiple-choice><table><tr><td>internal</td></tr></table></pie-multiple-choice><table><tr><td>outside</td></tr></table>";
		const out = wrapOverwideTables(html);
		expect(out).toMatch(
			/<pie-multiple-choice[^>]*>\s*<table[^>]*>[\s\S]*?internal[\s\S]*?<\/table>\s*<\/pie-multiple-choice>/,
		);
		expect(out).toMatch(
			/<div class="pie-table-scroll"[^>]*>\s*<table[^>]*>[\s\S]*?outside/,
		);
		const wrappedInsidePattern =
			/<pie-multiple-choice[^>]*>[^<]*<div class="pie-table-scroll"/;
		expect(wrappedInsidePattern.test(out)).toBe(false);
	});

	test("leaves tables nested deep inside a PIE custom element alone", () => {
		const html =
			"<pie-prompt><figure><table><tr><td>deep</td></tr></table></figure></pie-prompt>";
		const out = wrapOverwideTables(html);
		expect(out).not.toContain("pie-table-scroll");
		expect(out).toContain("<table>");
		expect(out).toContain("deep");
	});

	test("returns empty string for empty input", () => {
		expect(wrapOverwideTables("")).toBe("");
		expect(wrapOverwideTables(undefined as unknown as string)).toBe("");
		expect(wrapOverwideTables(null as unknown as string)).toBe("");
	});

	test("returns markup unchanged when there is no <table>", () => {
		const html = "<p>just text <strong>here</strong></p>";
		expect(wrapOverwideTables(html)).toBe(html);
	});
});
