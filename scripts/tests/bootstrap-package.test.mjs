import { describe, expect, test } from "bun:test";

import {
	UNPUBLISHED,
	collectBootstrapBlockers,
	collectUninstallableDependencies,
	narrowToFixedGroup,
} from "../bootstrap-package.mjs";
import { partitionUnclaimedByRegistry } from "../check-trusted-publishers.mjs";
import {
	resolveManifestWorkspaceRanges,
	resolveWorkspaceRange,
} from "../lib/workspace-ranges.mjs";

const TARGET = "@pie-players/pie-tool-sign-language";
const SIBLING = "@pie-players/pie-theme";

const baseInput = (overrides = {}) => ({
	target: TARGET,
	publishableNames: [TARGET, SIBLING],
	fixedSet: new Set([TARGET, SIBLING]),
	groupVersions: new Map([
		[TARGET, "0.3.50"],
		[SIBLING, "0.3.50"],
	]),
	publishedVersion: UNPUBLISHED,
	...overrides,
});

describe("collectBootstrapBlockers", () => {
	test("a new, fixed-group, unpublished package is bootstrappable", () => {
		expect(collectBootstrapBlockers(baseInput())).toEqual([]);
	});

	test("refuses a package that is already on the registry", () => {
		const blockers = collectBootstrapBlockers(
			baseInput({ publishedVersion: "0.3.64" }),
		);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain("already on the registry at 0.3.64");
		// The operator's likely actual problem is a missing claim, so name that command.
		expect(blockers[0]).toContain("trusted-publishers -- --apply");
	});

	test("refuses a package that is not a publishable workspace member", () => {
		const blockers = collectBootstrapBlockers(
			baseInput({ publishableNames: [SIBLING] }),
		);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain("not a publishable workspace package");
	});

	test("does not pile on further blockers for an unknown package", () => {
		// Version and fixed-group state are meaningless for a package with no manifest, and
		// reporting them alongside would bury the one thing that is wrong.
		const blockers = collectBootstrapBlockers(
			baseInput({
				publishableNames: [SIBLING],
				fixedSet: new Set([SIBLING]),
				groupVersions: new Map([[SIBLING, "0.3.50"]]),
			}),
		);
		expect(blockers).toHaveLength(1);
	});

	test("refuses a package missing from the changesets fixed group", () => {
		const blockers = collectBootstrapBlockers(
			baseInput({ fixedSet: new Set([SIBLING]) }),
		);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain("fixed` group");
	});

	test("refuses when the fixed-group versions are not uniform", () => {
		const blockers = collectBootstrapBlockers(
			baseInput({
				groupVersions: new Map([
					[TARGET, "0.3.50"],
					[SIBLING, "0.3.64"],
				]),
			}),
		);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toContain("not uniform");
	});

	test("an independently-versioned repo has no fixed group to check", () => {
		expect(
			collectBootstrapBlockers(
				baseInput({
					fixedSet: new Set(),
					groupVersions: new Map([
						[TARGET, "0.3.50"],
						[SIBLING, "1.2.0"],
					]),
				}),
			),
		).toEqual([]);
	});
});

describe("narrowToFixedGroup", () => {
	test("excludes apps and tools, which carry their own versions", () => {
		// The first run of this script refused every bootstrap because the demo app's 0.1.0 and
		// the tools' versions were read as a broken fixed group.
		const versions = new Map([
			[TARGET, "0.3.50"],
			[SIBLING, "0.3.50"],
			["section-demos", "0.1.0"],
			["@pie-players/cli", "0.1.63"],
		]);

		const group = narrowToFixedGroup(
			versions,
			[TARGET, SIBLING],
			new Set([TARGET, SIBLING]),
		);

		expect([...group.keys()].sort()).toEqual([TARGET, SIBLING].sort());
		expect(new Set(group.values()).size).toBe(1);
	});

	test("excludes a publishable package that is not in the fixed group", () => {
		const group = narrowToFixedGroup(
			new Map([
				[TARGET, "0.3.50"],
				[SIBLING, "9.9.9"],
			]),
			[TARGET, SIBLING],
			new Set([TARGET]),
		);

		expect([...group.keys()]).toEqual([TARGET]);
	});
});

