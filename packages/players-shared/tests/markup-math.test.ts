import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import {
	collectMarkupMathRoots,
	typesetMarkupMath,
} from "../src/pie/markup-math.js";

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

const PIE_TAGS = new Set(["multiple-choice", "explicit-constructed-response"]);

function container(markup: string): HTMLElement {
	const element = document.createElement("div");
	element.innerHTML = markup;
	return element;
}

const outerHtml = (roots: HTMLElement[]) => roots.map((root) => root.outerHTML);

describe("collectMarkupMathRoots", () => {
	afterEach(() => {
		delete (globalThis as Record<string, unknown>)["@pie-lib/math-rendering@2"];
	});

	test("takes markup without PIE elements whole", () => {
		const markup = container(
			String.raw`<p>Solve \(x + 1 = 2\).</p><p>Then \[y\]</p>`,
		);
		expect(collectMarkupMathRoots(markup, PIE_TAGS)).toEqual([markup]);
	});

	test("takes nothing from markup without math", () => {
		const markup = container(
			'<p>Plain $5 text.</p><multiple-choice id="1"></multiple-choice>',
		);
		expect(collectMarkupMathRoots(markup, PIE_TAGS)).toEqual([]);
		expect(markup.innerHTML).toBe(
			'<p>Plain $5 text.</p><multiple-choice id="1"></multiple-choice>',
		);
	});

	test("leaves out PIE elements and wraps math that shares their parent", () => {
		const markup = container(
			String.raw`<p class="stem">Solve \(x\).</p><div>Given \(a\): <multiple-choice id="1"><span>\(b\)</span></multiple-choice> then \(c\).</div><p>No math.</p>`,
		);
		const roots = collectMarkupMathRoots(markup, PIE_TAGS);
		expect(outerHtml(roots)).toEqual([
			String.raw`<p class="stem">Solve \(x\).</p>`,
			String.raw`<span>Given \(a\): </span>`,
			String.raw`<span> then \(c\).</span>`,
		]);
		const element = markup.querySelector("multiple-choice");
		for (const root of roots) {
			expect(root.contains(element)).toBe(false);
			expect(element?.contains(root)).toBe(false);
		}
		expect(element?.innerHTML).toBe(String.raw`<span>\(b\)</span>`);
	});

	test("descends through every ancestor of a PIE element", () => {
		const markup = container(
			String.raw`<section><div><p>\(x\)</p><explicit-constructed-response id="1"></explicit-constructed-response></div><p>\(y\)</p></section>`,
		);
		expect(outerHtml(collectMarkupMathRoots(markup, PIE_TAGS))).toEqual([
			String.raw`<p>\(x\)</p>`,
			String.raw`<p>\(y\)</p>`,
		]);
	});

	test("wraps MathML and data-latex beside a PIE element, which renderers find only below a root", () => {
		const markup = container(
			'<p><math><mi>x</mi></math><span data-latex="">\\frac12</span><multiple-choice id="1"></multiple-choice></p>',
		);
		expect(outerHtml(collectMarkupMathRoots(markup, PIE_TAGS))).toEqual([
			"<span><math><mi>x</mi></math></span>",
			'<span><span data-latex="">\\frac12</span></span>',
		]);
	});

	test("takes an element holding MathML or data-latex", () => {
		const markup = container(
			'<p><math><mi>x</mi></math></p><p><span data-latex="">\\frac12</span></p><multiple-choice id="1"></multiple-choice>',
		);
		expect(outerHtml(collectMarkupMathRoots(markup, PIE_TAGS))).toEqual([
			"<p><math><mi>x</mi></math></p>",
			'<p><span data-latex="">\\frac12</span></p>',
		]);
	});

	test("skips content MathJax leaves alone", () => {
		const markup = container(
			String.raw`<pre>\(x\)<multiple-choice id="1"></multiple-choice></pre><div class="note mathjax_ignore">\(y\)<multiple-choice id="2"></multiple-choice></div>`,
		);
		expect(collectMarkupMathRoots(markup, PIE_TAGS)).toEqual([]);
	});

	test("finds nothing left in typeset markup", () => {
		const markup = container(
			'<p><mjx-container><mjx-assistive-mml><math><mi>x</mi></math></mjx-assistive-mml></mjx-container></p><p><span data-latex="" data-math-handled="true"><mjx-container></mjx-container></span></p><multiple-choice id="1"></multiple-choice>',
		);
		expect(collectMarkupMathRoots(markup, PIE_TAGS)).toEqual([]);
	});

	test("reads $…$ as math only with the legacy single-dollar opt-in", () => {
		const markup = () =>
			container('<p>Costs $x$.</p><multiple-choice id="1"></multiple-choice>');
		expect(collectMarkupMathRoots(markup(), PIE_TAGS)).toEqual([]);
		(globalThis as Record<string, unknown>)["@pie-lib/math-rendering@2"] = {
			opts: { useSingleDollar: true },
		};
		expect(outerHtml(collectMarkupMathRoots(markup(), PIE_TAGS))).toEqual([
			"<p>Costs $x$.</p>",
		]);
	});
});

describe("typesetMarkupMath", () => {
	test("renders each root of every container once", async () => {
		const item = container(
			String.raw`<p>\(x\)</p><div>\(y\)<multiple-choice id="1"></multiple-choice></div>`,
		);
		const passage = container(String.raw`<p>\[z\]</p>`);
		const rendered: string[] = [];
		await typesetMarkupMath([passage, item], PIE_TAGS, (root) => {
			rendered.push(root.outerHTML);
		});
		expect(rendered).toEqual([
			String.raw`<div><p>\[z\]</p></div>`,
			String.raw`<p>\(x\)</p>`,
			String.raw`<span>\(y\)</span>`,
		]);
	});

	test("waits for each root before the next", async () => {
		const item = container(
			String.raw`<p>\(x\)</p><p>\(y\)</p><multiple-choice id="1"></multiple-choice>`,
		);
		const events: string[] = [];
		await typesetMarkupMath([item], PIE_TAGS, async (root) => {
			events.push(`start ${root.textContent}`);
			await new Promise((resolve) => setTimeout(resolve, 5));
			events.push(`end ${root.textContent}`);
		});
		expect(events).toEqual([
			String.raw`start \(x\)`,
			String.raw`end \(x\)`,
			String.raw`start \(y\)`,
			String.raw`end \(y\)`,
		]);
	});
});
