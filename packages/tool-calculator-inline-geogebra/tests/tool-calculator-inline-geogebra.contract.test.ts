import { expect, test } from "bun:test";

test("GeoGebra inline wrapper delegates to the shared toggle", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-inline-geogebra.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-inline-geogebra'");
	expect(source).toContain("CalculatorInlineTool");
});
