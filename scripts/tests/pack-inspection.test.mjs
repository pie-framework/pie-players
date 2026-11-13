import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	collectDeclaredTargets,
	defaultConditionViolations,
	getImportTarget,
	getNodeConsumerImportTargets,
	isPackedMatch,
	mapConcurrent,
	parsePackJson,
	packedFilesFromPackData,
	readPublishPolicy,
	splitPackageSpecifier,
	toPosix,
} from "../lib/pack-inspection.mjs";

describe("pack inspection helpers", () => {
	test("reads the publish policy and fails when it is missing", () => {
		const root = mkdtempSync(path.join(tmpdir(), "pie-publish-policy-"));
		// An empty policy allows nothing and checks nothing, so every reader
		// would pass; a missing file is an error, not a default.
		expect(() => readPublishPolicy(root)).toThrow("publish policy is missing");

		mkdirSync(path.join(root, "scripts"));
		writeFileSync(
			path.join(root, "scripts", "publish-policy.json"),
			JSON.stringify({ workspaceRoots: ["packages"] }),
		);
		expect(readPublishPolicy(root)).toEqual({ workspaceRoots: ["packages"] });
	});

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

	test("parses the npm 12 payload, which is keyed by package name", () => {
		// npm 12 replaced the array with an object map. Scanning for the first `[` lands inside
		// the nested `files` array and slices a fragment that does not parse, which reported every
		// package as broken on any machine with npm 12 installed.
		const parsed = parsePackJson(
			JSON.stringify({
				"@pie-players/pie-tool-ruler": {
					filename: "pkg.tgz",
					files: [{ path: "dist/index.js" }, { path: "README.md" }],
				},
			}),
		);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].filename).toBe("pkg.tgz");
		expect(parsed[0].files[0].path).toBe("dist/index.js");
	});

	test("parses an npm 12 payload wrapped in surrounding notices", () => {
		const parsed = parsePackJson(
			'notice before\n{"pkg":{"filename":"pkg.tgz","files":[{"path":"dist/a.js"}]}}\nnotice after',
		);

		expect(parsed[0].files[0].path).toBe("dist/a.js");
	});

	test("rejects output with no JSON payload", () => {
		expect(() => parsePackJson("npm error code E404\n")).toThrow(
			"did not include JSON payload",
		);
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

	test("splits a specifier into its package name and exports key", () => {
		expect(splitPackageSpecifier("@pie-players/pie-section-player")).toEqual({
			name: "@pie-players/pie-section-player",
			subpath: ".",
		});
		expect(
			splitPackageSpecifier(
				"@pie-players/pie-section-player/contracts/host-hooks",
			),
		).toEqual({
			name: "@pie-players/pie-section-player",
			subpath: "./contracts/host-hooks",
		});
		expect(splitPackageSpecifier("semver/functions/parse")).toEqual({
			name: "semver",
			subpath: "./functions/parse",
		});
	});

	test("resolves the ESM target of the root and of a subpath", () => {
		const pkg = {
			main: "./dist/main.js",
			exports: {
				".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
				"./policies": { default: "./dist/policies/index.js" },
			},
		};
		expect(getImportTarget(pkg)).toBe("./dist/index.js");
		expect(getImportTarget(pkg, "./policies")).toBe("./dist/policies/index.js");
		expect(getImportTarget(pkg, "./missing")).toBeNull();
		expect(getImportTarget({ main: "./dist/main.js" })).toBe("./dist/main.js");
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

describe("mapConcurrent", () => {
	const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

	test("keeps input order and never runs more than the limit at once", async () => {
		let active = 0;
		let peak = 0;
		const results = await mapConcurrent(
			[5, 1, 4, 2, 3],
			async (value) => {
				active += 1;
				peak = Math.max(peak, active);
				await new Promise((resolve) => setTimeout(resolve, value * 3));
				active -= 1;
				return value * 10;
			},
			2,
		);

		expect(results).toEqual([50, 10, 40, 20, 30]);
		expect(peak).toBe(2);
	});

	test("starts nothing after a rejection and rethrows once in-flight items finish", async () => {
		const started = [];
		const finished = [];
		const run = mapConcurrent(
			[0, 1, 2, 3, 4],
			async (value) => {
				started.push(value);
				await tick();
				if (value === 0) throw new Error("pack failed");
				await tick();
				finished.push(value);
				return value;
			},
			2,
		);

		await expect(run).rejects.toThrow("pack failed");
		expect(started).toEqual([0, 1]);
		expect(finished).toEqual([1]);
	});

	test("resolves an empty list without calling fn", async () => {
		expect(
			await mapConcurrent([], () => {
				throw new Error("called");
			}),
		).toEqual([]);
	});
});

describe("defaultConditionViolations", () => {
	test("accepts a default that follows import and equals it", () => {
		expect(
			defaultConditionViolations({
				".": {
					types: "./dist/index.d.ts",
					import: "./dist/index.js",
					default: "./dist/index.js",
				},
				"./package.json": "./package.json",
			}),
		).toEqual([]);
	});

	test("reports a missing default, a misplaced one and a different target", () => {
		const violations = defaultConditionViolations({
			".": { types: "./a.d.ts", import: "./a.js" },
			"./b": { import: "./b.js", types: "./b.d.ts", default: "./b.js" },
			"./c": { import: "./c.js", default: "./other.js" },
		});
		expect(violations).toHaveLength(3);
		expect(violations[0]).toContain('"."');
		expect(violations[1]).toContain('"./b"');
		expect(violations[2]).toContain("./other.js");
	});

	test("walks nested condition objects and ignores a string-form entry", () => {
		expect(
			defaultConditionViolations({
				"./x": { node: { import: "./x.js" }, default: "./x.js" },
				"./y": "./y.js",
			}),
		).toHaveLength(1);
		expect(defaultConditionViolations(undefined)).toEqual([]);
	});

	test("reads a map without subpath keys as the root entry", () => {
		const violations = defaultConditionViolations({
			types: "./dist/index.d.ts",
			import: "./dist/index.js",
		});
		expect(violations).toEqual(['exports ".": "default" must follow "import"']);
	});

	test("requires a default after an import that is itself a condition object", () => {
		const nested = { types: "./x.d.ts", node: "./x.node.js" };
		expect(
			defaultConditionViolations({ "./x": { import: nested } }),
		).toHaveLength(1);
		expect(
			defaultConditionViolations({ "./x": { import: nested, default: { ...nested } } }),
		).toEqual([]);
	});
});
