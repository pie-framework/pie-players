import { plugin } from "bun";
import { describe, expect, test } from "bun:test";
import { ESM_DEMO_ELEMENT_VERSIONS } from "@pie-players/demo-ui/element-versions";
import { parsePackageName } from "@pie-players/pie-players-shared/pie";

// The content globs a gitignored fixture through Vite's `import.meta.glob`,
// which Bun lacks; the glob matches nothing here, as in a clean checkout.
plugin({
	name: "vite-import-meta-glob",
	setup(build) {
		build.onLoad({ filter: /demo-sign-language\.ts$/ }, async ({ path }) => ({
			contents: (await Bun.file(path).text()).replaceAll(
				"import.meta.glob",
				"(() => ({}))",
			),
			loader: "ts",
		}));
	},
});
const { loadDemoRouteDataById } = await import("./demo-load");
const { sectionDemos } = await import("./sections");

// Served from the pie-elements-ng checkout by its own spec; not on npm.
const UNPINNED_PACKAGES = new Set(["@pie-element/video-stimulus"]);
// Renders under the preloaded strategy only, registering the installed version.
const PRELOADED_ONLY_DEMOS = new Set(["preloaded-bundled-elements"]);

function elementSpecs(value: unknown, out: string[] = []): string[] {
	if (typeof value === "string") {
		if (/^@pie-element\/[^@\s]+@\S+$/.test(value)) out.push(value);
	} else if (Array.isArray(value)) {
		for (const entry of value) elementSpecs(entry, out);
	} else if (value && typeof value === "object") {
		for (const entry of Object.values(value)) elementSpecs(entry, out);
	}
	return out;
}

function loadedSpecs(player: string): Array<[string, string]> {
	const demos = Object.values(sectionDemos).filter(
		(demo) => !PRELOADED_ONLY_DEMOS.has(demo.id),
	);
	return demos.flatMap((demo) => {
		const pageIds = demo.sections?.map((page) => page.id) ?? [""];
		return pageIds.flatMap((pageId) => {
			const url = new URL(`http://demo.test/${demo.id}`);
			url.searchParams.set("player", player);
			if (pageId) url.searchParams.set("page", pageId);
			const { section } = loadDemoRouteDataById(demo.id, url);
			return elementSpecs(section).map(
				(spec) => [`${demo.id}/${pageId}`, spec] as [string, string],
			);
		});
	});
}

describe("loadDemoRouteDataById", () => {
	test("loads every pie-elements-ng package at its pinned version under esm", () => {
		const specs = loadedSpecs("esm");
		const unpinned = specs.filter(([, spec]) => {
			const { name, version } = parsePackageName(spec);
			return (
				!UNPINNED_PACKAGES.has(name) &&
				version !== ESM_DEMO_ELEMENT_VERSIONS[name]
			);
		});
		expect(unpinned).toEqual([]);
		// The exclusions are live: each names a package the content uses.
		const used = new Set(specs.map(([, spec]) => parsePackageName(spec).name));
		expect([...UNPINNED_PACKAGES].filter((name) => !used.has(name))).toEqual(
			[],
		);
		expect([...PRELOADED_ONLY_DEMOS].filter((id) => !sectionDemos[id])).toEqual(
			[],
		);
	});

	test("keeps the authored versions for iife and preloaded", () => {
		for (const player of ["iife", "preloaded"]) {
			for (const demo of Object.values(sectionDemos)) {
				const url = new URL(`http://demo.test/${demo.id}?player=${player}`);
				const { section } = loadDemoRouteDataById(demo.id, url);
				const authored = demo.sections?.[0]?.section ?? demo.section ?? null;
				expect(section).toBe(authored);
			}
		}
	});
});
