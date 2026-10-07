import { afterEach, expect, mock, test } from "bun:test";

let imports = 0;
const created: unknown[] = [];
const rendered: unknown[] = [];

mock.module("@pie-element/shared-math-rendering-mathjax", () => {
	imports += 1;
	return {
		createMathjaxRenderer: (options: unknown) => {
			created.push(options);
			return async (root: unknown) => {
				rendered.push(root);
			};
		},
	};
});

const MATH_OPTIONS = "@pie-lib/math-rendering@2";
const page = globalThis as Record<string, unknown>;

/** A fresh copy of the module, whose renderer the first call creates. */
const freshRenderer = async (copy: string) =>
	(await import(`../src/components/private-math-renderer.js?${copy}`)) as typeof import("../src/components/private-math-renderer.js");

afterEach(() => {
	delete page.window;
	delete page[MATH_OPTIONS];
	created.length = 0;
	rendered.length = 0;
});

test("imports the adapter on the first root and hands it every root", async () => {
	const { renderPrivateMath } = await freshRenderer("roots");
	expect(imports).toBe(0);
	const roots = [{}, {}] as HTMLElement[];
	for (const root of roots) await renderPrivateMath(root);
	expect(rendered).toEqual(roots);
	expect(imports).toBe(1);
	expect(created).toHaveLength(1);
});

test("starts MathJax from the root the player passes when the page sets none", async () => {
	page.window = page;
	page[MATH_OPTIONS] = { opts: { useSingleDollar: true } };
	const { renderPrivateMath } = await freshRenderer("player-root");

	await renderPrivateMath({} as HTMLElement, "https://cdn.test/npm");
	await renderPrivateMath({} as HTMLElement, "https://other.test/npm");

	expect(created).toEqual([{ useSingleDollar: true, assetRoot: "https://cdn.test/npm" }]);
});

test("leaves the root to the page options when they set one", async () => {
	page.window = page;
	page[MATH_OPTIONS] = { opts: { assetRoot: "https://assets.test/npm" } };
	const { renderPrivateMath } = await freshRenderer("page-root");

	await renderPrivateMath({} as HTMLElement, "https://cdn.test/npm");

	expect(created).toEqual([{ useSingleDollar: false, assetRoot: undefined }]);
});
