import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import {
	adapterAssetPackages,
	assertCurrentAdapter,
	assertEsmElement,
	assertSpeechLocales,
	assetPackages,
	generateElementsModule,
	mathjaxAssets,
	sharedBrowserDependencies,
} from "./preloaded-elements-build.js";

const element = (name: string, manifest: unknown) => ({ name, version: "1.0.0", manifest });
const BUNDLED = 'Symbol.for("@pie-element/shared-math-rendering-mathjax/bundled")';
const NO_ASSETS = 'Symbol.for("@pie-element/shared-math-rendering-mathjax/no-assets")';

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

});

describe("bundled elements module", () => {
	test("imports each element's ESM browser build by package", () => {
		const source = generateElementsModule(["@pie-element/multiple-choice", "@pie-element/hotspot"]);
		expect(source).toContain('import element0 from "@pie-element/multiple-choice/browser/delivery";');
		expect(source).toContain('"@pie-element/hotspot": element1,');
		expect(source).not.toContain("shared-math-rendering-mathjax");
	});
});

describe("the MathJax adapter an element bundles", () => {
	const mc = element("@pie-element/multiple-choice", {});

	test("is accepted from 0.1.3, its browser build bundling MathJax and naming no CDN", () => {
		expect(() => assertCurrentAdapter(mc, [`a=${NO_ASSETS}`, `b=${BUNDLED}`, "c"])).not.toThrow();
	});

	test.each([
		["a browser build up to 0.1.2", [`b=${BUNDLED};f="https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2"`]],
		["an npm build up to 0.1.2", ['s="https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-mml-chtml.js"']],
		["a 0.1.3 copy beside an older one", [`a=${NO_ASSETS};b=${BUNDLED}`, 'u="https://cdn.jsdelivr.net/npm/mathjax@4.1.3/sre"']],
		["the npm build of 0.1.3, which loads MathJax at run time", [`a=${NO_ASSETS}`]],
	])("is refused as %s", (_label, code) => {
		expect(() => assertCurrentAdapter(mc, code)).toThrow(
			"@pie-element/multiple-choice@1.0.0 bundles @pie-element/shared-math-rendering-mathjax before 0.1.3",
		);
	});

	test("may sit beside MathJax 3 data an element bundles from elsewhere", () => {
		expect(() =>
			assertCurrentAdapter(mc, [`a=${NO_ASSETS};b=${BUNDLED}`, 'u="https://cdn.jsdelivr.net/npm/mathjax-full@3.2.2/es5"']),
		).not.toThrow();
	});
});

describe("shipped MathJax files", () => {
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

	test("groups the assets of an unscoped package", () => {
		expect(assetPackages(["mathjax@4.1.3/sre/speech-worker.js", "mathjax@4.1.3/sre/mathmaps/en.json"])).toEqual(
			new Map([
				[
					"mathjax@4.1.3",
					{ name: "mathjax", version: "4.1.3", paths: ["sre/speech-worker.js", "sre/mathmaps/en.json"] },
				],
			]),
		);
	});
});

describe("the files the adapter loads", () => {
	const ADAPTER = "@pie-element/shared-math-rendering-mathjax";
	const PACKAGES = {
		mathjax: "4.1.3",
		"@mathjax/mathjax-newcm-font": "4.1.3",
		"@mathjax/mathjax-mhchem-font-extension": "4.1.3",
	};

	test("are its fonts and the speech of the listed locales", () => {
		expect(mathjaxAssets(PACKAGES, ["en", "es"])).toEqual([
			"mathjax@4.1.3/sre/speech-worker.js",
			"mathjax@4.1.3/sre/mathmaps/base.json",
			"mathjax@4.1.3/sre/mathmaps/nemeth.json",
			"mathjax@4.1.3/sre/mathmaps/euro.json",
			"mathjax@4.1.3/sre/mathmaps/en.json",
			"mathjax@4.1.3/sre/mathmaps/es.json",
			"@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2",
			"@mathjax/mathjax-mhchem-font-extension@4.1.3/chtml/woff2",
		]);
	});

	test("refuses a package it does not know how to ship", () => {
		expect(() => mathjaxAssets({ ...PACKAGES, "@mathjax/mathjax-bbm-font-extension": "4.1.3" }, ["en"])).toThrow(
			"@mathjax/mathjax-bbm-font-extension, which a preloaded build does not ship",
		);
	});

	test("refuses speech locales a build cannot ship", () => {
		expect(() => assertSpeechLocales([])).toThrow("at least one speech locale");
		expect(() => assertSpeechLocales(["en", "../en", "nemeth"])).toThrow('"../en", "nemeth": not a speech locale id');
		expect(() => assertSpeechLocales(["en", "pt-BR"])).not.toThrow();
	});

	test("reads the packages from the manifest of the adapter a package resolves", async () => {
		const scratch = await mkdtemp(join(os.tmpdir(), "pie-adapter-manifest-"));
		try {
			// A package beside each adapter, since the resolver caches the manifests it reads.
			const element = async (name: string, adapter?: Record<string, unknown>) => {
				const dir = join(scratch, name);
				await mkdir(dir, { recursive: true });
				await writeFile(join(dir, "package.json"), JSON.stringify({ name }));
				if (adapter) {
					const adapterDir = join(dir, "node_modules", ADAPTER);
					await mkdir(adapterDir, { recursive: true });
					await writeFile(join(adapterDir, "index.js"), "");
					await writeFile(join(adapterDir, "package.json"), JSON.stringify({ name: ADAPTER, ...adapter }));
				}
				return dir;
			};
			expect(adapterAssetPackages(await element("without-math"))).toBeUndefined();
			expect(
				adapterAssetPackages(await element("before-roots", { version: "0.1.2", exports: { ".": "./index.js" } })),
			).toBeUndefined();
			expect(
				adapterAssetPackages(
					await element("with-roots", {
						version: "0.1.3",
						exports: { ".": "./index.js", "./package.json": "./package.json" },
						pie: { assetPackages: PACKAGES },
					}),
				),
			).toEqual(PACKAGES);
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	});
});
