import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	declaredTagNames,
	manifestTagNames,
	relativeSpecifiers,
	tagNameMapKeys,
	typesEntryFiles,
	undeclaredElementTags,
} from "../lib/element-declarations.mjs";

function createPackage(files) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-element-declarations-"));
	for (const [relPath, content] of Object.entries(files)) {
		const absPath = path.join(dir, relPath);
		mkdirSync(path.dirname(absPath), { recursive: true });
		writeFileSync(absPath, content);
	}
	return dir;
}

const mapOf = (...tags) =>
	`declare global { interface HTMLElementTagNameMap { ${tags
		.map((tag) => `"${tag}": HTMLElement;`)
		.join(" ")} } }\nexport {};\n`;

describe("tagNameMapKeys", () => {
	test("reads quoted and bare members of the global map", () => {
		const keys = tagNameMapKeys(
			`declare global { interface HTMLElementTagNameMap { "pie-a": X; b: Y } }`,
		);
		expect([...keys].sort()).toEqual(["b", "pie-a"]);
	});

	test("ignores other interfaces", () => {
		expect(tagNameMapKeys(`interface Other { "pie-a": X }`).size).toBe(0);
	});
});

describe("relativeSpecifiers", () => {
	test("collects imports, re-exports, import types and references, not bare packages", () => {
		expect(
			relativeSpecifiers(
				[
					'/// <reference path="./ref.d.ts" />',
					'import type { A } from "./a.js";',
					'export type { B } from "./b.js";',
					'export * from "./c.js";',
					'type D = import("./d.js").D;',
					'import type { E } from "some-package";',
				].join("\n"),
			).sort(),
		).toEqual(["./a.js", "./b.js", "./c.js", "./d.js", "./ref.d.ts"]);
	});
});

describe("declaredTagNames", () => {
	test("follows re-exports from the types entry to the map", () => {
		const dir = createPackage({
			"dist/index.d.ts": 'export type { X } from "./contracts.js";\n',
			"dist/contracts.d.ts": mapOf("pie-a"),
			"dist/orphan.d.ts": mapOf("pie-orphan"),
		});
		const pkg = { exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } } };
		expect([...declaredTagNames(dir, pkg)]).toEqual(["pie-a"]);
	});

	test("reads every types condition of every subpath", () => {
		const dir = createPackage({
			"dist/a.d.ts": mapOf("pie-a"),
			"dist/b.d.ts": mapOf("pie-b"),
		});
		const pkg = {
			exports: {
				"./a": { types: "./dist/a.d.ts" },
				"./b": { import: { types: "./dist/b.d.ts" } },
			},
		};
		expect(typesEntryFiles(dir, pkg)).toHaveLength(2);
		expect([...declaredTagNames(dir, pkg)].sort()).toEqual(["pie-a", "pie-b"]);
	});

	test("resolves a directory import to its index declaration", () => {
		const dir = createPackage({
			"dist/index.d.ts": 'import "./inner";\n',
			"dist/inner/index.d.ts": mapOf("pie-inner"),
		});
		expect([...declaredTagNames(dir, { types: "./dist/index.d.ts" })]).toEqual(["pie-inner"]);
	});

	test("finds nothing when no entry exists", () => {
		const dir = createPackage({});
		expect(declaredTagNames(dir, { types: "./dist/index.d.ts" }).size).toBe(0);
	});
});

describe("manifestTagNames", () => {
	test("lists the tag of every declaration that has one", () => {
		const dir = createPackage({
			"custom-elements.json": JSON.stringify({
				modules: [
					{ declarations: [{ tagName: "pie-a" }, { name: "Helper" }] },
					{ declarations: [{ tagName: "pie-b" }] },
				],
			}),
		});
		expect(manifestTagNames(dir, { customElements: "custom-elements.json" }).sort()).toEqual([
			"pie-a",
			"pie-b",
		]);
	});

	test("returns nothing for a package without a manifest", () => {
		expect(manifestTagNames("/nowhere", {})).toEqual([]);
	});
});

describe("undeclaredElementTags", () => {
	test("reports registered tags no declaration maps", () => {
		expect(
			undeclaredElementTags({
				tags: ["pie-a", "pie-b", "pie-a"],
				declared: new Set(["pie-a"]),
			}),
		).toEqual(["pie-b"]);
	});
});
