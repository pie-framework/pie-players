import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderReports } from "../api-report.mjs";
import { formatModuleExports, moduleExports } from "../lib/api-exports.mjs";

/** Writes `files` (relative path -> text) under a fresh directory. */
function fixture(files) {
	const root = mkdtempSync(path.join(tmpdir(), "pie-api-report-"));
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), text);
	}
	return root;
}

const namesOf = (root, file, options) =>
	formatModuleExports(moduleExports(path.join(root, file), options));

describe("moduleExports", () => {
	test("reads declarations by kind", () => {
		const root = fixture({
			"index.ts": `
export interface Shape {}
export type Alias = string;
export const value = 1, [first] = [2];
export function run() {}
export class Service {}
export enum Level { A }
const local = 1;
`,
		});
		expect(namesOf(root, "index.ts")).toEqual([
			"type Alias",
			"Level",
			"Service",
			"type Shape",
			"first",
			"run",
			"value",
		]);
	});

	test("marks a re-export a type only where the syntax says so", () => {
		const root = fixture({
			"index.ts": `
import type { Imported } from "./types.js";
import { helper } from "./types.js";
interface Local {}
export { Imported, helper, Local };
export type { Named } from "./types.js";
export { type Inline, Value } from "./types.js";
`,
			"types.ts": "export interface Named {}",
		});
		expect(namesOf(root, "index.ts")).toEqual([
			"type Imported",
			"type Inline",
			"type Local",
			"type Named",
			"Value",
			"helper",
		]);
	});

	test("follows star exports and reports the ones it cannot read", () => {
		const root = fixture({
			"index.ts": `
export * from "./a.js";
export type * from "./b.js";
export * as ns from "./a.js";
export * from "@pie-players/sibling";
export * from "outside-package";
`,
			"a.ts": "export const a = 1;\nexport default 2;\nexport * from './index.js';",
			"b.ts": "export const b = 1;",
			"sibling.ts": "export function fromSibling() {}",
		});
		const resolvePackage = (specifier) =>
			specifier === "@pie-players/sibling"
				? path.join(root, "sibling.ts")
				: undefined;
		expect(namesOf(root, "index.ts", { resolvePackage })).toEqual([
			"a",
			"type b",
			"fromSibling",
			"ns",
			'* from "outside-package"',
		]);
	});

	test("a name exported as a type and a value is a value", () => {
		const root = fixture({
			"index.ts": `
export const Mode = { A: "a" } as const;
export type Mode = (typeof Mode)[keyof typeof Mode];
`,
		});
		expect(namesOf(root, "index.ts")).toEqual(["Mode"]);
	});

	test("reads defaults, Svelte module scripts and JSON", () => {
		const root = fixture({
			"index.ts": `
export { default as Panel, registration } from "./Panel.svelte";
export { default as data } from "./data.json";
`,
			"Panel.svelte": `<script module lang="ts">
	export const registration = { tag: "x-panel" } as const;
</script>
<script lang="ts">
	export const notModule = 1;
</script>`,
			"data.json": "{}",
			"entry.svelte": `<script module lang="ts">
	export type Props = {};
</script>`,
		});
		expect(namesOf(root, "index.ts")).toEqual(["Panel", "data", "registration"]);
		expect(namesOf(root, "entry.svelte")).toEqual(["type Props", "default"]);
	});
});

describe("renderReports", () => {
	test("lists each published package's entries and skips private ones", () => {
		const root = fixture({
			"package.json": JSON.stringify({ workspaces: ["packages/*"] }),
			"packages/lib/package.json": JSON.stringify({
				name: "@pie-players/lib",
				exports: {
					".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
					"./side-effect": "./dist/side-effect.js",
					"./styles.css": "./dist/styles.css",
				},
			}),
			"packages/lib/src/index.ts":
				'export * from "@pie-players/internal";\nexport type Options = {};',
			"packages/lib/src/side-effect.ts": "globalThis.x = 1;",
			"packages/internal/package.json": JSON.stringify({
				name: "@pie-players/internal",
				private: true,
				exports: { ".": "./dist/index.js" },
			}),
			"packages/internal/src/index.ts": "export const shared = 1;",
		});
		const reports = renderReports(root);
		expect([...reports.keys()]).toEqual(["lib.api.txt"]);
		expect(reports.get("lib.api.txt")).toEndWith(
			"@pie-players/lib\n\n.\n  type Options\n  shared\n\n./side-effect\n  (no named exports)\n",
		);
	});
});
