import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { registerPreloadedElements } from "@pie-players/pie-players-shared/loaders";

import {
	assertBuildElements,
	generateHash,
	generateIndex,
	minifyPlayerModules,
	parseElementsInput,
	readElementSet,
	readSpeechLocales,
} from "./preloaded-static.js";

const writeConfig = async (name: string, content: unknown): Promise<string> => {
	const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-static-"));
	const file = join(dir, name);
	await writeFile(file, JSON.stringify(content));
	return file;
};

describe("preloaded static utilities", () => {
	test("generateHash is order independent", () => {
		const a = [
			"@pie-element/multiple-choice@11.4.3",
			"@pie-element/passage@5.3.3",
		];
		const b = [...a].reverse();
		expect(generateHash(a)).toBe(generateHash(b));
	});

	test("parseElementsInput supports object with elements", async () => {
		const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-static-"));
		const file = join(dir, "elements.json");
		await writeFile(
			file,
			JSON.stringify({
				elements: [
					{ package: "@pie-element/multiple-choice", version: "11.4.3" },
				],
			}),
		);
		const parsed = await parseElementsInput(file, undefined);
		expect(parsed).toEqual([
			{ package: "@pie-element/multiple-choice", version: "11.4.3" },
		]);
	});

	test("readElementSet names the set after its config file and publishes under that name", async () => {
		const file = await writeConfig("knowledge-checks.json", [
			{ package: "@pie-element/passage", version: "5.3.3" },
		]);
		expect(await readElementSet(file)).toEqual({
			name: "knowledge-checks",
			distTag: "knowledge-checks",
		});
	});

	test("readElementSet publishes the config marked latest under latest", async () => {
		const file = await writeConfig("star-0326.json", {
			latest: true,
			elements: [{ package: "@pie-element/multiple-choice", version: "13.4.4" }],
		});
		expect(await readElementSet(file)).toEqual({ name: "star-0326", distTag: "latest" });
	});

	test("readElementSet rejects a file name that cannot be a prerelease identifier", async () => {
		const file = await writeConfig("Star_0326.json", []);
		await expect(readElementSet(file)).rejects.toThrow("not a valid element-set name");
	});

	test("readSpeechLocales reads the flag, then the config file", async () => {
		const file = await writeConfig("star-0326.json", { speechLocales: ["en", "es"], elements: [] });
		expect(await readSpeechLocales(file)).toEqual(["en", "es"]);
		expect(await readSpeechLocales(file, "en, de")).toEqual(["en", "de"]);
		expect(await readSpeechLocales(await writeConfig("plain.json", []))).toBeUndefined();
		expect(await readSpeechLocales(undefined)).toBeUndefined();
	});

	test("readSpeechLocales rejects locales that are not a list of ids", async () => {
		const file = await writeConfig("star-0326.json", { speechLocales: "en", elements: [] });
		await expect(readSpeechLocales(file)).rejects.toThrow('"speechLocales" in');
	});
});

// ─── Generated entry ──────────────────────────────────────────────────────────

type PageGlobals = Record<string, any>;
const g = globalThis as PageGlobals;
const PAGE_GLOBALS = [
	"window",
	"customElements",
	"HTMLElement",
	"document",
	"pie",
	"PIE_REGISTRY",
	"PIE_PRELOADED_ELEMENTS",
	"pieFixedPlayerLoaded",
	"__generatedEntry",
	"@pie-lib/math-rendering@2",
] as const;

const ELEMENTS = [
	"@pie-element/multiple-choice@13.4.4",
	"@pie-element/mc-populated-blank@0.3.0-next.9",
];
const ELEMENT_TAGS = { "@pie-element/multiple-choice": "pie-element-multiple-choice" };
const MATHJAX_FILES = [
	"@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2/mjx-ncm-n.woff2",
	"mathjax@4.1.3/sre/mathmaps/en.json",
	"mathjax@4.1.3/sre/speech-worker.js",
];

class HTMLElementStub {}
const elementClasses = {
	"@pie-element/multiple-choice": class extends HTMLElementStub {},
	"@pie-element/mc-populated-blank": class extends HTMLElementStub {},
};
let page: {
	order: string[];
	loadStates: string[];
	defined: Map<string, unknown>;
};