describe("collectUninstallableDependencies", () => {
	const resolved = [
		{
			section: "dependencies",
			name: "@pie-players/pie-assessment-toolkit",
			from: "workspace:*",
			to: "0.3.50",
		},
		{
			section: "dependencies",
			name: "@pie-players/pie-players-shared",
			from: "workspace:*",
			to: "0.3.50",
		},
	];

	test("passes when every pinned dependency version exists", () => {
		expect(collectUninstallableDependencies(resolved, () => true)).toEqual([]);
	});

	test("names the dependency versions the registry does not have", () => {
		const missing = collectUninstallableDependencies(
			resolved,
			(name) => name !== "@pie-players/pie-players-shared",
		);
		expect(missing).toEqual([
			{
				section: "dependencies",
				name: "@pie-players/pie-players-shared",
				range: "0.3.50",
			},
		]);
	});
});

describe("resolveWorkspaceRange", () => {
	test("resolves the pnpm workspace specifier forms", () => {
		expect(resolveWorkspaceRange("workspace:*", "0.3.50")).toBe("0.3.50");
		expect(resolveWorkspaceRange("workspace:", "0.3.50")).toBe("0.3.50");
		expect(resolveWorkspaceRange("workspace:^", "0.3.50")).toBe("^0.3.50");
		expect(resolveWorkspaceRange("workspace:~", "0.3.50")).toBe("~0.3.50");
		expect(resolveWorkspaceRange("workspace:>=1.0.0", "0.3.50")).toBe(
			">=1.0.0",
		);
	});

	test("leaves the specifier alone when the package is not in the workspace", () => {
		expect(resolveWorkspaceRange("workspace:*", undefined)).toBe("workspace:*");
	});
});

describe("resolveManifestWorkspaceRanges", () => {
	test("rewrites every dependency section and reports the changes", () => {
		const manifest = {
			dependencies: { [SIBLING]: "workspace:*", lit: "^3.0.0" },
			peerDependencies: { [TARGET]: "workspace:^" },
		};
		const { resolved, unresolved } = resolveManifestWorkspaceRanges(
			manifest,
			new Map([
				[SIBLING, "0.3.50"],
				[TARGET, "0.3.50"],
			]),
		);

		expect(manifest.dependencies[SIBLING]).toBe("0.3.50");
		expect(manifest.dependencies.lit).toBe("^3.0.0");
		expect(manifest.peerDependencies[TARGET]).toBe("^0.3.50");
		expect(unresolved).toEqual([]);
		expect(resolved).toHaveLength(2);
	});

	test("reports a workspace range naming no workspace package", () => {
		const manifest = { dependencies: { "@pie-players/gone": "workspace:*" } };
		const { resolved, unresolved } = resolveManifestWorkspaceRanges(
			manifest,
			new Map(),
		);

		expect(resolved).toEqual([]);
		expect(unresolved).toEqual([
			{
				section: "dependencies",
				name: "@pie-players/gone",
				range: "workspace:*",
			},
		]);
		// Left in place rather than invented, so the caller refuses instead of publishing it.
		expect(manifest.dependencies["@pie-players/gone"]).toBe("workspace:*");
	});
});

describe("partitionUnclaimedByRegistry", () => {
	test("routes a never-published package to bootstrap and the rest to claim", () => {
		const { needsBootstrap, needsClaim } = partitionUnclaimedByRegistry({
			unclaimed: [TARGET, SIBLING],
			isPublished: (name) => name === SIBLING,
		});

		expect(needsBootstrap).toEqual([TARGET]);
		expect(needsClaim).toEqual([SIBLING]);
	});
});
