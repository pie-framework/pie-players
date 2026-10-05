import { expect, mock, test } from "bun:test";

let imports = 0;
const rendered: unknown[] = [];

mock.module("@pie-element/shared-math-rendering-mathjax", () => {
	imports += 1;
	return {
		renderMath: async (root: unknown) => {
			rendered.push(root);
		},
	};
});

const { renderPrivateMath } = await import(
	"../src/components/private-math-renderer.js"
);

test("imports the adapter on the first root and hands it every root", async () => {
	expect(imports).toBe(0);
	const roots = [{}, {}] as HTMLElement[];
	for (const root of roots) await renderPrivateMath(root);
	expect(rendered).toEqual(roots);
	expect(imports).toBe(1);
});
