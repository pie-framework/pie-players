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

const host = () =>
	window as unknown as {
		PIE_REGISTRY?: Record<string, any>;
		PIE_PRELOADED_ELEMENTS?: Record<string, string>;
	};

beforeEach(() => {
	host().PIE_REGISTRY = undefined;
	host().PIE_PRELOADED_ELEMENTS = undefined;
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
		["an empty tag", { tag: "" }, "authored base tag"],
		["a module without an element class", { element: {} }, "./browser/delivery module"],
	])("rejects %s before registering anything", (_label, override, message) => {
		const pkg = uniquePackage();
		const valid = { tag: "pie-valid", package: pkg, version: "1.0.0", element: elementClass() };

		expect(() =>
			registerPreloadedElements([valid, { ...valid, tag: "pie-invalid", ...override } as any]),
		).toThrow(message);
		expect(customElements.get("pie-valid--version-1-0-0")).toBeUndefined();
	});
});