/** A document with only what the generated entry and the helper touch. */
function installPage(): void {
	const defined = new Map<string, unknown>();
	page = { order: [], loadStates: [], defined };
	g.window = g;
	g.HTMLElement = HTMLElementStub;
	g.customElements = {
		get: (tag: string) => defined.get(tag),
		define: (tag: string, ctor: unknown) => {
			if (defined.has(tag)) throw new Error(`${tag} is already defined`);
			defined.set(tag, ctor);
		},
	};
	g.document = {
		dispatchEvent: (event: CustomEvent) => {
			page.loadStates.push(event.detail);
			return true;
		},
	};
	g.__generatedEntry = { page, elementClasses };
}

/** The generated entry beside stand-ins for the files the build writes next to it. */
async function writeBuild(math: { mathjaxFiles?: string[]; speechLocales?: string[] } = {}): Promise<string> {
	const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-index-"));
	const loaders = import.meta.resolve("@pie-players/pie-players-shared/loaders");
	await writeFile(
		join(dir, "preloaded.js"),
		`export { registerPreloadedElements } from ${JSON.stringify(loaders)};
`,
	);
	await mkdir(join(dir, "elements"));
	await writeFile(
		join(dir, "elements", "index.js"),
		`const { page, elementClasses } = globalThis.__generatedEntry;
page.order.push("elements");
export const elements = elementClasses;
`,
	);
	await writeFile(
		join(dir, "pie-item-player.js"),
		`globalThis.__generatedEntry.page.order.push("player");
customElements.define("pie-item-player", class extends HTMLElement {});
`,
	);
	await writeFile(
		join(dir, "index.js"),
		generateIndex(ELEMENTS, ELEMENT_TAGS, math),
	);
	return pathToFileURL(join(dir, "index.js")).href;
}

describe("generated preloaded entry", () => {
	beforeEach(installPage);
	afterEach(() => {
		for (const key of PAGE_GLOBALS) delete g[key];
	});

	test("registers the bundle's elements exactly as registerPreloadedElements does", async () => {
		await import(await writeBuild());
		const generated = {
			registry: g.PIE_REGISTRY,
			preloaded: g.PIE_PRELOADED_ELEMENTS,
			tags: [...page.defined.keys()],
		};

		for (const key of PAGE_GLOBALS) delete g[key];
		installPage();
		registerPreloadedElements([
			{
				tag: "pie-element-multiple-choice",
				package: "@pie-element/multiple-choice",
				version: "13.4.4",
				element: elementClasses["@pie-element/multiple-choice"] as unknown as CustomElementConstructor,
			},
			{
				tag: "pie-mc-populated-blank",
				package: "@pie-element/mc-populated-blank",
				version: "0.3.0-next.9",
				element: elementClasses["@pie-element/mc-populated-blank"] as unknown as CustomElementConstructor,
			},
		]);

		expect(generated.registry).toEqual(g.PIE_REGISTRY);
		expect(generated.preloaded).toEqual(g.PIE_PRELOADED_ELEMENTS);
		expect(generated.tags).toEqual([
			"pie-element-multiple-choice--version-13-4-4",
			"pie-mc-populated-blank--version-0-3-0-next-9",
			"pie-item-player",
		]);
	});

	test("registers the elements, then loads the player", async () => {
		await import(await writeBuild());
		expect(page.order).toEqual(["elements", "player"]);
		expect(page.loadStates).toEqual(["PIE-Fixed-Player-Load-Complete"]);
		expect(g.pieFixedPlayerLoaded).toBe(true);
	});

	test("gives the adapter copies the URL of each MathJax file the build ships", async () => {
		const entry = await writeBuild({ mathjaxFiles: MATHJAX_FILES, speechLocales: ["en"] });
		await import(entry);
		expect(g["@pie-lib/math-rendering@2"].opts).toEqual({
			assetUrls: Object.fromEntries(
				MATHJAX_FILES.map((file) => [file, new URL(`./mathjax/npm/${file}`, entry).href]),
			),
			speechLocales: ["en"],
		});
	});

	test("names each module and file with a literal a bundler follows", () => {
		const source = generateIndex(ELEMENTS, ELEMENT_TAGS, { mathjaxFiles: MATHJAX_FILES, speechLocales: ["en"] });
		expect([...(source.match(/import\([^)]*\)/g) ?? [])]).toEqual([
			"import('./preloaded.js')",
			"import('./elements/index.js')",
			"import('./pie-item-player.js')",
		]);
		expect([...(source.match(/new URL\([^)]*\)/g) ?? [])]).toEqual(
			MATHJAX_FILES.map((file) => `new URL("./mathjax/npm/${file}", import.meta.url)`),
		);
	});

	test("leaves the page's math options alone for a build without MathJax files", async () => {
		await import(await writeBuild());
		expect(g["@pie-lib/math-rendering@2"]).toBeUndefined();
	});

	test("renders through a pie-item-player the page already holds", async () => {
		g.customElements.define("pie-item-player", class {});
		await import(await writeBuild());
		expect(page.order).toEqual(["elements"]);
	});

	test("fails the load when the page registered another version of a package", async () => {
		g.PIE_PRELOADED_ELEMENTS = {
			"@pie-element/multiple-choice": "@pie-element/multiple-choice@13.4.3",
		};
		const entry = await writeBuild();
		await expect(import(entry)).rejects.toThrow(
			"@pie-element/multiple-choice is registered as @pie-element/multiple-choice@13.4.3",
		);
		expect(page.loadStates).toEqual(["PIE-Fixed-Player-Load-Failed"]);
		expect(page.defined.size).toBe(0);
	});
});

