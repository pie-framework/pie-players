import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	findUnreachableDeclarations,
	removeDeclarations,
} from "../prune-unreachable-declarations.mjs";

function createPackage(pkg, files) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-prune-declarations-"));
	for (const [relPath, content] of Object.entries(files)) {
		const absPath = path.join(dir, relPath);
		mkdirSync(path.dirname(absPath), { recursive: true });
		writeFileSync(absPath, content);
	}
	return {
		dir,
		pkg: {
			name: "@pie-players/fixture",
			files: ["dist"],
			exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
			...pkg,
		},
	};
}

const names = (dir, files) =>
	files.map((file) => path.relative(dir, file).split(path.sep).join("/")).sort();

describe("findUnreachableDeclarations", () => {
	test("keeps what an entry imports, re-exports or references, and lists the rest", () => {
		const { dir, pkg } = createPackage(
			{},
			{
				"dist/index.d.ts":
					'/// <reference path="./globals.d.ts" />\nexport * from "./a.js";\nexport type B = typeof import("./nested/b.js");\nexport {};\n',
				"dist/a.d.ts": 'export { c } from "./nested/c.js";\n',
				"dist/globals.d.ts": "declare const x: number;\n",
				"dist/nested/b.d.ts": "export declare const b: number;\n",
				"dist/nested/c.d.ts": "export declare const c: number;\n",
				"dist/messages/de.d.ts": "export declare const de: string;\n",
				"dist/stub.d.ts": "export {};\n",
			},
		);
		expect(names(dir, findUnreachableDeclarations({ dir, pkg }))).toEqual([
			"dist/messages/de.d.ts",
			"dist/stub.d.ts",
		]);
	});

	test("an entry that is only reachable through another package's types stays out of the list", () => {
		const { dir, pkg } = createPackage(
			{
				exports: {
					".": { types: "./dist/index.d.ts" },
					"./sub": { types: "./dist/sub.d.ts" },
				},
			},
			{
				"dist/index.d.ts": 'export * from "@pie-players/other";\n',
				"dist/sub.d.ts": "export {};\n",
			},
		);
		expect(findUnreachableDeclarations({ dir, pkg })).toEqual([]);
	});

	test("never lists a file outside dist", () => {
		const { dir, pkg } = createPackage(
			{ files: ["dist", "svelte-shims.d.ts"] },
			{
				"dist/index.d.ts": "export {};\n",
				"svelte-shims.d.ts": "declare module '*.svelte';\n",
			},
		);
		expect(findUnreachableDeclarations({ dir, pkg })).toEqual([]);
	});

	test("throws when the type entry has not been built, instead of listing everything", () => {
		const { dir, pkg } = createPackage({}, { "dist/other.d.ts": "export {};\n" });
		expect(() => findUnreachableDeclarations({ dir, pkg })).toThrow(
			/missing; build the package first/,
		);
	});

	test("throws for a package with no type entry at all", () => {
		const { dir, pkg } = createPackage(
			{ exports: { ".": { import: "./dist/index.js" } } },
			{ "dist/index.js": "" },
		);
		expect(() => findUnreachableDeclarations({ dir, pkg })).toThrow(
			/no type entry exists/,
		);
	});
});

describe("removeDeclarations", () => {
	test("deletes the files, drops the directories it empties, and reports the bytes", () => {
		const { dir } = createPackage(
			{},
			{
				"dist/index.d.ts": "export {};\n",
				"dist/messages/de.d.ts": "12345",
				"dist/messages/fr.d.ts": "123",
				"dist/deep/er/x.d.ts": "12",
				"dist/kept/y.d.ts": "1",
			},
		);
		const dist = path.join(dir, "dist");
		const bytes = removeDeclarations(
			[
				path.join(dist, "messages/de.d.ts"),
				path.join(dist, "messages/fr.d.ts"),
				path.join(dist, "deep/er/x.d.ts"),
			],
			dist,
		);
		expect(bytes).toBe(10);
		expect(existsSync(path.join(dist, "messages"))).toBe(false);
		expect(existsSync(path.join(dist, "deep"))).toBe(false);
		expect(existsSync(path.join(dist, "kept/y.d.ts"))).toBe(true);
		expect(existsSync(dist)).toBe(true);
	});

	test("keeps a directory that still holds a runtime file", () => {
		const { dir } = createPackage(
			{},
			{ "dist/messages/de.d.ts": "1", "dist/messages/de.js": "export default {};" },
		);
		const dist = path.join(dir, "dist");
		removeDeclarations([path.join(dist, "messages/de.d.ts")], dist);
		expect(existsSync(path.join(dist, "messages/de.js"))).toBe(true);
	});
});
