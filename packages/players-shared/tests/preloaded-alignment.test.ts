import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { resolveLoadControllers } from "../src/loaders/controller-loading.js";
import { aggregateElements } from "../src/loaders/ElementLoader.js";
import { assertRegistered } from "../src/loaders/element-loader.js";
import { alignPreloadedElementVersions } from "../src/loaders/preloaded-alignment.js";
import { registerPreloadedElements } from "../src/loaders/preloaded-registration.js";

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
		PIE_REGISTRY?: Record<string, unknown>;
		PIE_PRELOADED_ELEMENTS?: Record<string, string>;
	};

beforeEach(() => {
	host().PIE_REGISTRY = undefined;
	host().PIE_PRELOADED_ELEMENTS = undefined;
});

// `customElements` cannot be reset, so every test registers its own package.
let nextPackage = 0;
const uniquePackage = () => `@pie-element/aligned-${++nextPackage}`;

const authoredConfig = (tag: string, spec: string) => ({
	markup: `<${tag} id="q1"></${tag}>`,
	elements: { [tag]: spec },
	models: [{ id: "q1", element: tag }],
});

describe("alignPreloadedElementVersions", () => {
	test("asserts the registered tag for an authored version that differs", () => {
		const pkg = uniquePackage();
		registerPreloadedElements([
			{
				tag: "pie-element-mc",
				package: pkg,
				version: "11.4.3",
				element: class extends HTMLElement {},
			},
		]);
		const authored = authoredConfig("pie-element-mc", `${pkg}@11.4.2`);

		const authoredTags = Object.keys(
			aggregateElements([{ config: authored } as any]),
		);
		expect(() => assertRegistered(authoredTags)).toThrow(/missing/);

		const aligned = alignPreloadedElementVersions(authored);
		const alignedTags = Object.keys(
			aggregateElements([{ config: aligned } as any]),
		);
		expect(alignedTags).toEqual(["pie-element-mc--version-11-4-3"]);
		expect(() => assertRegistered(alignedTags)).not.toThrow();
		expect(authored.elements["pie-element-mc"]).toBe(`${pkg}@11.4.2`);
		expect(aligned.markup).toBe(authored.markup);
	});

	test("returns the input when every spec already matches", () => {
		const pkg = uniquePackage();
		const config = authoredConfig("pie-x", `${pkg}@1.0.0`);
		expect(
			alignPreloadedElementVersions(config, { [pkg]: `${pkg}@1.0.0` }),
		).toBe(config);
	});

	test("keeps specs whose package has no registered version or does not parse", () => {
		const pkg = uniquePackage();
		const other = uniquePackage();
		const config = {
			elements: {
				"pie-a": `${pkg}@1.0.0`,
				"pie-b": `${other}@2.0.0`,
				"pie-c": "",
			},
		};
		expect(
			alignPreloadedElementVersions(config, {
				[pkg]: `${pkg}@1.0.1`,
				[other]: "",
			}).elements,
		).toEqual({
			"pie-a": `${pkg}@1.0.1`,
			"pie-b": `${other}@2.0.0`,
			"pie-c": "",
		});
	});

	test("reads the page's registrations when no map is passed", () => {
		const pkg = uniquePackage();
		const config = authoredConfig("pie-x", `${pkg}@1.0.0`);
		expect(alignPreloadedElementVersions(config)).toBe(config);

		host().PIE_PRELOADED_ELEMENTS = { [pkg]: `${pkg}@1.2.0` };
		expect(alignPreloadedElementVersions(config).elements).toEqual({
			"pie-x": `${pkg}@1.2.0`,
		});
		expect(alignPreloadedElementVersions(config, null)).toBe(config);
	});

	test("passes a config without elements through", () => {
		const config = { markup: "<p></p>" };
		expect(alignPreloadedElementVersions(config, {})).toBe(config);
	});
});

describe("resolveLoadControllers", () => {
	test("the host's loadControllers decides when set", () => {
		expect(
			resolveLoadControllers({
				loadControllers: false,
				author: false,
				hosted: false,
			}),
		).toBe(false);
		expect(
			resolveLoadControllers({
				loadControllers: true,
				author: false,
				hosted: true,
			}),
		).toBe(true);
	});

	test("defaults to every player except a hosted delivery", () => {
		expect(resolveLoadControllers({ author: false, hosted: false })).toBe(true);
		expect(resolveLoadControllers({ author: false, hosted: true })).toBe(false);
		expect(resolveLoadControllers({ author: true, hosted: true })).toBe(true);
	});
});
