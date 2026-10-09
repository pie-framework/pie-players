import { expect, test } from "bun:test";

test("tool-calculator delegates registration to the shared neutral entry", async () => {
	const wrapper = await Bun.file(new URL("../index.ts", import.meta.url)).text();
	const element = await Bun.file(
		new URL(
			"../../tool-calculator-shared/CalculatorElement.svelte",
			import.meta.url,
		),
	).text();
	const shared = await Bun.file(
		new URL(
			"../../tool-calculator-shared/CalculatorTool.svelte",
			import.meta.url,
		),
	).text();
	expect(wrapper).toContain("pie-tool-calculator-shared/calculator-element");
	expect(element.includes("CalculatorTool")).toBe(true);
	// The provider comes from the toolkit's tool config, so the element names none.
	expect(element).not.toContain("providerId");
	expect(element).not.toContain("toolkitCoordinator");
	expect(shared.includes("connectToolRuntimeContext")).toBe(true);
	expect(shared.includes("new ContextConsumer(")).toBe(false);
});
