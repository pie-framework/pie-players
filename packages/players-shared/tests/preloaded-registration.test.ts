import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { aggregateElements } from "../src/loaders/ElementLoader.js";
import { assertRegistered } from "../src/loaders/element-loader.js";
import { registerPreloadedElements } from "../src/loaders/preloaded-registration.js";
import { findPieController } from "../src/pie/scoring.js";
import { BundleType, Status } from "../src/pie/types.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const MATH_OPTIONS = "@pie-lib/math-rendering@2";

const host = () =>
	window as unknown as {
		PIE_REGISTRY?: Record<string, any>;
		PIE_PRELOADED_ELEMENTS?: Record<string, string>;
		[MATH_OPTIONS]?: { opts?: Record<string, unknown> };
	};

beforeEach(() => {
	host().PIE_REGISTRY = undefined;
	host().PIE_PRELOADED_ELEMENTS = undefined;
	host()[MATH_OPTIONS] = undefined;
});

// `customElements` cannot be reset, so every test registers its own package.
let nextPackage = 0;
const uniquePackage = () => `@pie-element/preloaded-${++nextPackage}`;
const elementClass = () => class extends HTMLElement {};

const authoredItem = (tag: string, spec: string) =>
	({
		config: {
			markup: `<${tag} id="q1"></${tag}>`,
			elements: { [tag]: spec },
			models: [{ id: "q1", element: tag }],
		},
	}) as any;

