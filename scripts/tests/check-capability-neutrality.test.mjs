import { describe, expect, test } from "bun:test";

import { stripComments } from "../lib/strip-comments.mjs";

const quoted = (id, source) =>
	new RegExp(`["'\`]${id}["'\`]`).test(stripComments(source));

describe("stripComments", () => {
	test("blanks a line comment", () => {
		expect(quoted("calculator", '// names "calculator" in prose\n')).toBe(false);
	});

	test("blanks a block comment", () => {
		expect(quoted("calculator", '/* names "calculator" in prose */\n')).toBe(
			false,
		);
	});

	test("blanks a markup comment, so .svelte prose is exempt too", () => {
		expect(quoted("calculator", '<!-- names "calculator" -->\n')).toBe(false);
	});

	test("keeps a string literal, which is what the check looks for", () => {
		expect(quoted("calculator", "const id = 'calculator';\n")).toBe(true);
	});

	test("a `/*` inside a line comment does not open a block comment", () => {
		// The bug this replaced: block comments were stripped before line comments,
		// so `@pie-players/*` in a `//` comment swallowed every line up to the next
		// `*/` — hiding real code from the check. ItemToolBar.svelte had two such
		// comments and ~700 lines went unchecked behind them.
		const source = [
			"// the CE build externalizes @pie-players/*, so this is a bare import",
			"const id = 'calculator';",
			"/* a later block comment closes here */",
		].join("\n");
		expect(quoted("calculator", source)).toBe(true);
	});

	test("a `//` inside a block comment does not start a line comment", () => {
		const source = [
			"/* see https://example.com/docs",
			" * still comment */",
			"const id = 'calculator';",
		].join("\n");
		expect(quoted("calculator", source)).toBe(true);
	});

	test("a comment opener inside a string does not open a comment", () => {
		const source = ["const pattern = '/*';", "const id = 'calculator';"].join(
			"\n",
		);
		expect(quoted("calculator", source)).toBe(true);
	});

	test("preserves line count so positions still line up", () => {
		const source = "a\n/* two\nlines */\nb\n";
		expect(stripComments(source).split("\n")).toHaveLength(
			source.split("\n").length,
		);
	});
});
