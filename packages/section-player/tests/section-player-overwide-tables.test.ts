/**
 * Authored `<table>` markup rendered by `pie-item-player` inside the section
 * player is wrapped in a horizontal-scroll container, so overwide tables
 * surface a scrollbar instead of being clipped by the section layout's
 * `overflow-x: hidden` ancestors.
 *
 * Mirrors `section-player-overwide-images.test.ts` but for `<table>` /
 * `wrapOverwideTables`, including why it calls the wrapper directly rather
 * than through `sanitizeItemMarkup`: DOMPurify >=3.4.8 does not sanitize under
 * happy-dom, so an assertion made downstream of a sanitize pass here proves
 * nothing about the sanitizer. See that file's header for the detail.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { wrapOverwideTables } from "@pie-players/pie-players-shared";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const PASSAGE_MARKUP = `
	<div class="passage-body">
		<p>The data below summarises Renaissance-era city populations:</p>
		<table>
			<caption>Renaissance city populations (1500)</caption>
			<thead>
				<tr><th>City</th><th>Population</th></tr>
			</thead>
			<tbody>
				<tr><td>Florence</td><td>70,000</td></tr>
			</tbody>
		</table>
		<p>Use it to answer the question.</p>
	</div>
`;

const ITEM_STEM_MARKUP = `
	<div class="item-stem">
		<p>Identify the largest city:</p>
		<table aria-label="Population summary"><tr><td>Florence</td></tr></table>
	</div>
`;

describe("section player authored table wrapping", () => {
	test("passage markup: wraps overwide <table> in a .pie-table-scroll container", () => {
		const out = wrapOverwideTables(PASSAGE_MARKUP);
		expect(out).toContain('class="pie-table-scroll"');
		expect(out).toContain(
			'aria-label="Scrollable table: Renaissance city populations (1500)"',
		);
		// Table stays a child of the wrapper, not a sibling.
		expect(out).toMatch(
			/<div class="pie-table-scroll"[^>]*>\s*<table[^>]*>[\s\S]*?<\/table>\s*<\/div>/,
		);
	});

	test("item stem markup: wraps <table> the same way passages do", () => {
		const out = wrapOverwideTables(ITEM_STEM_MARKUP);
		expect(out).toContain('class="pie-table-scroll"');
		expect(out).toContain('aria-label="Scrollable table: Population summary"');
	});

	test("wrapper is keyboard-scrollable (tabindex=0) and announces itself as a region", () => {
		const out = wrapOverwideTables(PASSAGE_MARKUP);
		expect(out).toMatch(/<div class="pie-table-scroll"[^>]*tabindex="0"/);
		expect(out).toMatch(/<div class="pie-table-scroll"[^>]*role="region"/);
	});

	test("does not wrap tables inside pie-* custom elements in authored markup", () => {
		const html = `
			<p>Answer by tapping:</p>
			<pie-multiple-choice id="q1">
				<table><tr><td>internal</td></tr></table>
			</pie-multiple-choice>
			<table><tr><td>outside</td></tr></table>
		`;
		const out = wrapOverwideTables(html);
		// The table inside the pie-* element must not be restructured.
		expect(out).toMatch(
			/<pie-multiple-choice[^>]*>\s*<table[^>]*>[\s\S]*?internal[\s\S]*?<\/table>\s*<\/pie-multiple-choice>/,
		);
		// The table outside pie-* is wrapped.
		expect(out).toMatch(
			/<div class="pie-table-scroll"[^>]*>\s*<table[^>]*>[\s\S]*?outside/,
		);
	});

	test("table-less passage markup flows through unchanged", () => {
		const html = "<p>No tables here.</p>";
		const out = wrapOverwideTables(html);
		expect(out).not.toContain("pie-table-scroll");
		expect(out).toBe(html);
	});
});
