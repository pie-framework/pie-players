import { describe, expect, test } from "bun:test";

import {
	assertEsmElement,
	compareVersions,
	generateElementsModule,
	MATHJAX_LOADER,
	mathjaxUse,
	sharedBrowserDependencies,
} from "./preloaded-elements-build.js";

const element = (name: string, manifest: unknown) => ({ name, version: "1.0.0", manifest });
const CDN = (version: string) => `https://cdn.jsdelivr.net/npm/mathjax@${version}/tex-mml-chtml.js`;
const REGISTRY = "@pie-element/shared-math-rendering-mathjax/loading";

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
