import { describe, expect, test } from "bun:test";
import manifest from "../package.json";
import {
	ESM_DEMO_ELEMENT_VERSIONS,
	demoStrategy,
	strategyElementVersions,
} from "./element-versions";
import { ESM_DEMO_BROWSER_BUILDS } from "./preloaded-elements";

const installed = Object.entries(manifest.dependencies)
	.filter(([name]) => name.startsWith("@pie-element/"))
	.sort(([a], [b]) => a.localeCompare(b));

describe("the demos' pie-elements-ng packages", () => {
	test("are installed at the next dist-tag", () => {
		expect(installed.filter(([, range]) => range !== "next")).toEqual([]);
	});

	test("each have a version and browser builds", () => {
		const names = installed.map(([name]) => name);
		expect(Object.keys(ESM_DEMO_ELEMENT_VERSIONS).sort()).toEqual(names);
		expect(Object.keys(ESM_DEMO_BROWSER_BUILDS).sort()).toEqual(names);
	});

	test("load the ng line, which publishes prereleases of next", () => {
		for (const version of Object.values(ESM_DEMO_ELEMENT_VERSIONS)) {
			expect(version).toMatch(/^\d+\.\d+\.\d+-next\.\d+$/);
		}
	});
});

describe("demoStrategy", () => {
	test("loads esm unless ?player names a strategy", () => {
		expect(demoStrategy(null)).toBe("esm");
		expect(demoStrategy("unknown")).toBe("esm");
		expect(demoStrategy("iife")).toBe("iife");
		expect(demoStrategy("preloaded")).toBe("preloaded");
		expect(strategyElementVersions(null)).toEqual({
			...ESM_DEMO_ELEMENT_VERSIONS,
		});
	});
});
