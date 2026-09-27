import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { findUnusedRuntimeDependencies } from "../check-publint.mjs";

function createPackage(files) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-publint-unused-deps-"));
	for (const [relPath, content] of Object.entries(files)) {
		const absPath = path.join(dir, relPath);
		mkdirSync(path.dirname(absPath), { recursive: true });
		writeFileSync(absPath, content);
	}
	return dir;
}

const SHIPPED = {
	"dist/index.js":
		'import { a } from "js-dep/sub";\nexport * from "./chunk.js";\n',
	"dist/chunk.js":
		'export const load = () => import("@scope/lazy-dep/deep");\n',
	"dist/index.d.ts":
		'/// <reference types="referenced" />\nimport type { T } from "types-dep";\nexport type { T };\n',
	"dist/theme.css": '@import "css-dep/tokens.css";\n',
	"src/index.ts": 'import "unused-dep";\n',
};

const DEPENDENCIES = {
	"js-dep": "^1.0.0",
	"@scope/lazy-dep": "^1.0.0",
	"types-dep": "^1.0.0",
	"@types/referenced": "^1.0.0",
	"css-dep": "^1.0.0",
	"unused-dep": "^1.0.0",
};

describe("findUnusedRuntimeDependencies", () => {
	test("names each dependency no shipped script, declaration or stylesheet imports", () => {
		const dir = createPackage(SHIPPED);
		expect(
			findUnusedRuntimeDependencies(dir, {
				name: "@pie-players/fixture",
				files: ["dist"],
				dependencies: DEPENDENCIES,
			}),
		).toEqual(["unused-dep"]);
	});

	test("reads dist when the manifest lists no files", () => {
		const dir = createPackage(SHIPPED);
		expect(
			findUnusedRuntimeDependencies(dir, {
				name: "@pie-players/fixture",
				dependencies: DEPENDENCIES,
			}),
		).toEqual(["unused-dep"]);
	});

	test("counts an import from a shipped file outside dist", () => {
		const dir = createPackage(SHIPPED);
		expect(
			findUnusedRuntimeDependencies(dir, {
				name: "@pie-players/fixture",
				files: ["dist", "src/index.ts"],
				dependencies: DEPENDENCIES,
			}),
		).toEqual([]);
	});

	test("accepts a package with no dependencies", () => {
		const dir = createPackage(SHIPPED);
		expect(
			findUnusedRuntimeDependencies(dir, { name: "@pie-players/fixture" }),
		).toEqual([]);
	});
});
