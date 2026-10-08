import { expect, test } from "bun:test";

test("GeoGebra wrapper owns only its tag", async () => {
	const source = await Bun.file(
		new URL("../tool-calculator-geogebra.svelte", import.meta.url),
	).text();
	expect(source).toContain("tag: 'pie-tool-calculator-geogebra'");
	// The provider comes from the toolkit's tool config, so the tag names none.
	expect(source).not.toContain("providerId");
	expect(source).not.toContain("toolkitCoordinator");
	expect(source).toContain("CalculatorTool");
	// The attribution is the provider's, so every surface rendering GeoGebra shows it.
	expect(source).not.toContain("Made with GeoGebra®");
	expect(source).not.toContain("GGBApplet");
});
