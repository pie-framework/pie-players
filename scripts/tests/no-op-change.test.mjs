import { describe, expect, test } from "bun:test";

import { isNoOpChange } from "../lib/no-op-change.mjs";

/**
 * A stand-in formatter. Collapses whitespace runs and drops trailing commas, which
 * is enough normalising for these fixtures — the real oracle is biome.
 */
const fakeFormat = (_file, source) =>
	source
		.replace(/,(\s*[}\]])/g, "$1")
		.replace(/[ \t\n]+/g, " ")
		.trim();

/** A formatter that cannot handle the input, the way biome answers for Svelte. */
const cannotFormat = () => null;

describe("isNoOpChange", () => {
	test("JSON that parses identically is a no-op", () => {
		expect(
			isNoOpChange({
				file: "packages/theme/src/token-registry.json",
				before: '{\n\t"a": [\n\t\t"one"\n\t]\n}',
				after: '{ "a": ["one"] }',
				formatSource: cannotFormat,
			}),
		).toBe(true);
	});

	test("JSON with a changed value is significant", () => {
		expect(
			isNoOpChange({
				file: "packages/theme/src/token-registry.json",
				before: '{ "a": ["one"] }',
				after: '{ "a": ["two"] }',
				formatSource: cannotFormat,
			}),
		).toBe(false);
	});

	test("reordered JSON keys are treated as significant, not guessed at", () => {
		expect(
			isNoOpChange({
				file: "registry.json",
				before: '{ "a": 1, "b": 2 }',
				after: '{ "b": 2, "a": 1 }',
				formatSource: cannotFormat,
			}),
		).toBe(false);
	});

	test("unparseable JSON is significant rather than an error", () => {
		expect(
			isNoOpChange({
				file: "registry.json",
				before: "{ not json",
				after: '{ "a": 1 }',
				formatSource: cannotFormat,
			}),
		).toBe(false);
	});

	test("source that normalises to the same output is a no-op", () => {
		expect(
			isNoOpChange({
				file: "packages/players-shared/src/ui/content-styles.ts",
				before: "const a = {\n\tb: 1,\n};",
				after: "const a = { b: 1 };",
				formatSource: fakeFormat,
			}),
		).toBe(true);
	});

	test("source with a changed string literal is significant", () => {
		expect(
			isNoOpChange({
				file: "a.ts",
				before: 'const token = "--pie-background";',
				after: 'const token = "--pie-surface";',
				formatSource: fakeFormat,
			}),
		).toBe(false);
	});

	test("a source file the formatter cannot normalise is significant", () => {
		expect(
			isNoOpChange({
				file: "a.ts",
				before: "const a = 1;",
				after: "const  a = 1;",
				formatSource: cannotFormat,
			}),
		).toBe(false);
	});

	test("file kinds with no sound normaliser are always significant", () => {
		for (const file of [
			"packages/theme/src/tokens.css",
			"packages/section-player/src/SectionElement.svelte",
			"dev/fixture.html",
		]) {
			expect(
				isNoOpChange({
					file,
					before: "a {\n\tcolor: red;\n}",
					after: "a { color: red; }",
					formatSource: fakeFormat,
				}),
			).toBe(false);
		}
	});

	test("an added or deleted file is significant", () => {
		expect(
			isNoOpChange({
				file: "a.ts",
				before: null,
				after: "const a = 1;",
				formatSource: fakeFormat,
			}),
		).toBe(false);
		expect(
			isNoOpChange({
				file: "a.ts",
				before: "const a = 1;",
				after: null,
				formatSource: fakeFormat,
			}),
		).toBe(false);
	});

	test("byte-identical content is a no-op without consulting the formatter", () => {
		expect(
			isNoOpChange({
				file: "a.css",
				before: "a { color: red; }",
				after: "a { color: red; }",
				formatSource: () => {
					throw new Error("should not be called");
				},
			}),
		).toBe(true);
	});
});