describe("build element validation", () => {
	test("accepts exact versions, prereleases included", () => {
		expect(() => assertBuildElements(ELEMENTS, ELEMENT_TAGS)).not.toThrow();
	});

	test.each([
		["a range", ["@pie-element/multiple-choice@^13.4.4"], "exact version"],
		["a dist-tag", ["@pie-element/multiple-choice@latest"], "exact version"],
		["no version", ["@pie-element/multiple-choice"], "exact version"],
		[
			"one package twice",
			["@pie-element/multiple-choice@13.4.4", "@pie-element/multiple-choice@13.4.3"],
			"one version per package",
		],
	])("rejects %s", (_label, elements, message) => {
		expect(() => assertBuildElements(elements)).toThrow(message);
	});

	test("parseElementsInput reads scoped and unscoped package@version lists", async () => {
		expect(
			await parseElementsInput(undefined, "@pie-element/multiple-choice@13.4.4, legacy-element@1.0.0"),
		).toEqual([
			{ package: "@pie-element/multiple-choice", version: "13.4.4" },
			{ package: "legacy-element", version: "1.0.0" },
		]);
	});
});

describe("player module minification", () => {
	test("strips each module's whitespace and keeps its name, imports and text", async () => {
		const dir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-minify-"));
		await mkdir(join(dir, "chunks"));
		await writeFile(
			join(dir, "chunks", "label-1234.js"),
			'const label = "Größe";\n\nexport { label as l };\n',
		);
		await writeFile(
			join(dir, "pie-item-player.js"),
			'import { l as label } from "./chunks/label-1234.js";\n\nexport function read() {\n  return label;\n}\n',
		);
		const declarations = "export declare function read(): string;\n";
		await writeFile(join(dir, "pie-item-player.d.ts"), declarations);

		await minifyPlayerModules(dir);

		expect(await readFile(join(dir, "chunks", "label-1234.js"), "utf-8")).toBe(
			'const label="Größe";export{label as l};\n',
		);
		expect(await readFile(join(dir, "pie-item-player.js"), "utf-8")).toBe(
			'import{l as label}from"./chunks/label-1234.js";export function read(){return label}\n',
		);
		expect(await readFile(join(dir, "pie-item-player.d.ts"), "utf-8")).toBe(declarations);
		const { read } = await import(pathToFileURL(join(dir, "pie-item-player.js")).href);
		expect(read()).toBe("Größe");
	});
});
