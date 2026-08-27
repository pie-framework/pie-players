import { expect, test } from "bun:test";

test("tool-calculator delegates provider-neutral behavior to the shared surface", async () => {
	const wrapper = await Bun.file(
		new URL("../tool-calculator.svelte", import.meta.url),
	).text();
	const shared = await Bun.file(
		new URL(
			"../../tool-calculator-shared/CalculatorTool.svelte",
			import.meta.url,
		),
	).text();
	expect(wrapper.includes("CalculatorTool")).toBe(true);
	expect(wrapper.includes("calculator-desmos")).toBe(true);
	expect(shared.includes("connectToolRuntimeContext")).toBe(true);
	expect(shared.includes("new ContextConsumer(")).toBe(false);
});
