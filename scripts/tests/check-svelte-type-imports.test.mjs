import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	findModuleReferences,
	findSvelteTypeImports,
} from "../check-svelte-type-imports.mjs";

/** What vite-plugin-dts writes for a `.svelte` file: the declaration every hit had. */
const COMPONENT_STUB = "export { SvelteComponent as default } from 'svelte';\n";

function createPackage(pkg, files) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-svelte-type-imports-"));
	for (const [relPath, content] of Object.entries(files)) {
		const absPath = path.join(dir, relPath);
		mkdirSync(path.dirname(absPath), { recursive: true });
		writeFileSync(absPath, content);
	}
	return {
		dir,
		pkg: { name: "@pie-players/fixture", files: ["dist"], ...pkg },
	};
}

const rootTypes = (types, runtime = "./dist/index.js") => ({
	types,
	exports: { ".": { types, import: runtime } },
});

const describeFindings = (fixture) =>
	findSvelteTypeImports(fixture).findings.map(
		({ chain, reason }) => `${chain.join(" -> ")} ${reason}`,
	);

describe("findSvelteTypeImports", () => {
	test("follows an insertTypesEntry entry to the component stub it imports", () => {
		const fixture = createPackage(rootTypes("./dist/index.d.ts"), {
			"dist/index.d.ts":
				"export {}\nimport Panel from './EventPanel.svelte.js'\nexport default Panel\nexport {}\n",
			"dist/EventPanel.svelte.d.ts": COMPONENT_STUB,
		});
		expect(describeFindings(fixture)).toEqual([
			'dist/index.d.ts -> dist/EventPanel.svelte.d.ts imports "svelte"',
		]);
	});

	test("flags a type entry that is itself the component stub", () => {
		const fixture = createPackage(rootTypes("./dist/tool.svelte.d.ts"), {
			"dist/tool.svelte.d.ts": COMPONENT_STUB,
		});
		expect(describeFindings(fixture)).toEqual([
			'dist/tool.svelte.d.ts imports "svelte"',
		]);
	});

	test("resolves an extensionless `.svelte` re-export through an intermediate entry", () => {
		const fixture = createPackage(rootTypes("./dist/index.types.d.ts"), {
			"dist/index.types.d.ts": "export * from './index.js'\nexport {}\n",
			"dist/index.d.ts":
				"export { default as Panel } from './Panel.svelte';\nexport { helper } from './helper.js';\n",
			"dist/Panel.svelte.d.ts": COMPONENT_STUB,
			"dist/helper.d.ts": "export declare function helper(): void;\n",
		});
		expect(describeFindings(fixture)).toEqual([
			'dist/index.d.ts -> dist/Panel.svelte.d.ts imports "svelte"',
		]);
	});

	test("flags a shipped stub that no type entry reaches", () => {
		const fixture = createPackage(rootTypes("./dist/index.d.ts"), {
			"dist/index.d.ts": "export declare function definePlayer(): void;\n",
			"dist/Player.svelte.d.ts": COMPONENT_STUB,
		});
		expect(describeFindings(fixture)).toEqual([
			'dist/Player.svelte.d.ts imports "svelte" and ships, though no type entry reaches it',
		]);
	});

	test("flags every form a declaration can load svelte in", () => {
		const fixture = createPackage(rootTypes("./dist/index.d.ts"), {
			"dist/index.d.ts": [
				'/// <reference types="svelte" />',
				'export type Mount = typeof import("svelte").mount;',
				'import Legacy = require("svelte/legacy");',
				'declare module "svelte/elements" {}',
				"export {};",
			].join("\n"),
		});
		expect(describeFindings(fixture)).toEqual([
			'dist/index.d.ts imports "svelte"',
			'dist/index.d.ts imports "svelte/legacy"',
			'dist/index.d.ts imports "svelte/elements"',
			'dist/index.d.ts imports "svelte"',
		]);
	});

	test("accepts svelte named in prose, in other packages, and outside `files`", () => {
		const fixture = createPackage(rootTypes("./dist/index.d.ts"), {
			"dist/index.d.ts": [
				"/**",
				' * Svelte hosts need nothing extra: `import { mount } from "svelte"`',
				" * is not required.",
				" */",
				'export type { Options } from "svelte-preprocess";',
				'export type { Contract } from "@pie-players/pie-assessment-toolkit";',
				"export declare const message = \"from 'svelte'\";",
			].join("\n"),
			// Not in `files`, so npm does not pack it.
			"Panel.svelte.d.ts": COMPONENT_STUB,
		});
		expect(describeFindings(fixture)).toEqual([]);
	});

	test("reports a type entry that was never built instead of passing it", () => {
		const fixture = createPackage(rootTypes("./dist/index.d.ts"), {});
		expect(describeFindings(fixture)).toEqual([
			"dist/index.d.ts is a type entry that does not exist; build first",
		]);
	});
});

describe("findModuleReferences", () => {
	test("reads specifiers from syntax, not from comments", () => {
		const { specifiers } = findModuleReferences(
			'// import { mount } from "svelte";\nexport type { A } from "./a.js";\n',
		);
		expect(specifiers).toEqual(["./a.js"]);
	});
});