describe("registerPreloadedElements", () => {
	test("registers the tag the players derive from authored content", () => {
		const pkg = uniquePackage();
		const Element = elementClass();

		registerPreloadedElements([
			{ tag: "pie-element-mc", package: pkg, version: "13.4.4", element: Element },
		]);

		const tags = Object.keys(
			aggregateElements([authoredItem("pie-element-mc", `${pkg}@13.4.4`)]),
		);
		expect(tags).toEqual(["pie-element-mc--version-13-4-4"]);
		expect(() => assertRegistered(tags)).not.toThrow();
		expect(host().PIE_REGISTRY?.[tags[0]]).toEqual({
			package: `${pkg}@13.4.4`,
			status: Status.loaded,
			tagName: tags[0],
			element: Element,
			bundleType: BundleType.player,
		});
		expect(host().PIE_PRELOADED_ELEMENTS).toEqual({ [pkg]: `${pkg}@13.4.4` });
	});

	test("leaves the model to the server: the entry has no controller", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-hosted", package: pkg, version: "1.0.0", element: elementClass() },
		]);

		expect(findPieController("pie-hosted--version-1-0-0")).toBeUndefined();
	});

	test("records the ./browser/controller module for a player that is not hosted", () => {
		const pkg = uniquePackage();
		const Element = elementClass();
		// A module namespace: named exports, no default.
		const controller = {
			model: async (model: unknown) => model,
			outcome: async () => ({ score: 1 }),
		};

		registerPreloadedElements([
			{ tag: "pie-local", package: pkg, version: "1.0.0", element: Element, controller },
		]);

		const tag = "pie-local--version-1-0-0";
		expect(host().PIE_REGISTRY?.[tag]).toEqual({
			package: `${pkg}@1.0.0`,
			status: Status.loaded,
			tagName: tag,
			element: Element,
			controller,
			bundleType: BundleType.clientPlayer,
		});
		expect(findPieController(tag, BundleType.clientPlayer) as unknown).toBe(
			controller,
		);
		expect(findPieController(tag, BundleType.player)).toBeUndefined();
	});

	test("accepts a controller module's default export", () => {
		const pkg = uniquePackage();
		const controller = { model: async (model: unknown) => model };

		registerPreloadedElements([
			{
				tag: "pie-default-controller",
				package: pkg,
				version: "1.0.0",
				element: elementClass(),
				controller: { default: controller },
			},
		]);

		expect(
			findPieController(
				"pie-default-controller--version-1-0-0",
				BundleType.clientPlayer,
			) as unknown,
		).toBe(controller);
	});

	test("adds a controller to a tag registered without one and keeps its element", () => {
		const pkg = uniquePackage();
		const Element = elementClass();
		const controller = { model: async (model: unknown) => model };
		const entry = { tag: "pie-later", package: pkg, version: "1.0.0", element: Element };

		registerPreloadedElements([entry]);
		registerPreloadedElements([{ ...entry, element: elementClass(), controller }]);

		const registered = host().PIE_REGISTRY?.["pie-later--version-1-0-0"];
		expect(registered?.element).toBe(Element);
		expect(registered?.controller).toBe(controller);
		expect(registered?.bundleType).toBe(BundleType.clientPlayer);
	});

	test("accepts the ./browser/delivery module namespace", () => {
		const pkg = uniquePackage();
		const Element = elementClass();

		registerPreloadedElements([
			{ tag: "pie-ns", package: pkg, version: "2.0.0", element: { default: Element } },
		]);

		expect(host().PIE_REGISTRY?.["pie-ns--version-2-0-0"]?.element).toBe(Element);
		expect(customElements.get("pie-ns--version-2-0-0")).toBeDefined();
	});

	test("registers an authored base tag without a hyphen, which the version suffix supplies", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "hotspot", package: pkg, version: "11.3.4-next.2", element: elementClass() },
		]);

		expect(customElements.get("hotspot--version-11-3-4-next-2")).toBeDefined();
	});

	test("registers one package under each base tag the content authors", () => {
		const pkg = uniquePackage();
		const Element = elementClass();

		registerPreloadedElements([
			{ tag: "pie-alias-a", package: pkg, version: "1.0.0", element: Element },
			{ tag: "pie-alias-b", package: pkg, version: "1.0.0", element: Element },
		]);

		expect(() =>
			assertRegistered(["pie-alias-a--version-1-0-0", "pie-alias-b--version-1-0-0"]),
		).not.toThrow();
	});

	test("is idempotent and keeps an existing registry entry", () => {
		const pkg = uniquePackage();
		const entry = { tag: "pie-twice", package: pkg, version: "1.0.0", element: elementClass() };
		registerPreloadedElements([entry]);
		const first = host().PIE_REGISTRY?.["pie-twice--version-1-0-0"];

		expect(() => registerPreloadedElements([entry])).not.toThrow();
		expect(host().PIE_REGISTRY?.["pie-twice--version-1-0-0"]).toBe(first);
	});

	test("rejects a second version of a package and registers nothing from the call", () => {
		const pkg = uniquePackage();

		expect(() =>
			registerPreloadedElements([
				{ tag: "pie-conflict", package: pkg, version: "1.0.0", element: elementClass() },
				{ tag: "pie-conflict", package: pkg, version: "1.1.0", element: elementClass() },
			]),
		).toThrow(`${pkg} is registered as ${pkg}@1.0.0`);
		expect(customElements.get("pie-conflict--version-1-0-0")).toBeUndefined();
		expect(host().PIE_PRELOADED_ELEMENTS).toEqual({});
	});

	test("rejects a version other than the one an earlier registration recorded", () => {
		const pkg = uniquePackage();
		host().PIE_PRELOADED_ELEMENTS = { [pkg]: `${pkg}@1.0.0` };

		expect(() =>
			registerPreloadedElements([
				{ tag: "pie-earlier", package: pkg, version: "2.0.0", element: elementClass() },
			]),
		).toThrow(`${pkg} is registered as ${pkg}@1.0.0`);
	});

	test.each([
		["a package spec with a version", { package: "@pie-element/x@1.0.0" }, "bare package name"],
		["an empty version", { version: "" }, "installed version"],
		["a version range", { version: "^1.0.0" }, "exact"],
		["a dist-tag", { version: "latest" }, "exact"],
		["a partial version", { version: "1.0" }, "exact"],
		["a v-prefixed version", { version: "v1.0.0" }, "exact"],
		["build metadata", { version: "1.0.0+build.7" }, "exact"],
		["an empty tag", { tag: "" }, "base tag to register"],
		["a module without an element class", { element: {} }, "./browser/delivery module"],
		["a controller without model()", { controller: { outcome: () => ({}) } }, "./browser/controller module"],
	])("rejects %s before registering anything", (_label, override, message) => {
		const pkg = uniquePackage();
		const valid = { tag: "pie-valid", package: pkg, version: "1.0.0", element: elementClass() };

		expect(() =>
			registerPreloadedElements([valid, { ...valid, tag: "pie-invalid", ...override } as any]),
		).toThrow(message);
		expect(customElements.get("pie-valid--version-1-0-0")).toBeUndefined();
	});
});

