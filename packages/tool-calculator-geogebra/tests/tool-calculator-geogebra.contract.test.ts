import { expect, test } from "bun:test";

test("GeoGebra wrapper owns only its tag, default provider, and attribution", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-geogebra.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-geogebra'");
	expect(source).toContain("providerId = 'calculator-geogebra'");
	expect(source).toContain("CalculatorTool");
	expect(source).toContain("Made with GeoGebra®");
	expect(source).not.toContain("GGBApplet");
});
