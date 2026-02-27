import { expect, test } from "bun:test";

test("tool-calculator uses contract runtime context helper", async () => {
	const source = await Bun.file(new URL("./tool-calculator.svelte", import.meta.url)).text();
	expect(source.includes("connectToolRuntimeContext")).toBe(true);
	expect(source.includes("new ContextConsumer(")).toBe(false);
});
