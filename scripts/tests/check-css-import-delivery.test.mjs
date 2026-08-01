import { describe, expect, test } from "bun:test";

import { findPlainCssImports } from "../check-css-import-delivery.mjs";

describe("findPlainCssImports", () => {
	test("flags a bare CSS import, which is the shape that never loads", () => {
		const found = findPlainCssImports(
			'import "./highlights.css";\n',
			"packages/tool-annotation-toolbar/tool-annotation-toolbar.svelte",
		);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ line: 1, specifier: "./highlights.css" });
	});

	test("flags a cross-package CSS subpath import", () => {
		const found = findPlainCssImports(
			'\timport "@pie-players/pie-theme/components.css";\n',
			"packages/x/Panel.svelte",
		);
		expect(found).toHaveLength(1);
		expect(found[0].specifier).toBe("@pie-players/pie-theme/components.css");
	});

	test("accepts ?raw, which is the supported delivery path", () => {
		const source = 'import contentStyles from "@pie-players/pie-theme/components.css?raw";\n';
		expect(findPlainCssImports(source, "packages/item-player/src/x.ts")).toEqual([]);
	});

	test("accepts ?inline and ?url for the same reason", () => {
		expect(
			findPlainCssImports('import a from "./a.css?inline";\n', "p/a.ts"),
		).toEqual([]);
		expect(
			findPlainCssImports('import b from "./b.css?url";\n', "p/b.ts"),
		).toEqual([]);
	});

	test("ignores non-CSS imports", () => {
		const source = 'import { x } from "./x.js";\nimport "./side-effect.js";\n';
		expect(findPlainCssImports(source, "p/x.ts")).toEqual([]);
	});

	test("ignores an import named inside a string, e.g. advice in a warning message", () => {
		// Real shape from auditContentStyles: the warning tells hosts what to
		// import. An unanchored pattern flags this and the check gets disabled.
		const source = [
			"\t\t\t\tconsole.warn(",
			'\t\t\t\t\t`Either import "@pie-players/pie-theme/components.css" in the host app, or ` +',
			'\t\t\t\t\t\t`drop the attribute.`,',
			"\t\t\t\t);",
		].join("\n");
		expect(findPlainCssImports(source, "packages/players-shared/src/ui/x.ts")).toEqual(
			[],
		);
	});

	test("ignores mentions inside comments, so documentation does not fail the gate", () => {
		const source = [
			'// import "./old.css"; -- removed, it never loaded',
			' * import "./also-old.css";',
		].join("\n");
		expect(findPlainCssImports(source, "p/x.ts")).toEqual([]);
	});

	test("reports every occurrence with its line number", () => {
		const source = ['import "./a.css";', "", 'import "./b.css";'].join("\n");
		const found = findPlainCssImports(source, "p/x.svelte");
		expect(found.map((f) => [f.line, f.specifier])).toEqual([
			[1, "./a.css"],
			[3, "./b.css"],
		]);
	});
});
