import { describe, expect, test } from "bun:test";

import { shouldRebuildAll } from "../preloaded-player/publish-changed.mjs";

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
