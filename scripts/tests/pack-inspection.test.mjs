import { describe, expect, test } from "bun:test";

import {
	collectDeclaredTargets,
	getNodeConsumerImportTargets,
	isPackedMatch,
	parsePackJson,
	packedFilesFromPackData,
	toPosix,
} from "../lib/pack-inspection.mjs";

describe("pack inspection helpers", () => {
	test("collects package entry targets from top-level fields and nested exports", () => {
		const targets = collectDeclaredTargets({
			main: "./dist/index.js",
			module: "./dist/index.mjs",
			types: "./dist/index.d.ts",
			unpkg: "./dist/browser.js",
			jsdelivr: "./dist/browser.js",
			svelte: "./src/Component.svelte",
			exports: {
				".": {
					types: "./dist/index.d.ts",
					import: "./dist/index.js",
				},
				"./components/*": "./dist/components/*.js",
				"./package.json": "./package.json",
			},
		});

		expect([...targets].sort()).toEqual([
			"dist/browser.js",
			"dist/components/*.js",
			"dist/index.d.ts",
			"dist/index.js",
			"dist/index.mjs",
			"package.json",
			"src/Component.svelte",
		]);
	});

	test("parses npm pack json even when npm writes surrounding text", () => {
		const parsed = parsePackJson(
			'notice before\n[{"filename":"pkg.tgz","files":[{"path":"dist/index.js"}]}]\nnotice after',
		);

		expect(parsed[0].filename).toBe("pkg.tgz");
		expect(parsed[0].files[0].path).toBe("dist/index.js");
	});

	test("converts npm pack file entries into normalized package paths", () => {
		const packedFiles = packedFilesFromPackData([
			{
				files: [{ path: "dist\\index.js" }, { path: "README.md" }],
			},
		]);

		expect([...packedFiles].sort()).toEqual(["README.md", "dist/index.js"]);
	});

	test("matches packed files with exact and wildcard export targets", () => {
		const packedFiles = new Set([
			"dist/index.js",
			"dist/components/button.js",
			"dist/components/panel.js",
		]);

		expect(isPackedMatch("dist/index.js", packedFiles)).toBe(true);
		expect(isPackedMatch("dist/components/*.js", packedFiles)).toBe(true);
		expect(isPackedMatch("dist/missing.js", packedFiles)).toBe(false);
	});

	test("normalizes platform separators to package paths", () => {
		expect(toPosix("dist\\nested\\index.js")).toBe("dist/nested/index.js");
	});

	test("rejects malformed node consumer import target policy", () => {
		expect(() =>
			getNodeConsumerImportTargets({
				nodeConsumerImportTargets: {
					nodeSafe: ["@pie-players/example"],
					browserOnly: "@pie-players/browser-only",
				},
			}),
		).toThrow(/nodeConsumerImportTargets\.browserOnly/);
	});
});
