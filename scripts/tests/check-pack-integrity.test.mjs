import { describe, expect, test } from "bun:test";

import {
	assertPublishablePackagesChecked,
	collectExportTargetViolations,
	collectManifestSurfaceViolations,
	collectPackedFileSurfaceViolations,
} from "../check-pack-integrity.mjs";

describe("check-pack-integrity rule functions", () => {
	test("flags manifest targets that expose source files or forbidden conditions", () => {
		const violations = collectManifestSurfaceViolations(
			{
				name: "@pie-players/example",
				files: ["dist", "src/internal.ts"],
				svelte: "./src/Component.svelte",
				exports: {
					".": {
						import: "./dist/index.js",
						svelte: "./src/index.svelte",
					},
					"./internal": "./dist/internal.js",
				},
			},
			new Map([["@pie-players/example", ["./internal"]]]),
		);

		expect(violations).toContain(
			"files[] includes source path: src/internal.ts",
		);
		expect(violations).toContain("package-level svelte field is not allowed");
		expect(violations).toContain('export condition "svelte" is not allowed');
		expect(violations).toContain(
			"forbidden public export is present: ./internal",
		);
		expect(violations).toContain(
			"export target points at src: ./src/index.svelte",
		);
	});

	test("flags packed raw source files outside the allowed publish surface", () => {
		const violations = collectPackedFileSurfaceViolations(
			new Set(["dist/index.js", "src/internal.ts", "README.md"]),
			{},
		);

		expect(violations).toEqual([
			"packed file is outside dist/metadata/assets: src/internal.ts",
		]);
	});

	test("flags missing and unstable declared export targets", () => {
		const violations = collectExportTargetViolations(
			new Set(["dist/index.js", "dist/chunk-a1b2c3d4.js"]),
			new Set(["dist/index.js"]),
		);

		expect(violations).toContain("missing: dist/chunk-a1b2c3d4.js");
		expect(violations).toContain(
			"unstable export target (hashed suffix filename): dist/chunk-a1b2c3d4.js",
		);
	});

	test("fails closed when no publishable packages were checked", () => {
		expect(() => assertPublishablePackagesChecked(0)).toThrow(
			/no publishable packages discovered/,
		);
		expect(() => assertPublishablePackagesChecked(1)).not.toThrow();
	});
});
