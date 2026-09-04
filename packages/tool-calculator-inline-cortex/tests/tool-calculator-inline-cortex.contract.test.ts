import { expect, test } from "bun:test";

test("Cortex inline wrapper delegates to the shared toggle", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-inline-cortex.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-inline-cortex'");
	expect(source).toContain("CalculatorInlineTool");
});
