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

const SVELTE_SPECIFIER = /^svelte(?:\/|$)/;
const transpiler = new Bun.Transpiler({ loader: "js" });

/** The bare specifiers a built entry imports, following its relative imports. */
async function bareImports(entry: string): Promise<Set<string>> {
	const bare = new Set<string>();
	const seen = new Set<string>();
	const pending = [new URL(`../dist/${entry}`, import.meta.url)];
	for (let url = pending.pop(); url; url = pending.pop()) {
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		for (const { path } of transpiler.scanImports(await Bun.file(url).text())) {
			if (path.startsWith(".")) pending.push(new URL(path, url));
			else bare.add(path);
		}
	}
	return bare;
}

test("the element entry bundles Svelte, since hosts resolve it at runtime", async () => {
	const imports = await bareImports("calculator-element.js");

	// An external `svelte` here resolves against the host's own copy.
	expect([...imports].filter((path) => SVELTE_SPECIFIER.test(path))).toEqual([]);
	expect(imports.has("@pie-players/pie-players-shared")).toBe(true);
});

test("the component entry leaves Svelte to the wrappers that bundle it", async () => {
	const packageJson = await Bun.file(
		new URL("../package.json", import.meta.url),
	).json();
	const publishPolicy = await Bun.file(
		new URL("../../../scripts/publish-policy.json", import.meta.url),
	).json();

	// A precompiled shared component with its own Svelte runtime cannot attach
	// effects beneath a custom-element wrapper compiled with another runtime.
	expect((await bareImports("index.js")).has("svelte/internal/client")).toBe(
		true,
	);
	// The range itself lives in scripts/publish-policy.json, which
	// check:svelte-runtime-deps enforces across the workspace.
	expect(publishPolicy.svelteRuntimeDependencyRange).toBeTruthy();
	expect(packageJson.dependencies?.svelte).toBe(
		publishPolicy.svelteRuntimeDependencyRange,
	);
});
