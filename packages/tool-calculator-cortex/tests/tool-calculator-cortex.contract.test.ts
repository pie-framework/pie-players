import { expect, test } from "bun:test";

test("Cortex wrapper owns only its additive tag", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-cortex.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-cortex'");
	// The provider comes from the toolkit's tool config, so the tag names none.
	expect(source).not.toContain("providerId");
	expect(source).not.toContain("toolkitCoordinator");
	expect(source).toContain("CalculatorTool");
	expect(source).not.toContain("MathfieldElement");
	expect(source).not.toContain("ComputeEngine");
	expect(source).not.toContain("JSXGraph");
});
