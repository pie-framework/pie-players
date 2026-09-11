import { expect, test } from "bun:test";

test("Cortex wrapper owns only its additive tag and default provider", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-cortex.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-cortex'");
	expect(source).toContain("providerId = 'calculator-cortex'");
	expect(source).toContain("CalculatorTool");
	expect(source).not.toContain("MathfieldElement");
	expect(source).not.toContain("ComputeEngine");
	expect(source).not.toContain("JSXGraph");
});
