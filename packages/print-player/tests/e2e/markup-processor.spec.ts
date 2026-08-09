import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

import type { NodeResult, PkgResolution } from "../../src/types.js";

/**
 * Verifies `processMarkup`'s sanitization-dependent behavior in a real
 * browser engine, against the actual composed sanitizer (the shared
 * `@pie-players/pie-players-shared` DOMPurify wrapper plus the
 * resolutions-driven custom-element allow-list) — not a hand-rolled
 * reproduction of it.
 *
 * Why this suite exists rather than living entirely in
 * `tests/markup-processor.test.ts` (bun:test + happy-dom): DOMPurify >=3.4.8
 * fails to sanitize under happy-dom — confirmed 2026-08-06 in players-shared
 * (cbe7791a) and again here. Every element's `tagName` resolves to `""`
 * under happy-dom, so nothing matches the allow-list, the first top-level
 * element is removed with its children lifted into the parent, and removing
 * a node mid-walk breaks happy-dom's `NodeIterator` — the rest of the tree
 * is then serialized unprocessed. One case here shows the same trap
 * `section-player` hit in 30db77d1: "does not add overwide scroll wrappers"
 * passed under the broken harness for the wrong reason (no sanitization ran,
 * so no wrapper was ever going to be added), not because the behavior
 * worked. Real Chromium sanitizes correctly, so that's where every assertion
 * that depends on the sanitize() pass actually running now lives.
 * `tests/markup-processor.test.ts` keeps the tag-swap and attribute/child
 * preservation tests, all passing `{ trustMarkup: true }` to route around the
 * sanitizer since that logic isn't what they're testing.
 *
 * Bundles `src/markup-processor.ts` directly with esbuild rather than a
 * built `dist/markup-processor.js`: esbuild resolves the module's own
 * `./types.js` specifier (a NodeNext authoring convention pointing at the
 * sibling `types.ts`) without a prior `tsc` pass. The workspace import
 * `@pie-players/pie-players-shared/security` still resolves through
 * node_modules to that package's *built* dist, so players-shared has to be
 * built first — `bun run build:e2e:print-player`.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "src/markup-processor.ts");

let bundledCode: string;

test.beforeAll(async () => {
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieMarkupProcessorUnderTest",
		target: "es2020",
		write: false,
	});

	bundledCode = result.outputFiles[0].text;
});

async function loadModule(page: Page) {
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });
}

const PRINT_TAG = "multiple-choice-print-1234";

const resolutions: PkgResolution[] = [
	{
		tagName: "multiple-choice",
		printTagName: PRINT_TAG,
		pkg: "@pie-element/multiple-choice@13.2.0",
		url: "https://cdn.example.test/multiple-choice/print/index.js",
		module: true,
	},
];

/** Runs `processMarkup` in the page against the default (real) sanitizer. */
function processInPage(page: Page, markup: string) {
	return page.evaluate(
		({ markup, resolutions }) => {
			const api = (
				window as unknown as {
					PieMarkupProcessorUnderTest: {
						processMarkup: (
							m: string,
							r: PkgResolution[],
						) => { html: string; nodes: NodeResult[] };
					};
				}
			).PieMarkupProcessorUnderTest;
			return api.processMarkup(markup, resolutions);
		},
		{ markup, resolutions },
	);
}

test.describe("processMarkup sanitization (real browser)", () => {
	test.beforeEach(async ({ page }) => {
		await loadModule(page);
	});

	// NOTE: tag removal and attribute removal are asserted in separate tests on
	// purpose, matching the split that used to live in the happy-dom file —
	// keeping the fixtures apart isolates which allow-list rule is under test.
	test("strips dangerous tags by default", async ({ page }) => {
		const { html } = await processInPage(
			page,
			`<div><script>alert(1)</script><multiple-choice id="1"></multiple-choice></div>`,
		);

		expect(html).not.toContain("<script");
		expect(html).not.toContain("alert(");
		// The interactive element still gets swapped.
		expect(html).toContain(PRINT_TAG);
	});

	test("strips event-handler attributes by default", async ({ page }) => {
		const { html } = await processInPage(
			page,
			`<div><img src="x" onerror="alert(2)"><multiple-choice id="1" onclick="evil()"></multiple-choice></div>`,
		);

		expect(html).not.toContain("onerror");
		expect(html).not.toContain("onclick");
		expect(html).toContain(`src="x"`);
		expect(html).toContain(PRINT_TAG);
	});

	test("keeps the interactive and print tags off the sanitizer's chopping block", async ({
		page,
	}) => {
		// The shared sanitizer only allows `pie-*` custom elements by default;
		// print tags come from `@pie-element/*`, so the allow-list has to be fed
		// from the resolutions or every element would be stripped.
		const { html, nodes } = await processInPage(
			page,
			`<multiple-choice id="1"></multiple-choice>`,
		);

		expect(html).toContain(PRINT_TAG);
		expect(nodes).toHaveLength(1);
	});

	test("does not add overwide scroll wrappers, which clip in print", async ({
		page,
	}) => {
		const { html } = await processInPage(
			page,
			`<div><img src="wide.png" alt="a chart"><table><tr><td>x</td></tr></table><multiple-choice id="1"></multiple-choice></div>`,
		);

		expect(html).not.toContain("pie-image-scroll");
		expect(html).not.toContain("pie-table-scroll");
		expect(html).toContain("wide.png");
		expect(html).toContain("<table");
	});
});