describe("registerPreloadedElements options.math", () => {
	const entry = () => {
		const pkg = uniquePackage();
		return { tag: `pie-math-${nextPackage}`, package: pkg, version: "1.0.0", element: elementClass() };
	};

	test("writes the asset options to the page options the math adapter reads", () => {
		host()[MATH_OPTIONS] = { opts: { useSingleDollar: true, speechPath: "/sre" } };

		registerPreloadedElements([entry()], {
			math: {
				assetRoot: new URL("https://assets.test/npm"),
				speechLocales: { en: "English", cy: "Cymraeg" },
			},
		});

		expect(host()[MATH_OPTIONS]).toEqual({
			opts: {
				useSingleDollar: true,
				speechPath: "/sre",
				assetRoot: "https://assets.test/npm",
				speechLocales: { en: "English", cy: "Cymraeg" },
			},
		});
	});

	test("adds the URL of each listed file to those the page lists", () => {
		const font = "@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2/mjx-ncm-n.woff2";
		const worker = "mathjax@4.1.3/sre/speech-worker.js";
		host()[MATH_OPTIONS] = {
			opts: { assetUrls: { [font]: "https://page.test/n.woff2", "x@1/y": "https://page.test/y" } },
		};

		registerPreloadedElements([entry()], {
			math: {
				assetUrls: {
					[font]: new URL("https://host.test/assets/mjx-ncm-n-1a.woff2"),
					[worker]: "https://host.test/assets/speech-worker-2b.js",
				},
			},
		});

		expect(host()[MATH_OPTIONS]?.opts?.assetUrls).toEqual({
			[font]: "https://host.test/assets/mjx-ncm-n-1a.woff2",
			[worker]: "https://host.test/assets/speech-worker-2b.js",
			"x@1/y": "https://page.test/y",
		});
	});

	test("leaves the page options alone without it", () => {
		registerPreloadedElements([entry()]);

		expect(host()[MATH_OPTIONS]).toBeUndefined();
	});

	test.each([
		["an empty asset root", { assetRoot: "" }, "assetRoot must be a URL"],
		["a speech path that is no URL", { speechPath: 42 }, "speechPath must be a URL"],
		["a file URL that is no URL", { assetUrls: { "x@1/y": 1 } }, "assetUrls must map npm paths to URLs"],
		["file URLs in a list", { assetUrls: ["https://assets.test/y"] }, "assetUrls must map"],
		["a locale that is no string", { speechLocales: ["en", 1] }, "speechLocales must be"],
		["a label that is no string", { speechLocales: { en: true } }, "speechLocales must be"],
		["no object", "https://assets.test/npm", "must be an object"],
	])("rejects %s before registering anything", (_label, math, message) => {
		const valid = entry();

		expect(() => registerPreloadedElements([valid], { math: math as any })).toThrow(
			`options.math: ${message}`,
		);
		expect(customElements.get(`${valid.tag}--version-1-0-0`)).toBeUndefined();
		expect(host()[MATH_OPTIONS]).toBeUndefined();
	});
});
