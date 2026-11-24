import { expect, test } from "bun:test";

test("tool-graph uses contract runtime context helper", async () => {
	const source = await Bun.file(
		new URL("../tool-graph.svelte", import.meta.url),
	).text();
	expect(source.includes("connectToolRuntimeContext")).toBe(true);
	expect(source.includes("new ContextConsumer(")).toBe(false);
});

test("the transparency slider takes the theme's primary colour", async () => {
	// Unset, the browser's own accent blue drew the slider under every scheme.
	const source = await Bun.file(
		new URL("../tool-graph.svelte", import.meta.url),
	).text();
	const rule =
		source.match(
			/\.pie-tool-graph__transparency-control input\[type='range'\] \{[^}]*\}/,
		)?.[0] ?? "";
	expect(rule).toContain("accent-color: var(--pie-primary, #3f51b5)");
});
