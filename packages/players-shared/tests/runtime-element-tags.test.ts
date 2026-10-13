import { afterEach, describe, expect, test } from "bun:test";

import { runtimeElementTags } from "../src/pie/versioned-tag.js";

const host = globalThis as unknown as {
	window?: { PIE_PRELOADED_ELEMENTS?: Record<string, string> };
};

describe("runtimeElementTags", () => {
	afterEach(() => {
		delete host.window;
	});

	test("puts the versioned tag for the spec before the authored tag", () => {
		expect(
			runtimeElementTags("pie-multiple-choice", "@pie-element/multiple-choice@11.2.0"),
		).toEqual(["pie-multiple-choice--version-11-2-0", "pie-multiple-choice"]);
	});

	test("aligns the version to the page's preloaded registration", () => {
		host.window = {
			PIE_PRELOADED_ELEMENTS: {
				"@pie-element/multiple-choice": "@pie-element/multiple-choice@12.0.1",
			},
		};
		expect(
			runtimeElementTags("pie-multiple-choice", "@pie-element/multiple-choice@11.2.0"),
		).toEqual(["pie-multiple-choice--version-12-0-1", "pie-multiple-choice"]);
	});

	test("keeps the authored tag alone for an unversioned spec or no spec", () => {
		expect(
			runtimeElementTags("pie-multiple-choice", "@pie-element/multiple-choice"),
		).toEqual(["pie-multiple-choice"]);
		expect(runtimeElementTags("acme-choice")).toEqual(["acme-choice"]);
	});
});
