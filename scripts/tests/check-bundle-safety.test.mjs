import { describe, expect, test } from "bun:test";

import {
	analyzeSpeechRuleEngineBoundary,
	findInlinedSreLocaleTables,
	findModuleSpecifiers,
	findPublishedSourcemaps,
	findUnguardedCustomElementDefines,
	hasInlinedSpeechRuleEngine,
	hasSvelteDevRuntime,
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

describe("findInlinedSreLocaleTables", () => {
	test("reads the locale of a table bundled as an object literal", () => {
		const content =
			'var e={"base/functions/algebra.min":[{locale:"base"}],"base/symbols/digits.min":[]};export{e as default};';
		expect(findInlinedSreLocaleTables(content)).toEqual(["base"]);
	});

	test("reads tables bundled as a JSON.parse string", () => {
		const content =
			'const e=JSON.parse(\'{"es/messages/alphabets.min":[],"en/rules/clearspeak_english.min":[]}\');';
		expect(findInlinedSreLocaleTables(content)).toEqual(["en", "es"]);
	});

	test("does not flag a dynamic import of a table", () => {
		expect(
			findInlinedSreLocaleTables(
				'en:()=>import("speech-rule-engine/lib/mathmaps/en.json")',
			),
		).toEqual([]);
	});
});

describe("findModuleSpecifiers", () => {
	test("reads a dynamic import as dynamic only", () => {
		expect(
			findModuleSpecifiers('let m=await import("speech-rule-engine");'),
		).toEqual({ static: [], dynamic: ["speech-rule-engine"] });
	});

	test("reads a dynamic import that carries import attributes", () => {
		expect(
			findModuleSpecifiers(
				'en:()=>import("speech-rule-engine/lib/mathmaps/en.json",{with:{type:"json"}})',
			).dynamic,
		).toEqual(["speech-rule-engine/lib/mathmaps/en.json"]);
	});

	test("reads a default import", () => {
		expect(
			findModuleSpecifiers('import sre from "speech-rule-engine";\n').static,
		).toEqual(["speech-rule-engine"]);
	});

	test("reads the minified no-space forms", () => {
		expect(
			findModuleSpecifiers(
				'import{a}from"./chunks/a.js";import*as b from"speech-rule-engine";',
			).static,
		).toEqual(["./chunks/a.js", "speech-rule-engine"]);
	});

	test("reads a subpath import", () => {
		expect(
			findModuleSpecifiers(
				'import { engineReady } from "speech-rule-engine/js/common/system";',
			).static,
		).toEqual(["speech-rule-engine/js/common/system"]);
	});

	test("reads a side-effect-only import", () => {
		expect(findModuleSpecifiers('import"./chunks/b.js";').static).toEqual([
			"./chunks/b.js",
		]);
	});

	test("reads a re-export", () => {
		expect(
			findModuleSpecifiers('export { toSpeech } from "speech-rule-engine";')
				.static,
		).toEqual(["speech-rule-engine"]);
	});

	test("ignores an export list with no source module", () => {
		expect(findModuleSpecifiers("var y=q;export{y as default};")).toEqual({
			static: [],
			dynamic: [],
		});
	});
});

describe("analyzeSpeechRuleEngineBoundary", () => {
	// The shape the toolkit's CE build emits: the entry reaches the engine chunk
	// only through `import()`, and the engine chunk imports SRE statically so it
	// can configure SRE the moment SRE evaluates.
	const toolkitShape = [
		{
			path: "Toolkit.custom-element.js",
			content:
				'import{k}from"./chunks/shared.js";const load=()=>import("./chunks/sre-engine.js");',
		},
		{
			path: "chunks/shared.js",
			content:
				'var t={en:()=>import("speech-rule-engine/lib/mathmaps/en.json",{with:{type:"json"}})};export{t as k};',
		},
		{
			path: "chunks/sre-engine.js",
			content:
				'import{k}from"./shared.js";import*as b from"speech-rule-engine";b.setupEngine(k);export{b as d};',
		},
	];

	test("accepts SRE imported statically from a lazily loaded chunk", () => {
		expect(analyzeSpeechRuleEngineBoundary(toolkitShape)).toEqual({
			issues: [],
			lazyEngineModules: ["chunks/sre-engine.js"],
			dynamicEngineImporters: [],
			tableImporters: ["chunks/shared.js"],
		});
	});

	test("accepts a static import further down a lazily loaded chain", () => {
		const result = analyzeSpeechRuleEngineBoundary([
			{ path: "entry.js", content: 'const l=()=>import("./lazy.js");' },
			{ path: "lazy.js", content: 'import"./engine.js";' },
			{ path: "engine.js", content: 'import*as b from"speech-rule-engine";' },
		]);
		expect(result.issues).toEqual([]);
		expect(result.lazyEngineModules).toEqual(["engine.js"]);
	});

	test("reports a dynamic import of SRE itself as a lazy route to it", () => {
		expect(
			analyzeSpeechRuleEngineBoundary([
				{
					path: "entry.js",
					content: 'const l=()=>import("speech-rule-engine");',
				},
			]).dynamicEngineImporters,
		).toEqual(["entry.js"]);
	});

	test("flags an entry that imports SRE statically", () => {
		expect(
			analyzeSpeechRuleEngineBoundary([
				{ path: "entry.js", content: 'import sre from "speech-rule-engine";' },
			]).issues,
		).toEqual([
			"entry.js imports speech-rule-engine statically and is an entry; only a module reached through a dynamic import may import it statically",
		]);
	});

	test("flags an engine chunk that an entry also imports statically", () => {
		const [entry, ...rest] = toolkitShape;
		const result = analyzeSpeechRuleEngineBoundary([
			{
				...entry,
				content: `import"./chunks/sre-engine.js";${entry.content}`,
			},
			...rest,
		]);
		expect(result.issues).toEqual([
			"chunks/sre-engine.js imports speech-rule-engine statically and loads eagerly with Toolkit.custom-element.js; only a module reached through a dynamic import may import it statically",
		]);
		expect(result.lazyEngineModules).toEqual([]);
	});

	test("flags a module that imports SRE statically but nothing loads", () => {
		// Two modules importing each other have no entry and no dynamic importer.
		expect(
			analyzeSpeechRuleEngineBoundary([
				{
					path: "a.js",
					content: 'import"./b.js";import*as s from"speech-rule-engine";',
				},
				{ path: "b.js", content: 'import"./a.js";' },
			]).issues,
		).toEqual([
			"a.js imports speech-rule-engine statically, but no dynamic import reaches it",
		]);
	});

	test("flags a locale table imported statically, even from a lazy chunk", () => {
		const result = analyzeSpeechRuleEngineBoundary([
			{ path: "entry.js", content: 'const l=()=>import("./lazy.js");' },
			{
				path: "lazy.js",
				content:
					'import en from"speech-rule-engine/lib/mathmaps/en.json"with{type:"json"};',
			},
		]);
		expect(result.issues).toEqual([
			"lazy.js imports a speech-rule-engine locale table statically (speech-rule-engine/lib/mathmaps/en.json); the tables must stay behind a dynamic import",
		]);
		expect(result.tableImporters).toEqual([]);
	});

	test("finds nothing in a bundle that inlined SRE and its tables", () => {
		// What a Vite bundle emits when `speech-rule-engine` is not external.
		expect(
			analyzeSpeechRuleEngineBoundary([
				{
					path: "tool.js",
					content: 'const l=()=>import("./sre-engine-x.js");',
				},
				{
					path: "sre-engine-x.js",
					content:
						'var t={en:()=>import("./en-x.js")};var sre=(()=>{/* SRE */})();',
				},
				{ path: "en-x.js", content: "var e={};export{e as default};" },
			]),
		).toEqual({
			issues: [],
			lazyEngineModules: [],
			dynamicEngineImporters: [],
			tableImporters: [],
		});
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

describe("hasSvelteDevRuntime", () => {
	test("flags the Array patch Svelte's dev runtime installs", () => {
		// Minified shape of `init_array_prototype_warnings` from a DEV build.
		const content =
			"function R8(){let{prototype:J,__svelte_cleanup:Q}=Array;if(Q)Q();J.indexOf=W;Array.__svelte_cleanup=()=>{J.indexOf=X}}";
		expect(hasSvelteDevRuntime(content)).toBe(true);
	});

	test("passes production Svelte, where the DEV branch is gone", () => {
		const content =
			'if(ZQ(W))W[s7]=void 0}function u(J=""){return document.createTextNode(J)}';
		expect(hasSvelteDevRuntime(content)).toBe(false);
	});
});

describe("findUnguardedCustomElementDefines", () => {
	test("flags the define Svelte emits for a component that names its tag", () => {
		const content =
			'var r=class extends HTMLElement{};customElements.define("pie-tool-ruler",Ot(r,{},[],[]));';
		expect(findUnguardedCustomElementDefines(content)).toEqual([
			"pie-tool-ruler",
		]);
	});

	test("flags the single-quoted form", () => {
		expect(
			findUnguardedCustomElementDefines(
				"customElements.define('pie-item-shell', $.create_custom_element(S, {}, [], []));",
			),
		).toEqual(["pie-item-shell"]);
	});

	test("passes a define the same tag's customElements.get guards", () => {
		expect(
			findUnguardedCustomElementDefines(
				'customElements.get("nds-icon-button")||customElements.define("nds-icon-button",n);',
			),
		).toEqual([]);
	});

	test("does not accept a guard for a different tag", () => {
		expect(
			findUnguardedCustomElementDefines(
				'customElements.get("pie-a")||customElements.define("pie-a",a);customElements.define("pie-b",b);',
			),
		).toEqual(["pie-b"]);
	});

	test("passes the guard plugin's helper, whose define takes a variable tag", () => {
		const content =
			'Ot(r,{},[],[]);e("pie-tool-ruler",r);function e(t,n){customElements.get(t)||customElements.define(t,n)}';
		expect(findUnguardedCustomElementDefines(content)).toEqual([]);
	});
});
