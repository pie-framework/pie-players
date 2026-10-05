import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";

import {
	assertEsmElement,
	assetPackages,
	compareVersions,
	copyMathjax,
	generateElementsModule,
	MATHJAX_LOADER,
	mathjaxDependencies,
	mathjaxUse,
	rewriteBundledAssetUrls,
	sharedBrowserDependencies,
} from "./preloaded-elements-build.js";

const element = (name: string, manifest: unknown) => ({ name, version: "1.0.0", manifest });
const CDN = (version: string) => `https://cdn.jsdelivr.net/npm/mathjax@${version}/tex-mml-chtml.js`;
const REGISTRY = "@pie-element/shared-math-rendering-mathjax/loading";
const BUNDLED = "@pie-element/shared-math-rendering-mathjax/bundled";

describe("element packages", () => {
	test("rejects a package without an ESM browser build", () => {
		expect(() =>
			assertEsmElement(element("@pie-element/passage", { exports: { ".": "./lib/index.js" } })),
		).toThrow("@pie-element/passage@1.0.0 has no ESM browser build");
		expect(() =>
			assertEsmElement(
				element("@pie-element/multiple-choice", {
					exports: { "./browser/delivery": { default: "./dist/browser/delivery/index.js" } },
				}),
			),
		).not.toThrow();
	});

	test("shares the browser dependencies every element declares", () => {
		const react = { pie: { browserSharedDependencies: { react: "18.2.0", "react-dom": "18.2.0" } } };
		expect(
			sharedBrowserDependencies([
				element("@pie-element/categorize", react),
				element("@pie-element/multiple-choice", react),
				element("@pie-element/mc-populated-blank", {}),
			]),
		).toEqual({ react: "18.2.0", "react-dom": "18.2.0" });
	});

	test("refuses elements that share different versions of one dependency", () => {
		expect(() =>
			sharedBrowserDependencies([
				element("@pie-element/categorize", { pie: { browserSharedDependencies: { react: "18.2.0" } } }),
				element("@pie-element/hotspot", { pie: { browserSharedDependencies: { react: "19.0.0" } } }),
			]),
		).toThrow("@pie-element/categorize shares react@18.2.0 and @pie-element/hotspot shares react@19.0.0");
	});

	test("orders versions numerically, with a release after its prereleases", () => {
		expect(["0.1.10", "0.1.1-next.8", "0.1.2", "0.1.1"].sort(compareVersions)).toEqual([
			"0.1.1-next.8",
			"0.1.1",
			"0.1.2",
			"0.1.10",
		]);
	});
});

describe("bundled elements module", () => {
	test("imports each element's ESM browser build by package", () => {
		const source = generateElementsModule(["@pie-element/multiple-choice", "@pie-element/hotspot"], false);
		expect(source).toContain('import element0 from "@pie-element/multiple-choice/browser/delivery";');
		expect(source).toContain('"@pie-element/hotspot": element1,');
		expect(source).toContain("export function startMathRendering() {}");
		expect(source).not.toContain("shared-math-rendering-mathjax");
	});

	test("starts MathJax from the build's adapter copy when an element renders math", () => {
		const source = generateElementsModule(["@pie-element/multiple-choice"], true);
		expect(source).toContain('import { createMathjaxRenderer } from "@pie-element/shared-math-rendering-mathjax";');
		expect(source).toContain("createMathjaxRenderer({ srcUrl, useSingleDollar })");
	});
});

describe("MathJax use in the bundled output", () => {
	test("collects the version each adapter copy loads, and copies that start their own load", () => {
		expect(
			mathjaxUse([
				{ fileName: "chunks/a.js", code: `const s="${CDN("4.1.3")}";Symbol.for("${REGISTRY}")` },
				{ fileName: "chunks/b.js", code: `const s="${CDN("4.1.4")}";` },
				{ fileName: "chunks/c.js", code: "no math" },
			]),
		).toEqual({ versions: new Set(["4.1.3", "4.1.4"]), unshared: ["chunks/b.js"] });
	});

	test("skips a copy that bundles its MathJax, whose default script is never loaded", () => {
		expect(
			mathjaxUse([{ fileName: "chunks/a.js", code: `const s="${CDN("4.1.3")}";Symbol.for("${BUNDLED}")` }]),
		).toEqual({ versions: new Set(), unshared: [] });
	});
});

