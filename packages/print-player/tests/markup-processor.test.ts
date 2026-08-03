/**
 * `processMarkup` attribute-preservation tests.
 *
 * The tag swap replaces the authored interactive element with a freshly
 * created print element. Authored attributes are contract surface: `class`
 * carries print-only styling hooks (`.noprint` / `.kds-noprint` in
 * `@pie-players/pie-theme/components.css`), and `lang`, `dir`, `aria-*`, and
 * `data-*` carry accessibility and authoring metadata. All of it has to
 * survive the swap.
 *
 * Uses `@happy-dom/global-registrator` for `DOMParser`/`document` (matches the
 * convention in `packages/players-shared/tests/first-focusable.test.ts`).
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { processMarkup } from "../src/markup-processor.js";
import type { PkgResolution } from "../src/types.js";

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

/** Re-parse processed html so attributes can be inspected structurally. */
const printEl = (html: string): Element => {
	const el = new DOMParser()
		.parseFromString(html, "text/html")
		.body.querySelector(PRINT_TAG);
	if (!el) {
		throw new Error(`no <${PRINT_TAG}> in processed markup: ${html}`);
	}
	return el;
};

describe("processMarkup attribute preservation", () => {
	test("keeps authored class through the tag swap", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1" class="noprint"></multiple-choice>`,
			resolutions,
		);

		expect(printEl(html).getAttribute("class")).toBe("noprint");
	});

	test("keeps lang, dir, style, aria-* and data-* through the tag swap", () => {
		const { html } = processMarkup(
			`<multiple-choice
				id="1"
				class="kds-noprint pie-mc"
				lang="es"
				dir="rtl"
				style="margin-top: 8px"
				aria-label="Question one"
				data-track="q1"
			></multiple-choice>`,
			resolutions,
		);

		const el = printEl(html);
		expect(el.getAttribute("class")).toBe("kds-noprint pie-mc");
		expect(el.getAttribute("lang")).toBe("es");
		expect(el.getAttribute("dir")).toBe("rtl");
		expect(el.getAttribute("style")).toBe("margin-top: 8px");
		expect(el.getAttribute("aria-label")).toBe("Question one");
		expect(el.getAttribute("data-track")).toBe("q1");
	});

	test("still sets the three attributes it owns", () => {
		const { html, nodes } = processMarkup(
			`<multiple-choice id="1" pie-id="pie-1" class="noprint"></multiple-choice>`,
			resolutions,
		);

		const el = printEl(html);
		expect(el.getAttribute("id")).toBe("1");
		expect(el.getAttribute("pie-id")).toBe("pie-1");
		expect(el.getAttribute("data-original-tag")).toBe("multiple-choice");
		expect(nodes).toEqual([
			{ id: "1", pieId: "pie-1", originalTag: "multiple-choice" },
		]);
	});

	test("owned attributes win over authored ones of the same name", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1" data-original-tag="bogus-tag"></multiple-choice>`,
			resolutions,
		);

		expect(printEl(html).getAttribute("data-original-tag")).toBe(
			"multiple-choice",
		);
	});

	test("derives pie-id from id when not authored", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1"></multiple-choice>`,
			resolutions,
		);

		expect(printEl(html).getAttribute("pie-id")).toBe("1");
	});

	test("leaves surrounding authored markup alone", () => {
		const { html } = processMarkup(
			`<div class="noprint"><p lang="fr">Bonjour</p><multiple-choice id="1" class="noprint"></multiple-choice></div>`,
			resolutions,
		);

		const doc = new DOMParser().parseFromString(html, "text/html");
		expect(doc.body.querySelector("div")?.getAttribute("class")).toBe(
			"noprint",
		);
		expect(doc.body.querySelector("p")?.getAttribute("lang")).toBe("fr");
		expect(doc.body.querySelector(PRINT_TAG)?.getAttribute("class")).toBe(
			"noprint",
		);
	});

	test("skips elements without an id", () => {
		const { html, nodes } = processMarkup(
			`<multiple-choice class="noprint"></multiple-choice>`,
			resolutions,
		);

		expect(nodes).toEqual([]);
		expect(html).toContain("<multiple-choice");
		expect(html).not.toContain(PRINT_TAG);
	});
});

