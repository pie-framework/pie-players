import { describe, expect, test } from "bun:test";

import {
	findIdenticalFiles,
	findInlinedHostSharedPackages,
	needsFullySpecifiedSubpath,
	splitBareSpecifier,
} from "../check-bundle-safety.mjs";

describe("findIdenticalFiles", () => {
	test("groups files with the same bytes, sorted", () => {
		const locale = 'const e={"nav.next":"Volgende"};export{e as default};';
		expect(
			findIdenticalFiles([
				{ path: "chunks/nl-NL-b.js", content: locale },
				{ path: "pie-section-player.js", content: "export{};" },
				{ path: "chunks/nl-NL-a.js", content: locale },
			]),
		).toEqual([["chunks/nl-NL-a.js", "chunks/nl-NL-b.js"]]);
	});

	test("ignores the empty modules type-only entries compile to", () => {
		expect(
			findIdenticalFiles([
				{ path: "contracts/host-hooks.js", content: "" },
				{ path: "contracts/layout-contract.js", content: "" },
				{ path: "services/types.js", content: "export {};\n" },
				{ path: "services/tts/types.js", content: "export {};\n" },
			]),
		).toEqual([]);
	});

	test("accepts a build whose files all differ", () => {
		expect(
			findIdenticalFiles([
				{ path: "a.js", content: "export const a=1;" },
				{ path: "b.js", content: "export const a=2;" },
			]),
		).toEqual([]);
	});
});

describe("findInlinedHostSharedPackages", () => {
	test("names each shared package whose marker a bundle carries", () => {
		const inlined = [
			'const t=Symbol.for("pie.assessmentToolkit.runtimeContext");',
			'class R extends Event{constructor(){super("context-request",{bubbles:!0})}}',
			"throw new Error(`Failed to load i18n catalog for locale: ${l}`);",
		].join("");
		expect(findInlinedHostSharedPackages(inlined)).toEqual([
			"@pie-players/pie-assessment-toolkit",
			"@pie-players/pie-context",
			"@pie-players/pie-players-shared",
		]);
	});

	test("accepts a tool that imports them by name", () => {
		const imported = [
			'import{connectToolRuntimeContext as a}from"@pie-players/pie-assessment-toolkit";',
			'import{resolveInterfaceI18n as b}from"@pie-players/pie-players-shared/i18n/provider";',
		].join("");
		expect(findInlinedHostSharedPackages(imported)).toEqual([]);
	});
});

describe("splitBareSpecifier", () => {
	test("splits scoped and unscoped specifiers", () => {
		expect(splitBareSpecifier("@pie-lib/math-rendering-module/module")).toEqual(
			{ name: "@pie-lib/math-rendering-module", subpath: "module" },
		);
		expect(
			splitBareSpecifier("speech-rule-engine/lib/mathmaps/base.json"),
		).toEqual({
			name: "speech-rule-engine",
			subpath: "lib/mathmaps/base.json",
		});
		expect(splitBareSpecifier("dompurify")).toEqual({
			name: "dompurify",
			subpath: "",
		});
	});

	test("ignores relative paths and URLs", () => {
		expect(splitBareSpecifier("./chunks/a.js")).toBeNull();
		expect(splitBareSpecifier("https://esm.run/x")).toBeNull();
		expect(splitBareSpecifier("node:fs")).toBeNull();
	});
});

describe("needsFullySpecifiedSubpath", () => {
	const noExportsMap = {
		name: "@pie-lib/math-rendering-module",
		module: "module/index.js",
	};

	test("flags a directory subpath into a package without an exports map", () => {
		expect(
			needsFullySpecifiedSubpath(
				"@pie-lib/math-rendering-module/module",
				noExportsMap,
			),
		).toBe(true);
	});

	test("accepts the file itself", () => {
		expect(
			needsFullySpecifiedSubpath(
				"@pie-lib/math-rendering-module/module/index.js",
				noExportsMap,
			),
		).toBe(false);
		expect(
			needsFullySpecifiedSubpath("speech-rule-engine/lib/mathmaps/en.json", {
				name: "speech-rule-engine",
			}),
		).toBe(false);
	});

	test("accepts any subpath an exports map declares, and a bare package", () => {
		expect(
			needsFullySpecifiedSubpath("@pie-players/pie-players-shared/pie", {
				name: "@pie-players/pie-players-shared",
				exports: { "./pie": "./dist/pie/index.js" },
			}),
		).toBe(false);
		expect(needsFullySpecifiedSubpath("dompurify", { name: "dompurify" })).toBe(
			false,
		);
	});
});
