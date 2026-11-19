import { describe, expect, test } from "bun:test";

import {
	collectLockFindings,
	lockReport,
	parseLock,
} from "../check-lock-consistency.mjs";

const OLD = "14.0.7-next.20261019093941";
const NEW = "14.0.7-next.20261019155156";

function entry(name, version) {
	return [`${name}@${version}`, "", {}, "sha512-x"];
}

describe("parseLock", () => {
	test("drops trailing commas and leaves string contents alone", () => {
		expect(parseLock('{ "a": [ "x,]", "y", ], "b": { "c": ",}", }, }')).toEqual(
			{ a: ["x,]", "y"], b: { c: ",}" } },
		);
	});
});

describe("collectLockFindings", () => {
	test("passes when workspaces sharing a specifier share a version", () => {
		const lock = {
			workspaces: {
				"apps/demo-ui": {
					name: "@pie-players/demo-ui",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
				"apps/item-demos": {
					name: "@pie-players/item-demos",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
			},
			packages: {
				"@pie-element/multiple-choice": entry(
					"@pie-element/multiple-choice",
					NEW,
				),
			},
		};

		expect(collectLockFindings(lock)).toEqual([]);
	});

	test("fails when a workspace's nested entry resolves the same specifier to another version", () => {
		const lock = {
			workspaces: {
				"apps/demo-ui": {
					name: "@pie-players/demo-ui",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
				"apps/item-demos": {
					name: "@pie-players/item-demos",
					devDependencies: { "@pie-element/multiple-choice": "next" },
				},
				"apps/section-demos": {
					name: "@pie-players/section-demos",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
			},
			packages: {
				"@pie-element/multiple-choice": entry(
					"@pie-element/multiple-choice",
					NEW,
				),
				"@pie-players/item-demos/@pie-element/multiple-choice": entry(
					"@pie-element/multiple-choice",
					OLD,
				),
			},
		};

		expect(collectLockFindings(lock)).toEqual([
			`@pie-element/multiple-choice@next resolves to ${NEW} in @pie-players/demo-ui, @pie-players/section-demos; ${OLD} in @pie-players/item-demos.`,
		]);
	});

	test("lets different specifiers resolve to different versions", () => {
		const lock = {
			workspaces: {
				"packages/players-shared": {
					name: "@pie-players/pie-players-shared",
					dependencies: { "@pie-element/shared-utils": "0.1.4" },
				},
				"apps/demo-ui": {
					name: "@pie-players/demo-ui",
					dependencies: { "@pie-element/shared-utils": "next" },
				},
			},
			packages: {
				"@pie-element/shared-utils": entry(
					"@pie-element/shared-utils",
					"0.1.4",
				),
				"@pie-players/demo-ui/@pie-element/shared-utils": entry(
					"@pie-element/shared-utils",
					"0.1.6-next.20261019151920",
				),
			},
		};

		expect(collectLockFindings(lock)).toEqual([]);
	});

	test("ignores workspace specifiers and dependencies the lock does not install", () => {
		const lock = {
			workspaces: {
				"apps/demo-ui": {
					name: "@pie-players/demo-ui",
					dependencies: { "@pie-players/pie-players-shared": "workspace:*" },
					optionalDependencies: { fsevents: "^2.3.3" },
				},
				"apps/item-demos": {
					name: "@pie-players/item-demos",
					dependencies: { "@pie-players/pie-players-shared": "workspace:*" },
					optionalDependencies: { fsevents: "^2.3.3" },
				},
			},
			packages: {
				"@pie-players/pie-players-shared": [
					"@pie-players/pie-players-shared@workspace:packages/players-shared",
				],
				"@pie-players/item-demos/@pie-players/pie-players-shared": [
					"@pie-players/pie-players-shared@workspace:packages/other",
				],
			},
		};

		expect(collectLockFindings(lock)).toEqual([]);
	});
});

describe("lockReport", () => {
	test("reports a stale Playwright entry and dist-tag drift together", () => {
		const lock = {
			workspaces: {
				"apps/demo-ui": {
					name: "@pie-players/demo-ui",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
				"apps/item-demos": {
					name: "@pie-players/item-demos",
					dependencies: { "@pie-element/multiple-choice": "next" },
				},
			},
			packages: {
				"@playwright/test": entry("@playwright/test", "1.65.1"),
				playwright: entry("playwright", "1.65.1"),
				"playwright-core": entry("playwright-core", "1.64.1"),
				"@pie-element/multiple-choice": entry(
					"@pie-element/multiple-choice",
					OLD,
				),
				"@pie-players/item-demos/@pie-element/multiple-choice": entry(
					"@pie-element/multiple-choice",
					NEW,
				),
			},
		};

		const report = lockReport(lock).join("\n");
		expect(report).toContain("requires playwright-core to match");
		expect(report).toContain("@pie-element/multiple-choice@next resolves to");
	});

	test("is empty for a consistent lock", () => {
		const lock = {
			workspaces: {},
			packages: {
				"@playwright/test": entry("@playwright/test", "1.65.1"),
				playwright: entry("playwright", "1.65.1"),
				"playwright-core": entry("playwright-core", "1.65.1"),
			},
		};

		expect(lockReport(lock)).toEqual([]);
	});
});