describe("bundled MathJax assets", () => {
	const FONT = "https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2";
	const SRE = "https://cdn.jsdelivr.net/npm/@mathjax/src@4.1.3/bundle/sre";
	const local = (path: string) => `new URL(${JSON.stringify(path)}, import.meta.url).href`;

	test("points each asset URL at the build's copy, resolved from the chunk", () => {
		const assets = new Set<string>();
		expect(rewriteBundledAssetUrls(`L8="${FONT}",nu='${SRE}'`, "elements/chunks/Radio-B_mH.js", assets)).toBe(
			`L8=${local("../../mathjax/npm/@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2")},nu=${local("../../mathjax/npm/@mathjax/src@4.1.3/bundle/sre")}`,
		);
		expect(rewriteBundledAssetUrls(`f=\`${FONT}\``, "elements/index.js", assets)).toBe(
			`f=${local("../mathjax/npm/@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2")}`,
		);
		expect(rewriteBundledAssetUrls(`f="${FONT}"`, "chunks/npm__mathjax-1a2b3c4d.js", assets)).toBe(
			`f=${local("../mathjax/npm/@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2")}`,
		);
		expect([...assets]).toEqual(["@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2", "@mathjax/src@4.1.3/bundle/sre"]);
	});

	test("leaves URLs built at runtime and those of the page's MathJax", () => {
		const code = [
			"u=`https://cdn.jsdelivr.net/npm/@mathjax/src@${v}/bundle/sre`",
			"w=`https://cdn.jsdelivr.net/npm/@mathjax/src@4.1.3/${path}`",
			`s="${CDN("4.1.3")}"`,
			'p="https://cdn.jsdelivr.net/npm/@mathjax"',
		].join(";");
		const assets = new Set<string>();
		expect(rewriteBundledAssetUrls(code, "index.js", assets)).toBe(code);
		expect(assets.size).toBe(0);
	});

	test("groups assets by package version", () => {
		expect(
			assetPackages([
				"@mathjax/src@4.1.3/bundle/sre",
				"@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2",
				"@mathjax/src@4.1.3/bundle/sre",
				"@mathjax/mathjax-newcm-font@4.1.4/chtml/woff2",
			]),
		).toEqual(
			new Map([
				["@mathjax/src@4.1.3", { name: "@mathjax/src", version: "4.1.3", paths: ["bundle/sre"] }],
				[
					"@mathjax/mathjax-newcm-font@4.1.3",
					{ name: "@mathjax/mathjax-newcm-font", version: "4.1.3", paths: ["chtml/woff2"] },
				],
				[
					"@mathjax/mathjax-newcm-font@4.1.4",
					{ name: "@mathjax/mathjax-newcm-font", version: "4.1.4", paths: ["chtml/woff2"] },
				],
			]),
		);
	});
});

describe("shipped MathJax", () => {
	const MHCHEM = "@mathjax/mathjax-mhchem-font-extension";

	test("pins the font and its extensions to the MathJax version", () => {
		expect(mathjaxDependencies("4.1.3")).toEqual({
			mathjax: "4.1.3",
			"@mathjax/mathjax-newcm-font": "4.1.3",
			[MHCHEM]: "4.1.3",
		});
	});

	test("puts each font under the fonts path the loader sets", async () => {
		const scratch = await mkdtemp(join(os.tmpdir(), "pie-mathjax-copy-"));
		try {
			const modules = join(scratch, "node_modules");
			const files = {
				mathjax: ["tex-mml-chtml.js", "a11y/x.js", "input/x.js", "output/x.js", "ui/x.js", "sre/x.js", "LICENSE"],
				"@mathjax/mathjax-newcm-font": ["chtml.js", "chtml/woff2/a.woff2", "svg.js", "svg/a.js", "package.json"],
				[MHCHEM]: ["chtml.js", "chtml/woff2/mjx-mhc-n.woff2", "svg.js", "package.json", "mjs/chtml.js"],
			};
			for (const [name, paths] of Object.entries(files)) {
				for (const path of paths) {
					await mkdir(dirname(join(modules, name, path)), { recursive: true });
					await writeFile(join(modules, name, path), "");
				}
			}
			const out = join(scratch, "mathjax");
			await copyMathjax(modules, out);
			const shipped = (await readdir(join(out, "fonts", "mathjax-mhchem-font-extension"), { recursive: true })).sort();
			expect(shipped).toEqual(["chtml", "chtml.js", "chtml/woff2", "chtml/woff2/mjx-mhc-n.woff2", "package.json", "svg.js"]);
			expect(await readdir(join(out, "fonts"))).toEqual(
				expect.arrayContaining(["mathjax-newcm-font", "mathjax-mhchem-font-extension"]),
			);
			expect(await readdir(out)).toContain("load.js");
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	});
});

describe("MathJax loader", () => {
	type Script = { src?: string; onerror?: (event: unknown) => void };

	/** Runs the loader as the adapter loads it, after writing its configuration. */
	function runLoader(config: Record<string, any> | undefined) {
		const appended: Script[] = [];
		const current: Script = { src: "https://assets.example/pie/1.0.0/dist/mathjax/load.js" };
		const window: Record<string, any> = config ? { MathJax: config } : {};
		const document = {
			currentScript: current,
			createElement: () => ({}) as Script,
			head: { appendChild: (script: Script) => appended.push(script) },
		};
		new Function("window", "document", MATHJAX_LOADER)(window, document);
		return { window, appended, current };
	}

	test("points MathJax at this directory and its fonts, then loads the MathJax beside it", () => {
		const config = { loader: { load: ["a11y/assistive-mml"] }, startup: { typeset: false } };
		const { window, appended } = runLoader(config);
		expect(window.MathJax).toBe(config);
		expect(window.MathJax.loader).toEqual({
			load: ["a11y/assistive-mml"],
			paths: {
				mathjax: "https://assets.example/pie/1.0.0/dist/mathjax",
				fonts: "https://assets.example/pie/1.0.0/dist/mathjax/fonts",
			},
		});
		expect(appended.map((script) => script.src)).toEqual([
			"https://assets.example/pie/1.0.0/dist/mathjax/tex-mml-chtml.js",
		]);
	});

	test("keeps paths the configuration already sets", () => {
		const { window } = runLoader({ loader: { paths: { fonts: "https://fonts.example" } } });
		expect(window.MathJax.loader.paths.fonts).toBe("https://fonts.example");
	});

	test("reports a failed MathJax load through the handler the adapter set", () => {
		const { appended, current } = runLoader({});
		const failures: unknown[] = [];
		current.onerror = (event) => failures.push(event);
		appended[0].onerror?.("failed");
		expect(failures).toEqual(["failed"]);
	});
});
