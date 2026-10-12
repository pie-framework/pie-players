import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	checkDocExamples,
	docFiles,
	extractFences,
} from "../check-doc-examples.mjs";

/**
 * A workspace with the given docs and three packages, linked as an install links
 * them: `@pie-players/lib`, built from TypeScript; `@pie-players/panel`, built
 * from a Svelte component, with a build older than its source; and
 * `@pie-players/typed-panel`, built from a Svelte component with its `types`
 * declarations built from TypeScript.
 */
function workspace(docs) {
	const root = mkdtempSync(path.join(tmpdir(), "pie-doc-examples-"));
	const files = {
		"package.json": JSON.stringify({ workspaces: ["packages/*"] }),
		"packages/lib/package.json": JSON.stringify({
			name: "@pie-players/lib",
			exports: { ".": "./dist/index.js" },
		}),
		"packages/lib/src/index.ts": `
export interface Options { rate?: number }
export function speak(target: Element, options: Options = {}): void {}
`,
		"packages/panel/package.json": JSON.stringify({
			name: "@pie-players/panel",
			types: "./dist/index.d.ts",
			exports: {
				".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
			},
		}),
		"packages/panel/src/index.svelte": "<script>export const open = 1;</script>",
		"packages/panel/dist/index.d.ts": "export declare const close: number;",
		"packages/typed-panel/package.json": JSON.stringify({
			name: "@pie-players/typed-panel",
			types: "./dist/index.d.ts",
			exports: {
				".": { types: "./dist/index.d.ts", import: "./dist/typed-panel.js" },
			},
		}),
		"packages/typed-panel/typed-panel.svelte": "<script>let open = 1;</script>",
		"packages/typed-panel/index.ts": "export type PanelOptions = { label: string };",
		...docs,
	};
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), text);
	}
	mkdirSync(path.join(root, "node_modules/@pie-players"), { recursive: true });
	for (const name of ["lib", "panel", "typed-panel"]) {
		symlinkSync(
			path.join(root, "packages", name),
			path.join(root, "node_modules/@pie-players", name),
		);
	}
	return root;
}

const fence = (code, lang = "ts") => `\`\`\`${lang}\n${code}\n\`\`\`\n`;

function check(markdown) {
	const root = workspace({ "docs/guide.md": markdown });
	return checkDocExamples(docFiles(root), root);
}

describe("extractFences", () => {
	test("reads ts and typescript fences with their first code line", () => {
		const markdown = [
			"# Guide",
			"```ts",
			"const a = 1;",
			"```",
			"```js",
			"const b = 2;",
			"```",
			"1. Step",
			"   ```typescript title",
			"   const c = 3;",
			"   ```",
		].join("\n");
		expect(extractFences(markdown)).toEqual([
			{ line: 3, code: "const a = 1;" },
			{ line: 10, code: "const c = 3;" },
		]);
	});
});

describe("checkDocExamples", () => {
	test("passes an example that uses the package as it is", () => {
		const result = check(
			fence(`import { speak } from "@pie-players/lib";
speak(document.body, { rate: 1.5 });`),
		);
		expect(result).toEqual({ checked: 1, skipped: 0, failures: [] });
	});

	test("reports drift at its line in the doc", () => {
		const result = check(
			`# Guide\n\n${fence(`import { speak, pause } from "@pie-players/lib";
speak("text", { volume: 1 });`)}`,
		);
		expect(result.failures).toEqual([
			`docs/guide.md:4: TS2305 Module '"@pie-players/lib"' has no exported member 'pause'.`,
			`docs/guide.md:5: TS2345 Argument of type 'string' is not assignable to parameter of type 'Element'.`,
		]);
	});

	test("reports a missing workspace module and no other", () => {
		const result = check(
			fence(`import { speak } from "@pie-players/lib/missing";
import * as element from "@pie-element/multiple-choice";
import manifest from "../package.json";`),
		);
		expect(result.failures).toEqual([
			`docs/guide.md:2: TS2307 Cannot find module '@pie-players/lib/missing' or its corresponding type declarations.`,
		]);
	});

	test("types an entry built from Svelte as any, whatever its build says", () => {
		const result = check(
			fence(`import { open } from "@pie-players/panel";
open.toFixed();`),
		);
		expect(result.failures).toEqual([]);
	});

	test("checks a Svelte-built entry against the source of its types", () => {
		const result = check(
			fence(`import type { PanelOptions } from "@pie-players/typed-panel";
const options: PanelOptions = { label: 1 };`),
		);
		expect(result.failures).toEqual([
			"docs/guide.md:3: TS2322 Type 'number' is not assignable to type 'string'.",
		]);
	});

	test("types free names and element properties as any", () => {
		const result = check(
			fence(`import { speak } from "@pie-players/lib";
const player = document.querySelector("pie-section-player-splitpane");
player.runtime = { coordinator };
speak(player, coordinator.options);`),
		);
		expect(result.failures).toEqual([]);
	});

	test("skips a fence without a package import, and PRDs", () => {
		const root = workspace({
			"docs/guide.md": fence("tools: { placement: string[] }"),
			"docs/prds/proposal.md": fence(
				`import { pause } from "@pie-players/lib";`,
			),
		});
		expect(checkDocExamples(docFiles(root), root)).toEqual({
			checked: 0,
			skipped: 1,
			failures: [],
		});
	});
});
