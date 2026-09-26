import { describe, expect, test } from "bun:test";
import { ESM_DEMO_ELEMENT_VERSIONS } from "@pie-players/demo-ui/element-versions";
import {
	applyElementVersionOverridesPreserveTags,
	parsePackageName,
} from "@pie-players/pie-players-shared/pie";
import { demos } from "../content";
import { demoElementOverrides } from "./demo-element-versions";

// A local fixture the demo app serves itself; npm has no such package.
const UNPINNED_PACKAGES = new Set(["@pie-element/authoring-fixture"]);

function elementSpecsUnder(query: string): Array<[string, string]> {
	const overrides = demoElementOverrides(new URLSearchParams(query));
	return Object.values(demos).flatMap((demo) => {
		const config = applyElementVersionOverridesPreserveTags(
			demo.item.config,
			overrides,
		);
		return Object.values(config.elements as Record<string, string>).map(
			(spec) => [demo.id, spec] as [string, string],
		);
	});
}

describe("demoElementOverrides", () => {
	test("loads every pie-elements-ng package at its pinned version under esm", () => {
		const specs = elementSpecsUnder("player=esm");
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
	});

	test("leaves the authored versions for iife and preloaded", () => {
		for (const player of ["iife", "preloaded"]) {
			expect(
				demoElementOverrides(new URLSearchParams(`player=${player}`)),
			).toEqual({});
		}
	});

	test("lets a pie-overrides URL param win over the strategy's version", () => {
		const overrides = demoElementOverrides(
			new URLSearchParams(
				"player=esm&pie-overrides[pie-element/multiple-choice]=13.4.0-next.5",
			),
		);
		expect(overrides["@pie-element/multiple-choice"]).toBe("13.4.0-next.5");
		expect(overrides["@pie-element/passage"]).toBe(
			ESM_DEMO_ELEMENT_VERSIONS["@pie-element/passage"],
		);
	});
});
