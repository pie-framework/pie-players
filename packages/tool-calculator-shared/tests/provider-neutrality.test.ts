import { expect, test } from "bun:test";

test("shared calculator surfaces contain no vendor implementation names", async () => {
	const files = ["CalculatorTool.svelte", "CalculatorInlineTool.svelte"];
	for (const file of files) {
		const source = await Bun.file(
			new URL(`../${file}`, import.meta.url),
		).text();
		expect(source).not.toMatch(/desmos|geogebra/i);
	}
});

test("shared calculator surfaces leave Svelte to the consuming wrapper", async () => {
	const viteConfig = await Bun.file(
		new URL("../vite.config.ts", import.meta.url),
	).text();
	const packageJson = await Bun.file(
		new URL("../package.json", import.meta.url),
	).json();
	const publishPolicy = await Bun.file(
		new URL("../../../scripts/publish-policy.json", import.meta.url),
	).json();

	// A precompiled shared component with its own Svelte runtime cannot attach
	// effects beneath a custom-element wrapper compiled with another runtime.
	expect(viteConfig).toContain('/^svelte(?:\\/.*)?$/');
	// The range itself lives in scripts/publish-policy.json, which
	// check:svelte-runtime-deps enforces across the workspace.
	expect(publishPolicy.svelteRuntimeDependencyRange).toBeTruthy();
	expect(packageJson.dependencies?.svelte).toBe(
		publishPolicy.svelteRuntimeDependencyRange,
	);
});
