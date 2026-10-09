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
import { alignPreloadedElementVersions } from "../src/loaders/preloaded-alignment.js";
import { defineAuthoredPreloadedTags } from "../src/loaders/preloaded-authored-tags.js";
import { registerPreloadedElements } from "../src/loaders/preloaded-registration.js";
import { writeRegistryEntry } from "../src/pie/registry.js";
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
const uniquePackage = () => `@pie-element/authored-${++nextPackage}`;
const elementClass = () => class extends HTMLElement {};

const authoredItem = (tag: string, spec: string) =>
	({
		config: {
			markup: `<${tag} id="q1"></${tag}>`,
			elements: { [tag]: spec },
			models: [{ id: "q1", element: tag }],
		},
	}) as any;

/** The map a player asserts for one item: aligned, then versioned. */
const expectedTags = (tag: string, spec: string) =>
	aggregateElements([
		{ config: alignPreloadedElementVersions(authoredItem(tag, spec).config) },
	] as any);

describe("defineAuthoredPreloadedTags", () => {
	test("defines the tag content names from the element registered under another base tag", () => {
		const pkg = uniquePackage();
		const Element = elementClass();
		registerPreloadedElements([
			{ tag: "pie-element-mc", package: pkg, version: "13.4.0-next.15", element: Element },
		]);
		const registered = customElements.get("pie-element-mc--version-13-4-0-next-15");

		// Authored at a stale version; alignment moves it to the registered one.
		const expected = expectedTags("multiple-choice", `${pkg}@12.0.0`);
		expect(expected).toEqual({
			"multiple-choice--version-13-4-0-next-15": `${pkg}@13.4.0-next.15`,
		});

		expect(defineAuthoredPreloadedTags(expected)).toEqual([
			"multiple-choice--version-13-4-0-next-15",
		]);

		const defined = customElements.get("multiple-choice--version-13-4-0-next-15");
		expect(defined).toBeDefined();
		expect(defined).not.toBe(registered);
		expect(defined?.prototype).toBeInstanceOf(registered as CustomElementConstructor);
		expect(
			document.createElement("multiple-choice--version-13-4-0-next-15"),
		).toBeInstanceOf(Element);
		expect(host().PIE_REGISTRY?.["multiple-choice--version-13-4-0-next-15"]).toEqual({
			package: `${pkg}@13.4.0-next.15`,
			status: Status.loaded,
			tagName: "multiple-choice--version-13-4-0-next-15",
			element: Element,
			bundleType: BundleType.player,
		});
		expect(() => assertRegistered(expected)).not.toThrow();
	});

	test("defines each tag once, whichever player calls it", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-once", package: pkg, version: "1.0.0", element: elementClass() },
		]);
		const expected = { "once--version-1-0-0": `${pkg}@1.0.0` };

		expect(defineAuthoredPreloadedTags(expected)).toEqual(["once--version-1-0-0"]);
		const defined = customElements.get("once--version-1-0-0");
		const entry = host().PIE_REGISTRY?.["once--version-1-0-0"];

		expect(defineAuthoredPreloadedTags(expected)).toEqual([]);
		expect(customElements.get("once--version-1-0-0")).toBe(defined);
		expect(host().PIE_REGISTRY?.["once--version-1-0-0"]).toBe(entry);
	});

	test("leaves a tag another copy of the players already defined", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-copy", package: pkg, version: "1.0.0", element: elementClass() },
		]);
		// A second bundled copy of this module on the page defined the tag first.
		const Other = elementClass();
		customElements.define("copy--version-1-0-0", Other);
		const entry = writeRegistryEntry({
			package: `${pkg}@1.0.0`,
			status: Status.loaded,
			tagName: "copy--version-1-0-0",
			element: Other,
			bundleType: BundleType.player,
		});

		expect(defineAuthoredPreloadedTags({ "copy--version-1-0-0": `${pkg}@1.0.0` })).toEqual(
			[],
		);
		expect(customElements.get("copy--version-1-0-0")).toBe(Other);
		expect(host().PIE_REGISTRY?.["copy--version-1-0-0"]).toBe(entry);
	});

	test("carries the registration's controller and bundle type", () => {
		const pkg = uniquePackage();
		const Element = elementClass();
		const controller = { model: async (model: unknown) => model };
		registerPreloadedElements([
			{ tag: "pie-scored", package: pkg, version: "2.1.0", element: Element, controller },
		]);

		defineAuthoredPreloadedTags({ "scored--version-2-1-0": `${pkg}@2.1.0` });

		expect(host().PIE_REGISTRY?.["scored--version-2-1-0"]).toEqual({
			package: `${pkg}@2.1.0`,
			status: Status.loaded,
			tagName: "scored--version-2-1-0",
			element: Element,
			controller,
			bundleType: BundleType.clientPlayer,
		});
		expect(
			findPieController("scored--version-2-1-0", BundleType.clientPlayer) as unknown,
		).toBe(controller);
	});

	test("takes a registration with a controller over one without", () => {
		const pkg = uniquePackage();
		const controller = { model: async (model: unknown) => model };
		registerPreloadedElements([
			{ tag: "pie-bare", package: pkg, version: "1.0.0", element: elementClass() },
			{ tag: "pie-full", package: pkg, version: "1.0.0", element: elementClass(), controller },
		]);

		defineAuthoredPreloadedTags({ "third--version-1-0-0": `${pkg}@1.0.0` });

		expect(host().PIE_REGISTRY?.["third--version-1-0-0"]?.controller).toBe(controller);
		expect(customElements.get("third--version-1-0-0")?.prototype).toBeInstanceOf(
			customElements.get("pie-full--version-1-0-0") as CustomElementConstructor,
		);
	});

	test("keeps the assertion error for a package the page did not register", () => {
		const registeredPkg = uniquePackage();
		const missingPkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-known", package: registeredPkg, version: "1.0.0", element: elementClass() },
		]);
		const expected = {
			"known--version-1-0-0": `${registeredPkg}@1.0.0`,
			"unknown--version-1-0-0": `${missingPkg}@1.0.0`,
		};

		expect(defineAuthoredPreloadedTags(expected)).toEqual(["known--version-1-0-0"]);
		expect(customElements.get("unknown--version-1-0-0")).toBeUndefined();
		expect(() => assertRegistered(expected)).toThrow(
			"ElementLoader.assertRegistered: missing [unknown--version-1-0-0] " +
				"of [known--version-1-0-0, unknown--version-1-0-0]; " +
				`nothing is registered for ${missingPkg}.`,
		);
	});

	test("defines no tag from a registration of another version", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-older", package: pkg, version: "1.0.0", element: elementClass() },
		]);
		const expected = { "older--version-2-0-0": `${pkg}@2.0.0` };

		expect(defineAuthoredPreloadedTags(expected)).toEqual([]);
		expect(() => assertRegistered(expected)).toThrow(
			`${pkg} is registered as [pie-older--version-1-0-0]`,
		);
	});

	test("defines an author view tag from the registered editor only", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{ tag: "pie-edit", package: pkg, version: "1.0.0", element: elementClass() },
		]);
		const expected = { "edit--version-1-0-0-config": `${pkg}@1.0.0` };

		// The delivery element does not stand in for the editor.
		expect(defineAuthoredPreloadedTags(expected)).toEqual([]);

		const Configure = elementClass();
		customElements.define("pie-edit--version-1-0-0-config", Configure);
		writeRegistryEntry({
			package: `${pkg}@1.0.0`,
			status: Status.loaded,
			tagName: "pie-edit--version-1-0-0-config",
			element: Configure,
			bundleType: BundleType.editor,
		});

		expect(defineAuthoredPreloadedTags(expected)).toEqual(["edit--version-1-0-0-config"]);
		expect(document.createElement("edit--version-1-0-0-config")).toBeInstanceOf(Configure);
		expect(host().PIE_REGISTRY?.["edit--version-1-0-0-config"]?.bundleType).toBe(
			BundleType.editor,
		);
	});
});
