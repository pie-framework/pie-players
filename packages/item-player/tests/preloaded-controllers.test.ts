import { afterEach, describe, expect, test } from "bun:test";
import {
	missingControllerWarning,
	takeTagsWithoutController,
} from "../src/preloaded-controllers";

const g = globalThis as { window?: unknown };
const originalWindow = g.window;

afterEach(() => {
	if (originalWindow === undefined) delete g.window;
	else g.window = originalWindow;
});

describe("preloaded controller check", () => {
	test("returns each tag registered without a controller once", () => {
		g.window = {
			PIE_REGISTRY: {
				"pie-a--version-1-0-0": { controller: { model: () => ({}) } },
				"pie-b--version-1-0-0": {},
			},
		};

		expect(
			takeTagsWithoutController([
				"pie-a--version-1-0-0",
				"pie-b--version-1-0-0",
			]),
		).toEqual(["pie-b--version-1-0-0"]);
		expect(takeTagsWithoutController(["pie-b--version-1-0-0"])).toEqual([]);
	});

	test("names the tag and the registration that supplies a controller", () => {
		const warning = missingControllerWarning("pie-b--version-1-0-0");
		expect(warning).toContain("pie-b--version-1-0-0");
		expect(warning).toContain("./browser/controller");
		expect(warning).toContain("registerPreloadedElements");
		expect(warning).toContain("hosted");
	});
});