describe("processMarkup child preservation", () => {
	test("keeps authored children through the tag swap", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1"><p class="noprint">Fallback <em>copy</em></p></multiple-choice>`,
			resolutions,
		);

		const el = printEl(html);
		expect(el.innerHTML).toBe(`<p class="noprint">Fallback <em>copy</em></p>`);
	});

	test("keeps child order and text nodes", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1">before<span>middle</span>after</multiple-choice>`,
			resolutions,
		);

		expect(printEl(html).innerHTML).toBe("before<span>middle</span>after");
	});

	test("leaves elements with no children empty", () => {
		const { html } = processMarkup(
			`<multiple-choice id="1"></multiple-choice>`,
			resolutions,
		);

		expect(printEl(html).innerHTML).toBe("");
	});

	test("swaps a nested interactive element inside a preserved child tree", () => {
		const nested: PkgResolution[] = [
			...resolutions,
			{
				tagName: "inline-choice",
				printTagName: "inline-choice-print-5678",
				pkg: "@pie-element/inline-choice@6.0.0",
				url: "https://cdn.example.test/inline-choice/print/index.js",
				module: true,
			},
		];

		const { html, nodes } = processMarkup(
			`<multiple-choice id="1"><div class="noprint"><inline-choice id="2"></inline-choice></div></multiple-choice>`,
			nested,
		);

		const outer = printEl(html);
		const inner = outer.querySelector("inline-choice-print-5678");
		expect(outer.querySelector("div")?.getAttribute("class")).toBe("noprint");
		expect(inner?.getAttribute("id")).toBe("2");
		expect(inner?.getAttribute("data-original-tag")).toBe("inline-choice");
		expect(nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
	});
});

describe("processMarkup sanitization", () => {
	// NOTE: tag removal and attribute removal are asserted in separate tests on
	// purpose. Under happy-dom, DOMPurify's traversal stops sanitizing
	// attributes once it removes a node, so markup that mixes a `<script>` with
	// a dirty attribute would let the attribute through *in this environment
	// only* (real browsers apply both). Combining them into one fixture
	// silently under-verifies the attribute half — keep them apart.
	test("strips dangerous tags by default", () => {
		const { html } = processMarkup(
			`<div><script>alert(1)</script><multiple-choice id="1"></multiple-choice></div>`,
			resolutions,
		);

		expect(html).not.toContain("<script");
		expect(html).not.toContain("alert(");
		// The interactive element still gets swapped.
		expect(printEl(html).getAttribute("id")).toBe("1");
	});

	test("strips event-handler attributes by default", () => {
		const { html } = processMarkup(
			`<div><img src="x" onerror="alert(2)"><multiple-choice id="1" onclick="evil()"></multiple-choice></div>`,
			resolutions,
		);

		expect(html).not.toContain("onerror");
		expect(html).not.toContain("onclick");
		expect(html).toContain(`src="x"`);
		expect(printEl(html).getAttribute("id")).toBe("1");
	});

	test("keeps the interactive and print tags off the sanitizer's chopping block", () => {
		// The shared sanitizer only allows `pie-*` custom elements by default;
		// print tags come from `@pie-element/*`, so the allow-list has to be fed
		// from the resolutions or every element would be stripped.
		const { html, nodes } = processMarkup(
			`<multiple-choice id="1"></multiple-choice>`,
			resolutions,
		);

		expect(html).toContain(PRINT_TAG);
		expect(nodes).toHaveLength(1);
	});

	test("does not add overwide scroll wrappers, which clip in print", () => {
		const { html } = processMarkup(
			`<div><img src="wide.png" alt="a chart"><table><tr><td>x</td></tr></table><multiple-choice id="1"></multiple-choice></div>`,
			resolutions,
		);

		expect(html).not.toContain("pie-image-scroll");
		expect(html).not.toContain("pie-table-scroll");
		expect(html).toContain("wide.png");
		expect(html).toContain("<table");
	});

	test("trustMarkup skips sanitization entirely", () => {
		const { html } = processMarkup(
			`<div><script>alert(1)</script><multiple-choice id="1"></multiple-choice></div>`,
			resolutions,
			{ trustMarkup: true },
		);

		expect(html).toContain("<script");
	});

	test("uses a host-supplied sanitizer when given", () => {
		const calls: string[] = [];
		const { html } = processMarkup(
			`<multiple-choice id="1"></multiple-choice><p>drop me</p>`,
			resolutions,
			{
				sanitize: (markup) => {
					calls.push(markup);
					return markup.replace("<p>drop me</p>", "");
				},
			},
		);

		expect(calls).toHaveLength(1);
		expect(html).not.toContain("drop me");
		expect(printEl(html).getAttribute("id")).toBe("1");
	});

	test("trustMarkup takes precedence over a host sanitizer", () => {
		let called = false;
		processMarkup(`<multiple-choice id="1"></multiple-choice>`, resolutions, {
			trustMarkup: true,
			sanitize: () => {
				called = true;
				return "";
			},
		});

		expect(called).toBe(false);
	});

	test("returns empty markup for empty input", () => {
		const { html, nodes } = processMarkup("", resolutions);

		expect(html).toBe("");
		expect(nodes).toEqual([]);
	});
});
