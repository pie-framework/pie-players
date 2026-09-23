import { describe, expect, test } from "bun:test";

import {
	shouldRebuildAll,
	validateLatestConfig,
} from "../preloaded-player/publish-changed.mjs";

describe("validateLatestConfig", () => {
	const config = (file, latest) => ({
		file,
		parsed: latest ? { latest: true, elements: [] } : [],
	});

	test("accepts exactly one config marked latest", () => {
		expect(() =>
			validateLatestConfig([config("star-0326.json", true), config("knowledge-checks.json")]),
		).not.toThrow();
	});

	test("rejects a set of configs with none marked latest", () => {
		expect(() => validateLatestConfig([config("knowledge-checks.json")])).toThrow("found none");
	});

	test("rejects two configs marked latest, naming both", () => {
		expect(() =>
			validateLatestConfig([config("a.json", true), config("b.json", true)]),
		).toThrow("found a.json, b.json");
	});
});

describe("shouldRebuildAll", () => {
	test("rebuilds for a source change in anything every build bundles or runs", () => {
		for (const file of [
			"packages/item-player/src/pie-item-player.ts",
			"packages/item-player/vite.config.ts",
			"packages/players-shared/src/pie/element-observer.ts",
			"tools/cli/src/utils/pie-packages/fixed-static.ts",
			"scripts/preloaded-player/publish-changed.mjs",
		]) {
			expect(shouldRebuildAll([file])).toBe(true);
		}
	});

	test("rebuilds when the item player's version moves, since it is every build's base version", () => {
		expect(shouldRebuildAll(["packages/item-player/package.json"])).toBe(true);
	});

	test("ignores tests, Playwright configs and prose under those prefixes", () => {
		expect(
			shouldRebuildAll([
				"packages/players-shared/tests/pie-element-observer.test.ts",
				"packages/item-player/tests/item-player-generated-preloaded.spec.ts",
				"packages/item-player/playwright.config.ts",
				"packages/item-player/playwright.backend.config.ts",
				"packages/players-shared/playwright.config.ts",
				"tools/cli/src/utils/pie-packages/preloaded-static.test.ts",
				"packages/item-player/README.md",
				"packages/players-shared/CHANGELOG.md",
				"packages/players-shared/src/pie/README.md",
			]),
		).toBe(false);
	});

	test("rebuilds when one build input sits among ignored paths", () => {
		expect(
			shouldRebuildAll([
				"packages/players-shared/tests/scope-css-cssom.test.ts",
				"packages/players-shared/src/ui/scope-css.ts",
			]),
		).toBe(true);
	});

	test("ignores paths outside those prefixes", () => {
		expect(
			shouldRebuildAll([
				"docs/preloaded-player/readme.md",
				"packages/section-player/src/index.ts",
			]),
		).toBe(false);
	});
});
