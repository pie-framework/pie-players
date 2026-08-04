import { describe, expect, test } from "bun:test";

import {
	findPublishedSourcemaps,
	findStaticSpeechRuleEngineImports,
	hasInlinedSpeechRuleEngine,
	looksUnminified,
} from "../check-bundle-safety.mjs";

// Roughly the shape the toolkit CE artifact had before it was minified:
// ~40 bytes per line across tens of thousands of lines.
const unminifiedLike = `${"var someReasonablyNamedIdentifier = 1;\n".repeat(1000)}`;
// And after: one very long line.
const minifiedLike = `var a=1,b=2,c=3;${"x".repeat(30_000)}`;

describe("looksUnminified", () => {
	test("flags a large bundle made of short lines", () => {
		expect(looksUnminified(unminifiedLike)).toBe(true);
	});

	test("accepts a large bundle on very few lines", () => {
		expect(looksUnminified(minifiedLike)).toBe(false);
	});

	test("skips small files, which can be one line either way", () => {
		expect(
			looksUnminified('import"./chunks/a.js";\nexport{a as default};\n'),
		).toBe(false);
	});

	test("a minified bundle with some newlines still passes", () => {
		// Minifiers keep the odd newline (license banners, template literals).
		const content = `${"y".repeat(25_000)}\n${"z".repeat(25_000)}`;
		expect(looksUnminified(content)).toBe(false);
	});
});

describe("hasInlinedSpeechRuleEngine", () => {
	test("flags the mathmaps CDN template that only exists inside SRE itself", () => {
		const content =
			"Variables.url = 'https://cdn.jsdelivr.net/npm/speech-rule-engine@' + Variables.VERSION + '/lib/mathmaps';";
		expect(hasInlinedSpeechRuleEngine(content)).toBe(true);
	});

	test("does not flag the toolkit mentioning SRE domains as config values", () => {
		// math-speech.ts documents and passes these as `domain` / `style` options,
		// so a domain name would be a false-positive marker.
		const content =
			'const domain = options.domain ?? "clearspeak"; const alt = "mathspeak";';
		expect(hasInlinedSpeechRuleEngine(content)).toBe(false);
	});

	test("does not flag merely importing the package", () => {
		expect(
			hasInlinedSpeechRuleEngine('await import("speech-rule-engine")'),
		).toBe(false);
	});
});

describe("findStaticSpeechRuleEngineImports", () => {
	test("accepts the dynamic import, which is the whole point", () => {
		expect(
			findStaticSpeechRuleEngineImports(
				'let m=await import("speech-rule-engine");',
			),
		).toEqual([]);
	});

	test("flags a static default/named import", () => {
		expect(
			findStaticSpeechRuleEngineImports(
				'import sre from "speech-rule-engine";\n',
			),
		).toHaveLength(1);
	});

	test("flags the minified no-space form", () => {
		expect(
			findStaticSpeechRuleEngineImports('import{a}from"speech-rule-engine";'),
		).toHaveLength(1);
	});

	test("flags a static subpath import", () => {
		expect(
			findStaticSpeechRuleEngineImports(
				'import { engineReady } from "speech-rule-engine/js/common/system";',
			),
		).toHaveLength(1);
	});

	test("flags a side-effect-only static import", () => {
		expect(
			findStaticSpeechRuleEngineImports('import"speech-rule-engine";'),
		).toHaveLength(1);
	});

	test("flags a re-export", () => {
		expect(
			findStaticSpeechRuleEngineImports(
				'export { toSpeech } from "speech-rule-engine";',
			),
		).toHaveLength(1);
	});

	test("ignores unrelated packages", () => {
		expect(
			findStaticSpeechRuleEngineImports(
				'import x from "@pie-players/pie-players-shared";',
			),
		).toEqual([]);
	});
});

describe("findPublishedSourcemaps", () => {
	test("flags .map files in published output", () => {
		expect(
			findPublishedSourcemaps([
				"packages/assessment-toolkit/dist/index.js",
				"packages/assessment-toolkit/dist/index.js.map",
				"packages/theme/dist/a.d.ts",
			]),
		).toEqual(["packages/assessment-toolkit/dist/index.js.map"]);
	});

	test("passes when no maps are published", () => {
		expect(
			findPublishedSourcemaps(["packages/assessment-toolkit/dist/index.js"]),
		).toEqual([]);
	});
});
